import { Scenario } from '../src/engine/__tests__/fixtures';
import { BACKUP_APP, BACKUP_SCHEMA_VERSION, type Backup } from '../src/lib/backup';
import { DEFAULT_SETTINGS } from '../src/lib/seed';

/**
 * Demo backup mirroring meta/claude-design/05-mock-data.md: 5 days ending yesterday,
 * bisoprolol + ramipril + amiodarone, a bisoprolol change on day 3, morning BP above range.
 */
export function demoBackup(now = new Date()): Backup {
  const first = new Date(now);
  first.setDate(first.getDate() - 5);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const s = new Scenario(iso(first)).med('bisoprolol').med('ramipril').med('amiodarone')
    .regimen(1, '07:00', [['bisoprolol', 'morning', 2.5], ['ramipril', 'morning', 2.5], ['ramipril', 'evening', 2.5], ['amiodarone', 'morning', 200]], 'Started on ward')
    .regimen(3, '08:00', [['bisoprolol', 'morning', 5], ['ramipril', 'morning', 2.5], ['ramipril', 'evening', 2.5], ['amiodarone', 'morning', 200]], 'Dr. Weber: bisoprolol 2.5 → 5 mg');
  const morning = [144, 141, 148, 139, 143];
  const noon = [138, 136, 140, 128, 126];
  const hrMorning = [98, 96, 84, 82, 80];
  for (let d = 1; d <= 5; d++) {
    s.bp(d, '07:05', morning[d - 1], 84 + (d % 3));
    s.hr(d, '07:05', hrMorning[d - 1]);
    s.reading(d, '07:05', 'spo2', { value: 96 });
    s.reading(d, '07:05', 'rr', { value: 16 });
    if (d >= 4) s.symptom(d, '07:05', 'exhaustion', d === 4 ? 5 : 6);
    s.dosesFor(d, 'morning', '08:10');
    s.bp(d, '12:05', noon[d - 1], 78);
    s.hr(d, '12:05', d === 5 ? 58 : 74);
    if (d === 2) s.dose(d, '18:00', 'ramipril', { status: 'skipped' });
    else s.dosesFor(d, 'evening', '18:00');
    s.bp(d, '18:30', 118, 74);
    s.hr(d, '18:30', d === 4 ? 104 : 72, d === 4 ? ['after_activity'] : []);
    s.bp(d, '22:00', 120, 72);
  }
  const snap = s.now(5, '13:00').build();
  return {
    app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(),
    data: {
      parameters: snap.parameters, symptoms: snap.symptoms, slots: snap.slots, medications: snap.medications,
      regimens: snap.regimens, readings: snap.readings, symptomEntries: snap.symptomEntries, doseEvents: snap.doseEvents,
      settings: [{ ...DEFAULT_SETTINGS, disclaimerAcceptedAt: now.toISOString(), lastBackupAt: now.toISOString() }],
    },
  };
}
