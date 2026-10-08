// Mirrors meta/SPEC.md §3. If a type changes, update SPEC in the same commit.

export type ID = string;          // crypto.randomUUID()
export type ISODateTime = string; // new Date().toISOString()

// ---------- configuration ----------
export interface ParameterComponent {
  key: string;            // 'value' for single-value params; 'sys' | 'dia' for BP
  label: string;          // 'Systolic'
  targetMin?: number;     // no target → no band and no status
  targetMax?: number;
  redFlagMin?: number;    // at or below → red flag
  redFlagMax?: number;    // at or above → red flag
}

export type ParameterKind = 'bp' | 'hr' | 'spo2' | 'rr' | 'weight' | 'custom';

export interface ParameterDef {
  id: ID;
  kind: ParameterKind;
  name: string;           // 'Blood pressure'
  unit: string;           // 'mmHg'
  decimals: number;       // 0
  components: ParameterComponent[];
  order: number;
  archived: boolean;
}

/** scale: 0–10 score · stool: Bristol type 1–7 · event: happened (score 1) + note */
export type SymptomType = 'scale' | 'stool' | 'event';

export interface SymptomDef {
  id: ID;
  name: string;           // 'Chest pain'
  type: SymptomType;
  threshold: number;      // scale only: 0–10; score > threshold is "above threshold"
  redFlagAt?: number;     // scale only: score >= redFlagAt → red flag (chest pain: 7)
  order: number;
  archived: boolean;
}

export interface SlotDef {
  id: ID;                 // 'morning' | 'noon' | 'evening' | 'night' (stable ids for defaults)
  name: string;
  startHour: number;      // 0–23, inclusive; slot ends at next slot's startHour
  defaultTime: string;    // 'HH:mm', suggested dose/measurement time
  order: number;
}

// ---------- medications ----------
export type DoseUnit = 'mg' | 'g' | 'ml' | 'pill' | 'piece' | 'drop' | 'scoop';

export interface Medication {
  id: ID;
  name: string;
  unit: DoseUnit;
  /** v1 data only (drug library / timing), no longer used. */
  libraryId?: string | null;
  pkOverride?: Record<string, number | boolean>;
  affectsOverride?: ParameterKind[];
  archived: boolean;
}

export interface RegimenItem {
  medicationId: ID;
  slotId: ID;
  amount: number;
}

/** The med stack: the current version is the stack; edits create a new version so dose history stays correct. */
export interface RegimenVersion {
  id: ID;
  effectiveFrom: ISODateTime;
  items: RegimenItem[];
  note: string;           // 'Dr. X: bisoprolol 2.5 → 5 mg'
  createdAt: ISODateTime;
}

// ---------- log ----------
export type ContextTag = 'resting' | 'after_activity' | 'lying' | 'standing';

export interface Reading {
  id: ID;
  parameterId: ID;
  values: Record<string, number>; // { sys: 142, dia: 88 } or { value: 72 }
  takenAt: ISODateTime;
  tags: ContextTag[];     // v1 data; no longer set by the UI
  note?: string;
}

export interface SymptomEntry {
  id: ID;
  symptomId: ID;
  score: number;          // scale: 0–10 · stool: Bristol 1–7 · event: 1
  takenAt: ISODateTime;
  note?: string;
}

export type DoseStatus = 'taken' | 'skipped' | 'changed' | 'extra';

export interface DoseEvent {
  id: ID;
  medicationId: ID;
  regimenVersionId: ID | null; // null for 'extra'
  slotId: ID;
  plannedAmount: number | null;
  actualAmount: number;        // 0 when skipped
  status: DoseStatus;
  takenAt: ISODateTime;        // actual intake time (for skipped: the planned time)
}

// ---------- settings ----------
export interface AppSettings {
  id: 'settings';
  disclaimerAcceptedAt: ISODateTime | null;
  theme: 'dark' | 'light' | 'system';
  /** @deprecated v1 insights engine; kept so old data and backups stay valid. */
  analysisWindowDays: number;
  /** @deprecated v1 insights engine. */
  excludeTags: ContextTag[];
  /** @deprecated v1 insights engine. */
  dismissedInsightKeys: string[];
  lastBackupAt: ISODateTime | null;
}

// ---------- engine I/O ----------
// The engine only computes red flags (SPEC §5).
export interface EngineSnapshot {
  now: ISODateTime;
  parameters: ParameterDef[];
  symptoms: SymptomDef[];
  readings: Reading[];
  symptomEntries: SymptomEntry[];
}

export type Direction = 'above' | 'below';

export interface RedFlag {
  key: string;
  source: 'reading' | 'symptom';
  refId: ID;
  title: string;          // 'Heart rate 41 bpm'
  message: string;        // 'Below 45 bpm. Contact your care team now.'
  at: ISODateTime;
}

export interface EngineResult {
  redFlags: RedFlag[];
}
