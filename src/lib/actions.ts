import { newId, type AppDB } from './db';
import type {
  AppSettings, ContextTag, DoseEvent, DoseStatus, ID, ISODateTime, Medication, Reading, RegimenItem, RegimenVersion,
  SymptomEntry,
} from './types';

// All writes the UI performs. Each one is a single Dexie transaction.

export function currentRegimen(regimens: RegimenVersion[], now: Date): RegimenVersion | undefined {
  const t = now.toISOString();
  return [...regimens].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).filter((r) => r.effectiveFrom <= t).pop();
}

export interface LogDose {
  medicationId: ID;
  status: DoseStatus;
  plannedAmount: number | null;
  actualAmount: number;
}

export interface LogInput {
  takenAt: ISODateTime;
  slotId: ID;
  readings: { parameterId: ID; values: Record<string, number> }[];
  tags: ContextTag[];
  symptoms: { symptomId: ID; score: number }[];
  doses: LogDose[];
  regimenVersionId: ID | null;
}

export interface SavedLog {
  readingIds: ID[];
  symptomIds: ID[];
  doseIds: ID[];
}

export async function saveLog(db: AppDB, input: LogInput): Promise<SavedLog> {
  const readings: Reading[] = input.readings.map((r) => ({
    id: newId(), parameterId: r.parameterId, values: r.values, takenAt: input.takenAt, tags: input.tags,
  }));
  const symptoms: SymptomEntry[] = input.symptoms.map((s) => ({
    id: newId(), symptomId: s.symptomId, score: s.score, takenAt: input.takenAt,
  }));
  const doses: DoseEvent[] = input.doses.map((d) => ({
    id: newId(), medicationId: d.medicationId, slotId: input.slotId, status: d.status, takenAt: input.takenAt,
    regimenVersionId: d.status === 'extra' ? null : input.regimenVersionId,
    plannedAmount: d.status === 'extra' ? null : d.plannedAmount,
    actualAmount: d.status === 'skipped' ? 0 : d.actualAmount,
  }));
  await db.transaction('rw', db.readings, db.symptomEntries, db.doseEvents, async () => {
    await db.readings.bulkAdd(readings);
    await db.symptomEntries.bulkAdd(symptoms);
    await db.doseEvents.bulkAdd(doses);
  });
  return { readingIds: readings.map((r) => r.id), symptomIds: symptoms.map((s) => s.id), doseIds: doses.map((d) => d.id) };
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

/** Regimen versions are immutable: every change creates a new version. */
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

export async function addMedication(db: AppDB, med: Omit<Medication, 'id' | 'archived'>): Promise<Medication> {
  const m: Medication = { ...med, id: newId(), archived: false };
  await db.medications.add(m);
  return m;
}

export async function updateMedication(db: AppDB, id: ID, changes: Partial<Medication>): Promise<void> {
  await db.medications.update(id, changes);
}

export async function updateSettings(db: AppDB, changes: Partial<AppSettings>): Promise<void> {
  await db.settings.update('settings', changes);
}

export async function dismissInsight(db: AppDB, key: string, confidence: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const s = await db.settings.get('settings');
    if (!s) return;
    const entry = `${key}|${confidence}`;
    if (!s.dismissedInsightKeys.includes(entry)) await db.settings.update('settings', { dismissedInsightKeys: [...s.dismissedInsightKeys, entry] });
  });
}

export function isDismissed(settings: AppSettings | undefined, key: string, confidence: string): boolean {
  return !!settings?.dismissedInsightKeys.includes(`${key}|${confidence}`);
}
