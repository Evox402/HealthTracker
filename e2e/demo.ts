import { Scenario } from '../src/engine/__tests__/fixtures';
import { BACKUP_APP, BACKUP_SCHEMA_VERSION, type Backup } from '../src/lib/backup';
import { DEFAULT_SETTINGS } from '../src/lib/seed';

/**
 * Demo backup: 5 days ending yesterday with a med stack (bisoprolol, ramipril,
 * magnesium), BP/HR/weight, pain scores, stool entries and a dizziness event.
 */
export function demoBackup(now = new Date()): Backup {
  const first = new Date(now);
  first.setDate(first.getDate() - 5);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const s = new Scenario(iso(first)).med('bisoprolol').med('ramipril').med('magnesium', 'pill')
    .regimen(1, '07:00', [['bisoprolol', 'morning', 5], ['ramipril', 'morning', 2.5], ['ramipril', 'evening', 2.5], ['magnesium', 'noon', 1]]);
  s.symptoms.push({ id: 'dizziness', name: 'Dizziness', type: 'event', threshold: 0, order: 3, archived: false });
  const morning = [144, 141, 148, 139, 143];
  const weight = [82.4, 82.1, 82.3, 81.9, 81.8];
  const stool = [[4], [3, 5], [], [4], [6, 4]];
  for (let d = 1; d <= 5; d++) {
    s.bp(d, '07:05', morning[d - 1], 84 + (d % 3));
    s.hr(d, '07:05', 80 - d);
    s.reading(d, '07:00', 'weight', { value: weight[d - 1] });
    s.dosesFor(d, 'morning', '08:10');
    s.symptom(d, '12:00', 'pain', 6 - d);
    s.dosesFor(d, 'noon', '12:10');
    stool[d - 1].forEach((type, i) => s.symptom(d, `${9 + i * 6}:30`, 'stool', type));
    if (d === 2) s.dose(d, '18:00', 'ramipril', { status: 'skipped' });
    else s.dosesFor(d, 'evening', '18:00');
    s.bp(d, '18:30', 118, 74);
  }
  s.symptom(3, '15:00', 'dizziness', 1, 'Standing up quickly');
  return {
    app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(),
    data: { ...s.data(), settings: [{ ...DEFAULT_SETTINGS, disclaimerAcceptedAt: now.toISOString(), lastBackupAt: now.toISOString() }] },
  };
}

/** The same data as a MedicineAdjuster v1 backup: untyped symptoms, no weight, SpO₂ shown. */
export function demoBackupV1(now = new Date()): unknown {
  const b = demoBackup(now);
  return {
    ...b, schemaVersion: 1,
    data: {
      ...b.data,
      parameters: b.data.parameters.filter((p) => p.id !== 'weight').map((p) => ({ ...p, archived: false })),
      symptoms: b.data.symptoms.filter((x) => x.type === 'scale').map(({ type: _t, ...rest }) => rest),
      readings: [...b.data.readings.filter((r) => r.parameterId !== 'weight'), { id: 'v1-spo2', parameterId: 'spo2', values: { value: 96 }, takenAt: b.data.readings[0].takenAt, tags: [] }],
      symptomEntries: b.data.symptomEntries.filter((e) => e.symptomId === 'pain'),
    },
  };
}
