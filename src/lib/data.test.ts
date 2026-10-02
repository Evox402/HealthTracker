import 'fake-indexeddb/auto';
import { runEngine } from '@/engine';
import { addMedication, currentRegimen, dismissInsight, isDismissed, saveLog, saveRegimenVersion, undoLog } from './actions';
import { BackupError, backupCounts, backupFilename, createBackup, parseBackup, restoreBackup } from './backup';
import { AppDB } from './db';
import { autoAdvanceDigits, isPlausible } from './plausibility';
import { ensureSeeded } from './seed';
import { buildSnapshot } from './snapshot';

let db: AppDB;
let n = 0;
beforeEach(async () => {
  db = new AppDB(`test-${++n}`);
  await ensureSeeded(db);
});
afterEach(async () => {
  await db.delete();
});

describe('seed', () => {
  it('inserts defaults once', async () => {
    await db.parameters.update('hr', { name: 'Pulse' });
    await ensureSeeded(db);
    expect(await db.parameters.count()).toBe(4);
    expect(await db.symptoms.count()).toBe(5);
    expect(await db.slots.count()).toBe(4);
    expect((await db.parameters.get('hr'))?.name).toBe('Pulse');
    expect((await db.settings.get('settings'))?.disclaimerAcceptedAt).toBeNull();
  });
});

describe('logging', () => {
  it('saves a full slot in one go and can undo it', async () => {
    const med = await addMedication(db, { name: 'Bisoprolol', libraryId: 'bisoprolol', unit: 'mg' });
    const v1 = await saveRegimenVersion(db, {
      effectiveFrom: '2026-09-28T05:00:00.000Z', note: 'Started on ward', items: [{ medicationId: med.id, slotId: 'morning', amount: 5 }],
    });
    const saved = await saveLog(db, {
      takenAt: '2026-09-28T06:00:00.000Z', slotId: 'morning', regimenVersionId: v1.id, tags: ['resting'],
      readings: [{ parameterId: 'bp', values: { sys: 128, dia: 78 } }, { parameterId: 'hr', values: { value: 72 } }],
      symptoms: [{ symptomId: 'exhaustion', score: 5 }],
      doses: [
        { medicationId: med.id, status: 'taken', plannedAmount: 5, actualAmount: 5 },
        { medicationId: med.id, status: 'skipped', plannedAmount: 5, actualAmount: 5 },
      ],
    });
    expect(await db.readings.count()).toBe(2);
    expect((await db.readings.toArray())[0].tags).toEqual(['resting']);
    const doses = await db.doseEvents.toArray();
    expect(doses.find((d) => d.status === 'skipped')?.actualAmount).toBe(0);
    expect(doses[0].regimenVersionId).toBe(v1.id);

    await undoLog(db, saved);
    expect(await db.readings.count()).toBe(0);
    expect(await db.symptomEntries.count()).toBe(0);
    expect(await db.doseEvents.count()).toBe(0);
  });

  it('feeds the engine through the snapshot', async () => {
    await saveLog(db, {
      takenAt: new Date().toISOString(), slotId: 'noon', regimenVersionId: null, tags: [], symptoms: [], doses: [],
      readings: [{ parameterId: 'hr', values: { value: 41 } }],
    });
    const result = runEngine(await buildSnapshot(db, new Date(Date.now() + 1000)));
    expect(result.redFlags.map((f) => f.title)).toEqual(['Heart rate 41 bpm']);
  });
});

describe('regimen', () => {
  it('keeps versions and finds the current one', async () => {
    const a = await saveRegimenVersion(db, { effectiveFrom: '2026-09-28T05:00:00.000Z', note: '', items: [] });
    const b = await saveRegimenVersion(db, {
      effectiveFrom: '2026-09-30T06:00:00.000Z', note: ' raised ', items: [{ medicationId: 'm', slotId: 'morning', amount: 0 }],
    });
    const all = await db.regimens.toArray();
    expect(currentRegimen(all, new Date('2026-09-29T00:00:00Z'))?.id).toBe(a.id);
    expect(currentRegimen(all, new Date('2026-10-01T00:00:00Z'))?.id).toBe(b.id);
    expect(currentRegimen(all, new Date('2026-09-01T00:00:00Z'))).toBeUndefined();
    expect(b.note).toBe('raised');
    expect(b.items).toEqual([]); // zero amounts are dropped
  });
});

describe('dismissed insights', () => {
  it('stores key + confidence so a stronger insight reappears', async () => {
    await dismissInsight(db, 'k1', 'low');
    await dismissInsight(db, 'k1', 'low');
    const s = await db.settings.get('settings');
    expect(s?.dismissedInsightKeys).toEqual(['k1|low']);
    expect(isDismissed(s, 'k1', 'low')).toBe(true);
    expect(isDismissed(s, 'k1', 'medium')).toBe(false);
  });
});

describe('backup', () => {
  it('round-trips the whole database', async () => {
    await saveLog(db, {
      takenAt: '2026-09-28T06:00:00.000Z', slotId: 'morning', regimenVersionId: null, tags: [], symptoms: [], doses: [],
      readings: [{ parameterId: 'hr', values: { value: 72 } }],
    });
    const backup = await createBackup(db, new Date('2026-10-02T10:00:00Z'));
    const parsed = parseBackup(JSON.stringify(backup));
    expect(backupCounts(parsed)).toMatchObject({ readings: 1, parameters: 4, settings: 1 });

    await db.readings.clear();
    await db.parameters.update('hr', { name: 'changed' });
    await restoreBackup(db, parsed);
    expect(await db.readings.count()).toBe(1);
    expect((await db.parameters.get('hr'))?.name).toBe('Heart rate');
  });

  it.each([
    ['not json', /not valid JSON/],
    ['{"app":"other"}', /not a MedicineAdjuster backup/],
    ['{"app":"medicine-adjuster","schemaVersion":9}', /Unsupported backup version 9/],
    ['{"app":"medicine-adjuster","schemaVersion":1,"data":{}}', /missing "parameters"/],
  ])('rejects %s', (text, message) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(message);
  });

  it('names files by local date and time', () => {
    expect(backupFilename(new Date(2026, 9, 2, 9, 5))).toBe('medicine-adjuster-2026-10-02-0905.json');
  });
});

describe('plausibility', () => {
  it('flags typos without blocking normal values', () => {
    expect(isPlausible('bp', 'sys', 128)).toBe(true);
    expect(isPlausible('bp', 'sys', 1280)).toBe(false);
    expect(isPlausible('hr', 'value', 20)).toBe(false);
    expect(isPlausible('weight', 'value', 80)).toBe(true);
  });

  it.each([
    ['bp', 'sys', '12', false], ['bp', 'sys', '120', true], ['bp', 'sys', '95', true],
    ['bp', 'dia', '8', false], ['bp', 'dia', '80', true], ['hr', 'value', '72', true], ['hr', 'value', '11', false],
    ['spo2', 'value', '9', false], ['spo2', 'value', '97', true], ['rr', 'value', '16', true],
  ])('%s.%s "%s" advances: %s', (p, c, raw, expected) => {
    expect(autoAdvanceDigits(p, c, raw)).toBe(expected);
  });
});
