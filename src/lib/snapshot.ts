import { DRUG_LIBRARY } from '@/engine/drugLibrary';
import type { AppDB } from './db';
import { DEFAULT_SETTINGS } from './seed';
import type { EngineSnapshot } from './types';

export type SnapshotData = Omit<EngineSnapshot, 'now' | 'drugLibrary'>;

/** Reads everything the engine needs. Used inside useLiveQuery so it re-runs on any change. */
export async function loadSnapshotData(db: AppDB): Promise<SnapshotData> {
  const [parameters, symptoms, slots, medications, regimens, readings, symptomEntries, doseEvents, settings] = await Promise.all([
    db.parameters.orderBy('order').toArray(),
    db.symptoms.orderBy('order').toArray(),
    db.slots.orderBy('order').toArray(),
    db.medications.toArray(),
    db.regimens.orderBy('effectiveFrom').toArray(),
    db.readings.orderBy('takenAt').toArray(),
    db.symptomEntries.orderBy('takenAt').toArray(),
    db.doseEvents.orderBy('takenAt').toArray(),
    db.settings.get('settings'),
  ]);
  const s = settings ?? DEFAULT_SETTINGS;
  return {
    parameters, symptoms, slots, medications, regimens, readings, symptomEntries, doseEvents,
    settings: { analysisWindowDays: s.analysisWindowDays, excludeTags: s.excludeTags },
  };
}

export function toSnapshot(data: SnapshotData, now: Date): EngineSnapshot {
  return { ...data, now: now.toISOString(), drugLibrary: DRUG_LIBRARY };
}

export async function buildSnapshot(db: AppDB, now: Date): Promise<EngineSnapshot> {
  return toSnapshot(await loadSnapshotData(db), now);
}
