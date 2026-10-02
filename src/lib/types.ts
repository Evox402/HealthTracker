// Mirrors meta/SPEC.md §3. If a type changes, update SPEC in the same commit.

export type ID = string;          // crypto.randomUUID()
export type ISODateTime = string; // new Date().toISOString()

// ---------- configuration ----------
export interface ParameterComponent {
  key: string;            // 'value' for single-value params; 'sys' | 'dia' for BP
  label: string;          // 'Systolic'
  targetMin: number;
  targetMax: number;
  redFlagMin?: number;    // at or below → red flag
  redFlagMax?: number;    // at or above → red flag
}

export type ParameterKind = 'bp' | 'hr' | 'spo2' | 'rr' | 'custom';

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

export interface SymptomDef {
  id: ID;
  name: string;           // 'Chest pain'
  threshold: number;      // 0–10; score > threshold is "above threshold"
  redFlagAt?: number;     // score >= redFlagAt → red flag (chest pain: 7)
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
export type DrugClass =
  | 'beta_blocker' | 'ace_inhibitor' | 'arb' | 'antiarrhythmic'
  | 'rate_control_ccb' | 'dhp_ccb' | 'diuretic' | 'if_inhibitor' | 'cardiac_glycoside' | 'other';

export interface DrugPK {
  onsetH: number;         // time to first effect
  peakH: number;          // time to maximum effect
  durationH: number;      // clinically relevant duration of effect for one dose
  halfLifeH: number;
  timingSensitive: boolean; // false → intraday timing irrelevant (amiodarone, digoxin)
  steadyStateDays: number;  // days until a dose change can be judged
}

export interface DrugLibraryEntry extends DrugPK {
  id: string;             // 'bisoprolol'
  name: string;
  class: DrugClass;
  affects: ParameterKind[]; // which parameters it lowers, e.g. ['hr','bp']
  typicalUnit: DoseUnit;
  notes: string;          // short, e.g. 'Tartrate = immediate release, usually twice daily'
}

export interface Medication {
  id: ID;
  name: string;
  libraryId: string | null;     // null = custom
  unit: DoseUnit;
  pkOverride?: Partial<DrugPK>; // user-provided or custom values
  affectsOverride?: ParameterKind[];
  archived: boolean;
}

export interface RegimenItem {
  medicationId: ID;
  slotId: ID;
  amount: number;
}

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
  tags: ContextTag[];
}

export interface SymptomEntry {
  id: ID;
  symptomId: ID;
  score: number;          // integer 0–10
  takenAt: ISODateTime;
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
  analysisWindowDays: number;      // default 7
  excludeTags: ContextTag[];       // default ['after_activity']
  dismissedInsightKeys: string[];
}

// ---------- engine I/O ----------
export interface EngineSnapshot {
  now: ISODateTime;
  parameters: ParameterDef[];
  symptoms: SymptomDef[];
  slots: SlotDef[];
  medications: Medication[];
  drugLibrary: DrugLibraryEntry[];
  regimens: RegimenVersion[];   // sorted by effectiveFrom asc
  readings: Reading[];
  symptomEntries: SymptomEntry[];
  doseEvents: DoseEvent[];
  settings: Pick<AppSettings, 'analysisWindowDays' | 'excludeTags'>;
}

export type Confidence = 'low' | 'medium' | 'high';
export type Direction = 'above' | 'below';

export type InsightType =
  | 'slot_out_of_range'   // R1
  | 'end_of_dose'         // R2
  | 'uncovered_slot'      // R3
  | 'peak_low'            // R4
  | 'symptom_link'        // R6
  | 'missed_dose';        // R7

export interface EvidenceRef {
  kind: 'reading' | 'symptom' | 'dose';
  id: ID;
}

export interface Insight {
  key: string;            // stable dedupe key: `${type}:${parameterId}:${component}:${slotId}:${direction}`
  type: InsightType;
  parameterId?: ID;
  component?: string;
  slotId?: ID;
  medicationId?: ID;
  direction?: Direction;
  confidence: Confidence;
  title: string;          // 'Systolic BP above range in the morning'
  explanation: string;    // facts only, with numbers
  discussionPoint: string;// phrased as a question/option for the care team, never a mg number
  evidence: EvidenceRef[];
  score: number;          // for sorting: severity × confidence
}

export interface RedFlag {
  key: string;
  source: 'reading' | 'symptom';
  refId: ID;
  title: string;          // 'Heart rate 41 bpm'
  message: string;        // 'Below 45 bpm. Contact your care team now.'
  at: ISODateTime;
}

export interface SlotStat {
  parameterId: ID;
  component: string;
  slotId: ID;
  n: number;
  inRangePct: number;     // 0–100
  mean: number | null;
}

export interface ChangeEvaluation {
  regimenVersionId: ID;
  effectiveFrom: ISODateTime;
  note: string;
  diff: { medicationId: ID; slotId: ID; from: number | null; to: number | null }[];
  status: 'too_early' | 'insufficient_data' | 'evaluated';
  judgeableFrom: ISODateTime;     // effectiveFrom + max steadyStateDays of changed drugs
  perSlot: {
    parameterId: ID; component: string; slotId: ID;
    before: { n: number; inRangePct: number; mean: number | null };
    after:  { n: number; inRangePct: number; mean: number | null };
    verdict: 'improved' | 'worse' | 'unchanged' | 'unknown';
  }[];
  summary: string;
}

export interface EngineResult {
  redFlags: RedFlag[];
  insights: Insight[];            // sorted by score desc, dismissed filtered by UI
  changeEvaluations: ChangeEvaluation[];
  slotStats: SlotStat[];          // current regimen period, analysis window
}
