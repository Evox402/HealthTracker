import { newId, type AppDB } from './db';
import type {
  AppSettings, DoseEvent, DoseStatus, DoseUnit, ID, ISODateTime, Medication, ParameterDef, Reading, RegimenItem, RegimenVersion,
  SymptomDef, SymptomEntry, SymptomType,
} from './types';

// All writes the UI performs. Each one is a single Dexie transaction.

export function currentRegimen(regimens: RegimenVersion[], now: Date): RegimenVersion | undefined {
  const t = now.toISOString();
  return [...regimens].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).filter((r) => r.effectiveFrom <= t).pop();
}

// ---------- log ----------

export interface SavedLog {
  readingIds: ID[];
  symptomIds: ID[];
  doseIds: ID[];
}

export async function logReading(
  db: AppDB, input: { parameterId: ID; values: Record<string, number>; takenAt: ISODateTime; note?: string },
): Promise<SavedLog> {
  const note = input.note?.trim();
  const reading: Reading = { id: newId(), parameterId: input.parameterId, values: input.values, takenAt: input.takenAt, tags: [], ...(note ? { note } : {}) };
  await db.readings.add(reading);
  return { readingIds: [reading.id], symptomIds: [], doseIds: [] };
}

export async function logSymptom(
  db: AppDB, input: { symptomId: ID; score: number; takenAt: ISODateTime; note?: string },
): Promise<SavedLog> {
  const note = input.note?.trim();
  const entry: SymptomEntry = { id: newId(), symptomId: input.symptomId, score: input.score, takenAt: input.takenAt, ...(note ? { note } : {}) };
  await db.symptomEntries.add(entry);
  return { readingIds: [], symptomIds: [entry.id], doseIds: [] };
}

export async function undoLog(db: AppDB, saved: SavedLog): Promise<void> {
  await db.transaction('rw', db.readings, db.symptomEntries, db.doseEvents, async () => {
    await db.readings.bulkDelete(saved.readingIds);
    await db.symptomEntries.bulkDelete(saved.symptomIds);
    await db.doseEvents.bulkDelete(saved.doseIds);
  });
}

export async function deleteReading(db: AppDB, id: ID): Promise<void> {
  await db.readings.delete(id);
}

export async function deleteSymptomEntry(db: AppDB, id: ID): Promise<void> {
  await db.symptomEntries.delete(id);
}

// ---------- doses ----------

export interface DoseInput {
  medicationId: ID;
  slotId: ID;
  status: Exclude<DoseStatus, 'extra'>;
  plannedAmount: number;
  actualAmount?: number;       // only for 'changed'
  takenAt: ISODateTime;
  regimenVersionId: ID | null;
}

/** Records one planned dose of the stack; replaces any earlier record for the same dose (`replaceIds`). */
export async function recordDose(db: AppDB, input: DoseInput, replaceIds: ID[] = []): Promise<DoseEvent> {
  const dose: DoseEvent = {
    id: newId(), medicationId: input.medicationId, slotId: input.slotId, status: input.status, takenAt: input.takenAt,
    regimenVersionId: input.regimenVersionId, plannedAmount: input.plannedAmount,
    actualAmount: input.status === 'skipped' ? 0 : input.status === 'changed' ? (input.actualAmount ?? 0) : input.plannedAmount,
  };
  await db.transaction('rw', db.doseEvents, async () => {
    await db.doseEvents.bulkDelete(replaceIds);
    await db.doseEvents.add(dose);
  });
  return dose;
}

export async function deleteDoses(db: AppDB, ids: ID[]): Promise<void> {
  await db.doseEvents.bulkDelete(ids);
}

// ---------- med stack ----------

/** Regimen versions are immutable: every change to the stack creates a new version effective now. */
export async function saveRegimenVersion(
  db: AppDB, input: { effectiveFrom: ISODateTime; items: RegimenItem[]; note: string }, now = new Date(),
): Promise<RegimenVersion> {
  const version: RegimenVersion = {
    id: newId(), effectiveFrom: input.effectiveFrom, note: input.note.trim(), createdAt: now.toISOString(),
    items: input.items.filter((i) => i.amount > 0).map((i) => ({ ...i })),
  };
  await db.regimens.add(version);
  return version;
}

/** Sets one medication's amounts per slot in the stack (empty `slots` removes it). */
export async function setStackEntry(
  db: AppDB, medicationId: ID, slots: { slotId: ID; amount: number }[], now = new Date(),
): Promise<RegimenVersion> {
  return db.transaction('rw', db.regimens, async () => {
    const current = currentRegimen(await db.regimens.toArray(), now);
    const others = (current?.items ?? []).filter((i) => i.medicationId !== medicationId);
    const items = [...others, ...slots.map((s) => ({ medicationId, slotId: s.slotId, amount: s.amount }))];
    // A later version would make this edit invisible: never go back in time.
    const effectiveFrom = current && current.effectiveFrom > now.toISOString() ? current.effectiveFrom : now.toISOString();
    return saveRegimenVersion(db, { effectiveFrom, items, note: '' }, now);
  });
}

export async function addMedication(db: AppDB, med: { name: string; unit: DoseUnit }): Promise<Medication> {
  const m: Medication = { id: newId(), name: med.name.trim(), unit: med.unit, archived: false };
  await db.medications.add(m);
  return m;
}

export async function updateMedication(db: AppDB, id: ID, changes: Partial<Medication>): Promise<void> {
  await db.medications.update(id, changes);
}

/** Archives a medication and takes it off the stack. Its dose history stays. */
export async function archiveMedication(db: AppDB, id: ID, now = new Date()): Promise<void> {
  await db.transaction('rw', db.medications, db.regimens, async () => {
    await db.medications.update(id, { archived: true });
    const current = currentRegimen(await db.regimens.toArray(), now);
    if (current?.items.some((i) => i.medicationId === id)) await setStackEntry(db, id, [], now);
  });
}

// ---------- trackers ----------

export interface NewNumberTracker {
  name: string;
  unit: string;
  decimals: number;
  targetMin?: number;
  targetMax?: number;
}

export async function addNumberTracker(db: AppDB, t: NewNumberTracker): Promise<ParameterDef> {
  const order = ((await db.parameters.orderBy('order').last())?.order ?? -1) + 1;
  const p: ParameterDef = {
    id: newId(), kind: 'custom', name: t.name.trim(), unit: t.unit.trim(), decimals: t.decimals, order, archived: false,
    components: [{ key: 'value', label: t.name.trim(), targetMin: t.targetMin, targetMax: t.targetMax }],
  };
  await db.parameters.add(p);
  return p;
}

export async function addSymptomTracker(db: AppDB, t: { name: string; type: SymptomType; threshold?: number }): Promise<SymptomDef> {
  const order = ((await db.symptoms.orderBy('order').last())?.order ?? -1) + 1;
  const s: SymptomDef = { id: newId(), name: t.name.trim(), type: t.type, threshold: t.threshold ?? 0, order, archived: false };
  await db.symptoms.add(s);
  return s;
}

export async function setTrackerArchived(db: AppDB, kind: 'parameter' | 'symptom', id: ID, archived: boolean): Promise<void> {
  await (kind === 'parameter' ? db.parameters : db.symptoms).update(id, { archived });
}

export type DeletedTracker =
  | { kind: 'parameter'; def: ParameterDef; entries: Reading[] }
  | { kind: 'symptom'; def: SymptomDef; entries: SymptomEntry[] };

/** Deletes a tracker and all its entries. Returns what was removed so the UI can undo it. */
export async function deleteTracker(db: AppDB, kind: 'parameter' | 'symptom', id: ID): Promise<DeletedTracker> {
  if (kind === 'parameter') {
    return db.transaction('rw', db.parameters, db.readings, async () => {
      const def = await db.parameters.get(id);
      if (!def) throw new Error(`No tracker ${id}`);
      const entries = await db.readings.where('parameterId').equals(id).toArray();
      await db.readings.bulkDelete(entries.map((e) => e.id));
      await db.parameters.delete(id);
      return { kind, def, entries };
    });
  }
  return db.transaction('rw', db.symptoms, db.symptomEntries, async () => {
    const def = await db.symptoms.get(id);
    if (!def) throw new Error(`No tracker ${id}`);
    const entries = await db.symptomEntries.where('symptomId').equals(id).toArray();
    await db.symptomEntries.bulkDelete(entries.map((e) => e.id));
    await db.symptoms.delete(id);
    return { kind, def, entries };
  });
}

export async function restoreTracker(db: AppDB, deleted: DeletedTracker): Promise<void> {
  if (deleted.kind === 'parameter') {
    await db.transaction('rw', db.parameters, db.readings, async () => {
      await db.parameters.put(deleted.def);
      await db.readings.bulkPut(deleted.entries);
    });
  } else {
    await db.transaction('rw', db.symptoms, db.symptomEntries, async () => {
      await db.symptoms.put(deleted.def);
      await db.symptomEntries.bulkPut(deleted.entries);
    });
  }
}

// ---------- settings ----------

export async function updateSettings(db: AppDB, changes: Partial<AppSettings>): Promise<void> {
  await db.settings.update('settings', changes);
}
