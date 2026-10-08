import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { runEngine } from '@/engine';
import {
  addMedication, addNumberTracker, addSymptomTracker, archiveMedication, currentRegimen, logReading, logSymptom, recordDose,
  saveRegimenVersion, setStackEntry, setTrackerArchived, undoLog,
} from './actions';
import { BackupError, backupCounts, backupFilename, createBackup, parseBackup, restoreBackup } from './backup';
import { AppDB } from './db';
import { autoAdvanceDigits, isPlausible } from './plausibility';
import { DEFAULT_SETTINGS, ensureSeeded } from './seed';
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

// v1 rows as the MedicineAdjuster MVP stored them (no symptom type, no weight).
const V1_PARAMETERS = [
  { id: 'bp', kind: 'bp', name: 'Blood pressure', unit: 'mmHg', decimals: 0, order: 0, archived: false,
    components: [{ key: 'sys', label: 'Systolic', targetMin: 100, targetMax: 130 }, { key: 'dia', label: 'Diastolic', targetMin: 60, targetMax: 80 }] },
  { id: 'hr', kind: 'hr', name: 'Heart rate', unit: 'bpm', decimals: 0, order: 1, archived: false,
    components: [{ key: 'value', label: 'Heart rate', targetMin: 60, targetMax: 90, redFlagMin: 45 }] },
  { id: 'spo2', kind: 'spo2', name: 'SpO₂', unit: '%', decimals: 0, order: 2, archived: false,
    components: [{ key: 'value', label: 'SpO₂', targetMin: 94, targetMax: 100 }] },
  { id: 'rr', kind: 'rr', name: 'Respiratory rate', unit: '/min', decimals: 0, order: 3, archived: false,
    components: [{ key: 'value', label: 'Respiratory rate', targetMin: 12, targetMax: 20 }] },
];
const V1_SYMPTOMS = [
  { id: 'chest_pain', name: 'Chest pain', threshold: 2, redFlagAt: 7, order: 0, archived: false },
  { id: 'nausea', name: 'Nausea', threshold: 3, order: 1, archived: false },
];

describe('seed', () => {
  it('inserts defaults once', async () => {
    await db.parameters.update('hr', { name: 'Pulse' });
    await ensureSeeded(db);
    expect((await db.parameters.toArray()).filter((p) => !p.archived).map((p) => p.id)).toEqual(['bp', 'hr', 'weight']);
    expect((await db.symptoms.toArray()).map((s) => [s.id, s.type])).toEqual([['chest_pain', 'scale'], ['pain', 'scale'], ['stool', 'stool']]);
    expect(await db.slots.count()).toBe(4);
    expect((await db.parameters.get('hr'))?.name).toBe('Pulse');
    expect((await db.settings.get('settings'))?.disclaimerAcceptedAt).toBeNull();
  });
});

describe('v1 → v2 database upgrade', () => {
  it('keeps every row, types the symptoms, adds weight and archives SpO₂/RR', async () => {
    const name = `v1-${++n}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      parameters: 'id, order', symptoms: 'id, order', slots: 'id, order', medications: 'id, libraryId', regimens: 'id, effectiveFrom',
      readings: 'id, parameterId, takenAt', symptomEntries: 'id, symptomId, takenAt', doseEvents: 'id, medicationId, takenAt, slotId', settings: 'id',
    });
    await v1.table('parameters').bulkPut(V1_PARAMETERS);
    await v1.table('symptoms').bulkPut(V1_SYMPTOMS);
    await v1.table('readings').bulkPut([
      { id: 'r1', parameterId: 'spo2', values: { value: 96 }, takenAt: '2026-10-01T06:00:00.000Z', tags: [] },
      { id: 'r2', parameterId: 'bp', values: { sys: 140, dia: 85 }, takenAt: '2026-10-01T06:00:00.000Z', tags: ['resting'] },
    ]);
    await v1.table('symptomEntries').put({ id: 's1', symptomId: 'nausea', score: 4, takenAt: '2026-10-01T06:00:00.000Z' });
    await v1.table('medications').put({ id: 'm1', name: 'Bisoprolol', libraryId: 'bisoprolol', unit: 'mg', archived: false });
    await v1.table('doseEvents').put({
      id: 'd1', medicationId: 'm1', regimenVersionId: null, slotId: 'morning', plannedAmount: 5, actualAmount: 5, status: 'taken', takenAt: '2026-10-01T06:00:00.000Z',
    });
    await v1.table('settings').put({ ...DEFAULT_SETTINGS, disclaimerAcceptedAt: '2026-10-01T05:00:00.000Z' });
    v1.close();

    const upgraded = new AppDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect(await upgraded.readings.count()).toBe(2);
    expect(await upgraded.symptomEntries.count()).toBe(1);
    expect(await upgraded.doseEvents.count()).toBe(1);
    expect(await upgraded.medications.count()).toBe(1);
    const params = await upgraded.parameters.orderBy('order').toArray();
    expect(params.map((p) => [p.id, p.archived])).toEqual([['bp', false], ['hr', false], ['weight', false], ['spo2', true], ['rr', true]]);
    expect((await upgraded.symptoms.toArray()).every((s) => s.type === 'scale')).toBe(true);
    await upgraded.delete();
  });
});

describe('logging', () => {
  it('logs one tracker at a time and can undo it', async () => {
    const a = await logReading(db, { parameterId: 'weight', values: { value: 82.4 }, takenAt: '2026-10-08T06:00:00.000Z', note: '  after breakfast ' });
    const b = await logSymptom(db, { symptomId: 'stool', score: 4, takenAt: '2026-10-08T07:00:00.000Z' });
    expect(await db.readings.get(a.readingIds[0])).toMatchObject({ values: { value: 82.4 }, note: 'after breakfast', tags: [] });
    expect((await db.symptomEntries.get(b.symptomIds[0]))?.note).toBeUndefined();

    await undoLog(db, a);
    await undoLog(db, b);
    expect(await db.readings.count()).toBe(0);
    expect(await db.symptomEntries.count()).toBe(0);
  });

  it('feeds the engine through the snapshot', async () => {
    await logReading(db, { parameterId: 'hr', values: { value: 41 }, takenAt: new Date().toISOString() });
    const result = runEngine(await buildSnapshot(db, new Date(Date.now() + 1000)));
    expect(result.redFlags.map((f) => f.title)).toEqual(['Heart rate 41 bpm']);
  });
});

describe('doses', () => {
  it('records taken, skipped and other amounts, replacing earlier records of the same dose', async () => {
    const base = { medicationId: 'm', slotId: 'morning', plannedAmount: 5, takenAt: '2026-10-08T06:00:00.000Z', regimenVersionId: 'v1' };
    const taken = await recordDose(db, { ...base, status: 'taken' });
    expect(taken.actualAmount).toBe(5);
    const skipped = await recordDose(db, { ...base, status: 'skipped' }, [taken.id]);
    expect(skipped.actualAmount).toBe(0);
    const changed = await recordDose(db, { ...base, status: 'changed', actualAmount: 2.5 }, [skipped.id]);
    expect(await db.doseEvents.toArray()).toEqual([changed]);
    expect(changed.actualAmount).toBe(2.5);
  });
});

describe('med stack', () => {
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

  it('edits one medication at a time and archiving takes it off the stack', async () => {
    const t = new Date('2026-10-08T06:00:00Z');
    const biso = await addMedication(db, { name: ' Bisoprolol ', unit: 'mg' });
    const mag = await addMedication(db, { name: 'Magnesium', unit: 'pill' });
    expect(biso.name).toBe('Bisoprolol');
    await setStackEntry(db, biso.id, [{ slotId: 'morning', amount: 5 }, { slotId: 'evening', amount: 2.5 }], t);
    await setStackEntry(db, mag.id, [{ slotId: 'noon', amount: 1 }], new Date(t.getTime() + 1000));
    await setStackEntry(db, biso.id, [{ slotId: 'morning', amount: 5 }], new Date(t.getTime() + 2000));
    let stack = currentRegimen(await db.regimens.toArray(), new Date(t.getTime() + 3000));
    expect(stack?.items).toEqual([{ medicationId: mag.id, slotId: 'noon', amount: 1 }, { medicationId: biso.id, slotId: 'morning', amount: 5 }]);

    await archiveMedication(db, mag.id, new Date(t.getTime() + 4000));
    stack = currentRegimen(await db.regimens.toArray(), new Date(t.getTime() + 5000));
    expect(stack?.items.map((i) => i.medicationId)).toEqual([biso.id]);
    expect((await db.medications.get(mag.id))?.archived).toBe(true);
  });
});

describe('trackers', () => {
  it('creates number and symptom trackers after the existing ones', async () => {
    const temp = await addNumberTracker(db, { name: 'Temperature', unit: '°C', decimals: 1, targetMin: 36, targetMax: 37.5 });
    const dizzy = await addSymptomTracker(db, { name: 'Dizziness', type: 'event' });
    expect(temp).toMatchObject({ kind: 'custom', order: 5, components: [{ key: 'value', label: 'Temperature', targetMin: 36, targetMax: 37.5 }] });
    expect(dizzy).toMatchObject({ type: 'event', order: 3, archived: false });
    await setTrackerArchived(db, 'symptom', dizzy.id, true);
    expect((await db.symptoms.get(dizzy.id))?.archived).toBe(true);
  });
});

describe('backup', () => {
  it('round-trips the whole database', async () => {
    await logReading(db, { parameterId: 'hr', values: { value: 72 }, takenAt: '2026-09-28T06:00:00.000Z' });
    const backup = await createBackup(db, new Date('2026-10-02T10:00:00Z'));
    expect(backup.schemaVersion).toBe(2);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(backupCounts(parsed)).toMatchObject({ readings: 1, parameters: 5, settings: 1 });

    await db.readings.clear();
    await db.parameters.update('hr', { name: 'changed' });
    await restoreBackup(db, parsed);
    expect(await db.readings.count()).toBe(1);
    expect((await db.parameters.get('hr'))?.name).toBe('Heart rate');
  });

  it('upgrades a v1 backup on import', async () => {
    const v1 = {
      app: 'medicine-adjuster', schemaVersion: 1, exportedAt: '2026-10-02T10:00:00.000Z',
      data: {
        parameters: V1_PARAMETERS, symptoms: V1_SYMPTOMS, slots: [], medications: [], regimens: [], symptomEntries: [], doseEvents: [],
        readings: [{ id: 'r1', parameterId: 'rr', values: { value: 16 }, takenAt: '2026-10-01T06:00:00.000Z', tags: [] }],
        settings: [{ ...DEFAULT_SETTINGS }],
      },
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.schemaVersion).toBe(2);
    await restoreBackup(db, parsed);
    expect(await db.readings.count()).toBe(1);
    expect((await db.parameters.get('rr'))?.archived).toBe(true);
    expect((await db.parameters.get('weight'))?.archived).toBe(false);
    expect((await db.symptoms.get('nausea'))?.type).toBe('scale');
  });

  it.each([
    ['not json', /not valid JSON/],
    ['{"app":"other"}', /not a Health Tracker backup/],
    ['{"app":"medicine-adjuster","schemaVersion":9}', /Unsupported backup version 9/],
    ['{"app":"medicine-adjuster","schemaVersion":2,"data":{}}', /missing "parameters"/],
  ])('rejects %s', (text, message) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(message);
  });

  it('names files by local date and time', () => {
    expect(backupFilename(new Date(2026, 9, 2, 9, 5))).toBe('health-tracker-2026-10-02-0905.json');
  });
});

describe('plausibility', () => {
  it('flags typos without blocking normal values', () => {
    expect(isPlausible('bp', 'sys', 128)).toBe(true);
    expect(isPlausible('bp', 'sys', 1280)).toBe(false);
    expect(isPlausible('hr', 'value', 20)).toBe(false);
    expect(isPlausible('weight', 'value', 80)).toBe(true);
    expect(isPlausible('weight', 'value', 820)).toBe(false);
    expect(isPlausible('custom-id', 'value', 99999)).toBe(true);
  });

  it.each([
    ['bp', 'sys', '12', false], ['bp', 'sys', '120', true], ['bp', 'sys', '95', true],
    ['bp', 'dia', '8', false], ['bp', 'dia', '80', true], ['hr', 'value', '72', true], ['hr', 'value', '11', false],
    ['spo2', 'value', '9', false], ['spo2', 'value', '97', true], ['rr', 'value', '16', true],
    ['weight', 'value', '82', false], ['custom', 'value', '123', false],
  ])('%s.%s "%s" advances: %s', (p, c, raw, expected) => {
    expect(autoAdvanceDigits(p, c, raw)).toBe(expected);
  });
});
