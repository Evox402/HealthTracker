import type { AppDB } from './db';
import { upgradeParameters, upgradeSymptoms } from './migrate';
import type {
  AppSettings, DoseEvent, Medication, ParameterDef, Reading, RegimenVersion, SlotDef, SymptomDef, SymptomEntry,
} from './types';

// JSON backup (meta/SPEC.md §8).

export const BACKUP_APP = 'medicine-adjuster';
export const BACKUP_SCHEMA_VERSION = 2;

export interface BackupData {
  parameters: ParameterDef[];
  symptoms: SymptomDef[];
  slots: SlotDef[];
  medications: Medication[];
  regimens: RegimenVersion[];
  readings: Reading[];
  symptomEntries: SymptomEntry[];
  doseEvents: DoseEvent[];
  settings: AppSettings[];
}

export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export const TABLES: (keyof BackupData)[] = [
  'parameters', 'symptoms', 'slots', 'medications', 'regimens', 'readings', 'symptomEntries', 'doseEvents', 'settings',
];

export async function createBackup(db: AppDB, now = new Date()): Promise<Backup> {
  const data = {} as BackupData;
  await db.transaction('r', db.allTables, async () => {
    for (const t of TABLES) (data as unknown as Record<string, unknown[]>)[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `health-tracker-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

export class BackupError extends Error {}

/** Validates a parsed backup file (v1 files are upgraded to v2). Throws BackupError with a user-readable message. */
export function validateBackup(raw: unknown): Backup {
  if (!raw || typeof raw !== 'object') throw new BackupError('This file is not a backup.');
  const b = raw as Partial<Backup>;
  if (b.app !== BACKUP_APP) throw new BackupError('This file is not a Health Tracker backup.');
  if (b.schemaVersion !== 1 && b.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupError(`Unsupported backup version ${String(b.schemaVersion)}. Update the app and try again.`);
  }
  if (!b.data || typeof b.data !== 'object') throw new BackupError('The backup has no data.');
  for (const t of TABLES) {
    const rows = (b.data as unknown as Record<string, unknown>)[t];
    if (!Array.isArray(rows)) throw new BackupError(`The backup is missing "${t}".`);
    if (rows.some((r) => !r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string')) {
      throw new BackupError(`The backup has invalid rows in "${t}".`);
    }
  }
  if (b.data.settings.length === 0) throw new BackupError('The backup has no settings.');
  if (b.schemaVersion === 1) {
    return {
      ...(b as Backup), schemaVersion: BACKUP_SCHEMA_VERSION,
      data: { ...b.data, parameters: upgradeParameters(b.data.parameters), symptoms: upgradeSymptoms(b.data.symptoms) },
    };
  }
  return b as Backup;
}

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('This file is not valid JSON.');
  }
  return validateBackup(raw);
}

export function backupCounts(b: Backup): Record<keyof BackupData, number> {
  return Object.fromEntries(TABLES.map((t) => [t, b.data[t].length])) as Record<keyof BackupData, number>;
}

/** Replaces every table with the backup's contents in one transaction. */
export async function restoreBackup(db: AppDB, b: Backup): Promise<void> {
  await db.transaction('rw', db.allTables, async () => {
    for (const t of TABLES) {
      const table = db.table(t);
      await table.clear();
      await table.bulkPut(b.data[t]);
    }
  });
}

/** Browser download of a backup as a JSON file. */
export function downloadBackup(b: Backup, filename = backupFilename(new Date(b.exportedAt))): void {
  const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
