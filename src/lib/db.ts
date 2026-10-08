import Dexie, { type Table } from 'dexie';
import { upgradeParameters, upgradeSymptoms } from './migrate';
import type {
  AppSettings, DoseEvent, Medication, ParameterDef, Reading, RegimenVersion, SlotDef, SymptomDef, SymptomEntry,
} from './types';

// IndexedDB schema (meta/SPEC.md §4). Every schema change needs a new
// version(n) with an upgrade() — never drop user data.

export class AppDB extends Dexie {
  parameters!: Table<ParameterDef, string>;
  symptoms!: Table<SymptomDef, string>;
  slots!: Table<SlotDef, string>;
  medications!: Table<Medication, string>;
  regimens!: Table<RegimenVersion, string>;
  readings!: Table<Reading, string>;
  symptomEntries!: Table<SymptomEntry, string>;
  doseEvents!: Table<DoseEvent, string>;
  settings!: Table<AppSettings, string>;

  constructor(name = 'medicine-adjuster') {
    super(name);
    this.version(1).stores({
      parameters: 'id, order',
      symptoms: 'id, order',
      slots: 'id, order',
      medications: 'id, libraryId',
      regimens: 'id, effectiveFrom',
      readings: 'id, parameterId, takenAt',
      symptomEntries: 'id, symptomId, takenAt',
      doseEvents: 'id, medicationId, takenAt, slotId',
      settings: 'id',
    });
    // v2: tracker pivot. Symptoms get a type, weight is added, SpO₂/RR archived.
    this.version(2).stores({}).upgrade(async (tx) => {
      const parameters = tx.table<ParameterDef, string>('parameters');
      const symptoms = tx.table<SymptomDef, string>('symptoms');
      await parameters.bulkPut(upgradeParameters(await parameters.toArray()));
      await symptoms.bulkPut(upgradeSymptoms(await symptoms.toArray()));
    });
  }

  get allTables() {
    return [
      this.parameters, this.symptoms, this.slots, this.medications, this.regimens,
      this.readings, this.symptomEntries, this.doseEvents, this.settings,
    ];
  }
}

export const db = new AppDB();

export const newId = () => crypto.randomUUID();
