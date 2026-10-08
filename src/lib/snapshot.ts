import type { AppDB } from './db';
import type { DoseEvent, EngineSnapshot, Medication, RegimenVersion, SlotDef } from './types';

/** Everything the UI shows. The engine gets the subset in EngineSnapshot. */
export interface SnapshotData extends Omit<EngineSnapshot, 'now'> {
  slots: SlotDef[];
  medications: Medication[];
  regimens: RegimenVersion[];
  doseEvents: DoseEvent[];
}

/** Reads all data. Used inside useLiveQuery so it re-runs on any change. */
export async function loadSnapshotData(db: AppDB): Promise<SnapshotData> {
  const [parameters, symptoms, slots, medications, regimens, readings, symptomEntries, doseEvents] = await Promise.all([
    db.parameters.orderBy('order').toArray(),
    db.symptoms.orderBy('order').toArray(),
    db.slots.orderBy('order').toArray(),
    db.medications.toArray(),
    db.regimens.orderBy('effectiveFrom').toArray(),
    db.readings.orderBy('takenAt').toArray(),
    db.symptomEntries.orderBy('takenAt').toArray(),
    db.doseEvents.orderBy('takenAt').toArray(),
  ]);
  return { parameters, symptoms, slots, medications, regimens, readings, symptomEntries, doseEvents };
}

export function toSnapshot(data: SnapshotData, now: Date): EngineSnapshot {
  return {
    now: now.toISOString(), parameters: data.parameters, symptoms: data.symptoms, readings: data.readings, symptomEntries: data.symptomEntries,
  };
}

export async function buildSnapshot(db: AppDB, now: Date): Promise<EngineSnapshot> {
  return toSnapshot(await loadSnapshotData(db), now);
}
