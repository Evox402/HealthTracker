# SPEC: MedicineAdjuster

Technical specification for the MVP described in `meta/PRD.md`. It is the single source of truth for data shapes and engine behaviour, and the UI and the engine are both built against it.

---

## 1. Architecture

```
┌──────────────────────── Browser (Android Chrome, installed PWA) ───────────────────────┐
│  React UI (screens)  ──reads/writes──▶  Dexie (IndexedDB)                              │
│        │                                     │                                         │
│        └──── buildSnapshot(db, now) ─────────┘                                         │
│                       │                                                                │
│                       ▼                                                                │
│           runEngine(snapshot) — pure TS, no I/O, deterministic                         │
│                       │                                                                │
│                       ▼                                                                │
│        { redFlags, insights, changeEvaluations, slotStats }  → UI renders              │
│                                                                                        │
│  Service worker (vite-plugin-pwa / Workbox): precache app shell, fully offline         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **The engine is a pure function.** Its input is `EngineSnapshot` (plain data) and its output is `EngineResult`. It has no Dexie, no `Date.now()` (`now` is part of the snapshot) and no randomness. This makes it fully unit-testable and lets the engine be built in parallel with the UI.
- **Nothing derived is stored.** Insights are recomputed on every data change (cheap: at most a few thousand rows). Only `dismissedInsightKeys` is persisted.

---

## 2. Domain concepts

| Concept | Meaning |
|---|---|
| **Parameter** | A measured vital with one or more components and a target range per component. BP has components `sys` and `dia`. |
| **Symptom** | A subjective 0–10 score with an alert threshold (score **>** threshold = above threshold). |
| **Slot** | A named part of the day defined by `startHour` (inclusive). A slot ends where the next one starts, wrapping past midnight. |
| **Drug** | A library entry with approximate pharmacokinetics/dynamics (PK/PD) used for timing reasoning. |
| **Medication** | The user's medication: a drug reference or a custom entry, plus a unit. |
| **Regimen version** | An immutable set of `{medicationId, slotId, amount}` valid from `effectiveFrom` until the next version's `effectiveFrom`. |
| **Dose event** | What actually happened for one planned dose (taken / skipped / changed) or an extra unplanned dose. |
| **Reading** | One measurement of a parameter at a timestamp, with optional context tags. |

---

## 3. Types (`src/lib/types.ts`)

```ts
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
```

---

## 4. Storage (`src/lib/db.ts`)

Dexie database `medicine-adjuster`, version 1:

```ts
db.version(1).stores({
  parameters:     'id, order',
  symptoms:       'id, order',
  slots:          'id, order',
  medications:    'id, libraryId',
  regimens:       'id, effectiveFrom',
  readings:       'id, parameterId, takenAt',
  symptomEntries: 'id, symptomId, takenAt',
  doseEvents:     'id, medicationId, takenAt, slotId',
  settings:       'id',
});
```

- **First launch:** `seed.ts` inserts the default parameters, symptoms, slots and settings in one transaction, but only if `settings` is empty.
- **Persistence:** call `navigator.storage.persist()` after the disclaimer is accepted, and show the result in Settings.
- **Drug library:** shipped as a static TS module (`src/engine/drugLibrary.ts`), not stored in the DB. App updates can then correct its values.
- **Migrations:** every schema change bumps the Dexie version with an `upgrade()` function. Never drop user data.

### Defaults (`src/lib/seed.ts`)

Ranges are general post-cardiac-surgery starting points. The user **must** replace them with the targets set by their care team (onboarding prompts for this).

| Parameter | Component | Target | Red flag |
|---|---|---|---|
| Blood pressure (mmHg) | sys | 100–130 | ≤ 90 or ≥ 180 |
| | dia | 60–80 | ≥ 110 |
| Heart rate (bpm) | value | 60–90 | ≤ 45 or ≥ 130 |
| SpO₂ (%) | value | 94–100 | ≤ 90 |
| Respiratory rate (/min) | value | 12–20 | ≤ 8 or ≥ 25 |

| Symptom | Threshold | Red flag |
|---|---|---|
| Chest pain | 2 | ≥ 7 |
| Nausea | 3 | — |
| Exhaustion | 4 | — |
| Sluggishness | 4 | — |
| Back pain | 3 | — |

| Slot | startHour | defaultTime |
|---|---|---|
| Morning | 5 | 08:00 |
| Noon | 11 | 12:00 |
| Evening | 17 | 18:00 |
| Night | 21 | 22:00 |

### Slot assignment (`src/lib/slots.ts`)
`slotFor(date, slots)`: sort slots by `startHour`. The chosen slot is the last one whose `startHour <= localHour`. If none qualifies (e.g. 03:00), the slot is the last slot of the previous day (Night). This uses **local** time.
The "day" of a Night reading taken after midnight belongs to the previous calendar date. `dayKey()` handles this so per-day grouping is correct.

---

## 5. Insights engine (`src/engine/`)

### 5.1 Principles
1. **Transparent.** Each insight lists the exact readings and doses that produced it, and its `explanation` contains the numbers.
2. **No prescribing.** `discussionPoint` describes *options to discuss* (e.g. "an earlier or split dose", "a longer-acting formulation"). It never contains a dose amount or an instruction to change anything without the care team. Unit tests assert that discussion points contain no `\d+\s?(mg|g|ml)` pattern.
3. **Evidence-aware.** Large trials (TIME 2022; BedMed / BedMed-Frail 2024; meta-analysis 2025) found no outcome benefit from routinely moving once-daily antihypertensives to bedtime. The engine therefore never suggests a time shift **without data**. Suggestions come only from the user's own out-of-range pattern relative to dose coverage.
4. **Slow drugs are special.** For drugs with `timingSensitive: false` (amiodarone, digoxin), intraday timing reasoning is skipped, and change evaluations stay `too_early` until `steadyStateDays` have passed.
5. **Red flags first.** If any red flag exists in the last 24 h, the UI shows the banner above everything else. The engine still computes insights.

### 5.2 Preprocessing
- **Window:** readings, symptoms and doses within `analysisWindowDays` before `now`, **and** within the current regimen version's period (for R1–R7). Change evaluation (R5) uses its own windows.
- **Exclusions:** readings with any tag in `excludeTags` are excluded from pattern rules but counted and reported ("2 readings after activity excluded").
- **Component status:** `below` if `< targetMin`, `above` if `> targetMax`, otherwise `in`.
- **Effective PK:** `library entry ⊕ medication.pkOverride`. A custom medication with no PK data is treated as `timingSensitive: false` (it is skipped by timing rules, and the UI hints that onset/duration can be added).
- **Coverage of a timestamp t for medication m:** take the most recent `taken|changed|extra` dose event of m before t, and let `h = hours(t − dose.takenAt)`.
  - `pre_onset` if `h < onsetH`
  - `peak` if `|h − peakH| ≤ max(1, 0.25·durationH)`
  - `covered` if `h ≤ durationH`
  - `wearing_off` if `durationH < h ≤ durationH + 6`
  - `uncovered` otherwise, or when there is no dose.
- **Relevant medications for a parameter:** medications whose effective `affects` include the parameter kind and are `timingSensitive`.

### 5.3 Confidence
Based on `n`, the number of supporting non-excluded readings that match the pattern:

| n | Confidence |
|---|---|
| 2–3 | low |
| 4–6 | medium |
| ≥ 7 | high |

Confidence drops one level if the data spans fewer than 2 distinct days. `score = severityWeight × {low:1, medium:2, high:3}`, where severity is 1 for mild out-of-range and 2 if any supporting value is more than 15 % outside the target bound.

### 5.4 Rules

**R0 — Red flags** (`redFlags.ts`)
Any reading component at or beyond `redFlagMin/Max`, or any symptom score ≥ `redFlagAt`, within the last 24 h → `RedFlag`. Message template: "{value} is {below|above} {limit}. Contact your care team now." No insight wording.

**R1 — Slot out of range** (`rules/slotOutOfRange.ts`)
For each (parameter, component, slot, direction): if `n_out ≥ 2` and `n_out / n_total ≥ 0.5` → insight.
- Title: "Systolic BP above range in the Morning"
- Explanation: "5 of 6 morning readings (83 %) were above 130 mmHg (mean 142)."
- Discussion: "Morning systolic is consistently high. Worth asking whether current coverage of the morning hours is sufficient."

**R2 — End-of-dose / wearing off** (`rules/endOfDose.ts`)
For each above-range pattern from R1 on a parameter that has relevant medications: classify each out-of-range reading by coverage for each relevant medication. If ≥ 60 % of the out-of-range readings are `wearing_off|uncovered` for medication m, **and** the in-range readings in the window are mostly (≥ 60 %) `covered|peak` for m → `end_of_dose` insight for m. It supersedes the R1 insight with the same key prefix, and R1's evidence is merged.
- Explanation: "Morning HR above range in 4 of 5 readings. These were taken on average 15 h after the last metoprolol tartrate dose, beyond its approx. 12 h duration. Readings within 12 h of a dose were in range in 7 of 8 cases."
- Discussion: "The pattern fits the effect wearing off before the next dose. Options to discuss: an earlier morning dose, splitting the daily amount into more doses, or a longer-acting formulation."

**R3 — Uncovered slot** (`rules/uncoveredSlot.ts`)
If slot S has an above-range pattern (R1) for parameter p, the current regimen has **no** dose of any relevant medication in S, and at ≥ 60 % of the out-of-range readings **every** relevant medication is `wearing_off|uncovered` → `uncovered_slot`. At least one dose must have been logged; otherwise R1 stays.
- The explanation names the relevant medication whose last dose is most recent on average, and the slot that dose was usually taken in.
- **Suggested slot:** the slot just before S in daily order, if it has no relevant dose and isn't where the last dose was taken. Otherwise the option is "an additional dose in S".
- This handles the issue's example. Suppose BP is high in the Morning and at Noon, a short-acting drug is taken only in the Evening, and Night has no dose. The engine reports that the gap exceeds the drug's duration. The Morning discussion point is: "Morning coverage may be insufficient. Options to discuss: a dose at Night (for example by splitting the Evening dose), or a longer-acting drug." The Noon one suggests a Morning dose.

**R1 pre-onset note:** if, at ≥ 60 % of an above-range pattern's readings, a relevant medication had been taken less than its onset time earlier, R1's explanation adds "At most of these readings the last {drug} dose had been taken less than {onset} earlier and had likely not reached its effect yet." 

**R4 — Peak-effect low** (`rules/peakLow.ts`)
If below-range readings (low BP, bradycardia) cluster with ≥ 60 % at `peak` coverage of medication m (n ≥ 2) → `peak_low`. If symptoms above threshold for exhaustion/sluggishness occur in the same slot on the same days, add them as evidence.
- Discussion: "Lows cluster around the expected peak of {drug}. Options to discuss: splitting the dose into smaller, more frequent doses, or separating it in time from other BP/HR-lowering drugs taken in the same slot."
- A below-range R1 pattern whose readings are all part of a `peak_low` insight is dropped (the peak explains it). Symptom entries attached here are not reported again by R6.

**R5 — Regimen change evaluation** (`rules/changeEvaluation.ts`)
For each regimen version after the first:
- `diff` = items added, removed or changed vs. the previous version.
- `judgeableFrom` = `effectiveFrom + max(steadyStateDays of changed drugs)`. The default is 1 day for timing-sensitive drugs with half-life ≤ 12 h. In general it is `ceil(5 × halfLifeH / 24)` days, capped by the library value.
- If `now < judgeableFrom` → `too_early`. Summary: "Changed 2 days ago; amiodarone needs about 2–3 weeks before its effect can be judged."
- **Before window:** previous version period, last `analysisWindowDays` days of it. **After window:** from `judgeableFrom` to the next version or `now`.
- Per (parameter, component, slot): if both sides have n ≥ 2, compare `inRangePct`. A change of ≥ 20 percentage points is `improved` or `worse`; otherwise `unchanged`. Below n = 2 the verdict is `unknown`. If all verdicts are unknown, the status is `insufficient_data`.
- Summary example: "Since Sat 3 Oct (Bisoprolol 2.5 → 5 mg, morning): morning heart rate in range 20 % → 80 %." Slots that changed (improved/worse) are listed; if none did, the unchanged ones are.

**R6 — Symptom link** (`rules/symptomLink.ts`)
For each symptom with ≥ 2 above-threshold entries in the window: if ≥ 60 % of them fall in the same slot on the same day as an out-of-range reading (e.g. exhaustion with low BP/HR), **or** within the `peak` window of a timing-sensitive medication in the current regimen → `symptom_link`. The title names the most frequent link ("Nausea often coincides with heart rate below range").
Chest pain is never "explained" by this rule. It only ever produces a red flag or a neutral "Chest pain above threshold 3 times this week — mention to the care team" insight.

**R7 — Missed dose** (`rules/missedDose.ts`)
For out-of-range readings where the most recent planned dose of a relevant medication in the preceding 24 h was `skipped`, or `changed` to a lower amount → `missed_dose`. These readings are then **excluded** from all pattern rules (R1–R4, R6 links) so a skipped dose isn't mistaken for a regimen problem. The explanation names the skipped dose and the readings after it.

### 5.5 Insight dedupe and ordering
- One insight per pattern (parameter, component, slot, direction). Priority when they collide: R3 > R2 > R1; the winner keeps the merged evidence. R7 removes its readings from the others beforehand.
- The same R1–R3 pattern on several components of one parameter (systolic and diastolic BP) becomes **one** insight, led by the component with the higher score (ties: the first component). Its explanation adds "Diastolic BP was also above range in 5 of 5 readings."
- Red flags are sorted by time, then component order, readings before symptoms.
- Insights are sorted by `score` desc, then by most recent evidence.
- Dismissed keys are hidden by the UI. A dismissed insight reappears if its confidence increases (`key + confidence` is stored).

### 5.6 Drug library (`src/engine/drugLibrary.ts`)
Approximate values for **pattern reasoning only**, shown in the UI with "approx. — verify with your pharmacist". Sources: product information / standard references. They are summarised here and must be double-checked when implementing.

| id | Name | Class | Affects | Onset h | Peak h | Duration h | t½ h | Timing-sensitive | Steady-state days |
|---|---|---|---|---|---|---|---|---|---|
| metoprolol_tartrate | Metoprolol tartrate (IR) | beta_blocker | hr, bp | 1 | 1.5 | 12 | 3.5 | ✓ | 1 |
| metoprolol_succinate | Metoprolol succinate (ER) | beta_blocker | hr, bp | 2 | 7 | 24 | 5 | ✓ | 2 |
| bisoprolol | Bisoprolol | beta_blocker | hr, bp | 2 | 3 | 24 | 11 | ✓ | 3 |
| carvedilol | Carvedilol | beta_blocker | hr, bp | 1 | 1.5 | 12 | 8 | ✓ | 2 |
| nebivolol | Nebivolol | beta_blocker | hr, bp | 1.5 | 3 | 24 | 12 | ✓ | 3 |
| ramipril | Ramipril | ace_inhibitor | bp | 1.5 | 4.5 | 24 | 13 | ✓ | 3 |
| lisinopril | Lisinopril | ace_inhibitor | bp | 1 | 6.5 | 24 | 12 | ✓ | 3 |
| enalapril | Enalapril | ace_inhibitor | bp | 1 | 5 | 18 | 11 | ✓ | 3 |
| candesartan | Candesartan | arb | bp | 2 | 7 | 24 | 9 | ✓ | 3 |
| valsartan | Valsartan | arb | bp | 2 | 5 | 24 | 6 | ✓ | 2 |
| losartan | Losartan | arb | bp | 1 | 6 | 24 | 7 | ✓ | 3 |
| ivabradine | Ivabradine | if_inhibitor | hr | 1 | 1 | 12 | 11 (effective) | ✓ | 2 |
| diltiazem_ir | Diltiazem (IR) | rate_control_ccb | hr, bp | 0.5 | 3 | 7 | 4 | ✓ | 1 |
| verapamil_ir | Verapamil (IR) | rate_control_ccb | hr, bp | 1 | 2 | 7 | 6 | ✓ | 2 |
| amlodipine | Amlodipine | dhp_ccb | bp | 6 | 8 | 24 | 40 | ✗ | 8 |
| amiodarone | Amiodarone | antiarrhythmic | hr | — | — | — | ~50 days | ✗ | 21 |
| digoxin | Digoxin | cardiac_glycoside | hr | 1 | 4 | 24 | 40 | ✗ | 7 |
| furosemide | Furosemide | diuretic | bp | 1 | 1.5 | 6 | 1.5 | ✓ | 1 |
| torasemide | Torasemide | diuretic | bp | 1 | 2 | 12 | 3.5 | ✓ | 1 |
| spironolactone | Spironolactone | diuretic | bp | 24 | 72 | 72 | 20 (metabolites) | ✗ | 7 |

(For non-timing-sensitive drugs the onset/peak/duration are stored as `0` and ignored.)

### 5.7 Required engine test scenarios (`src/engine/__tests__/`)
Each test uses a fixture builder (`fixtures.ts`) with a fixed `now`.
1. **Issue example:** metoprolol tartrate (approx. 12 h) in the Evening only, systolic above range in the Morning and at Noon on 5 days, in range in the Evening and at Night. Expect R3 `uncovered_slot` for Morning (suggesting a Night dose) and Noon (suggesting a Morning dose) with medium+ confidence. (A 24 h drug like bisoprolol would still cover the morning, so it can't produce this pattern.)
2. **Wearing off:** metoprolol tartrate at 08:00 and 18:00; HR above range at 07:00 (13 h after the evening dose) but in range at 10:00, 14:00 and 21:00. Expect R2, not R3 (the Morning slot has a dose).
3. **Peak low:** carvedilol at 08:00 and SBP below 100 at 09:30 on 3 days. Expect R4 with exhaustion evidence.
4. **Regimen change improved:** HR morning in range 1/5 before and 4/5 after (bisoprolol 2.5 → 5). Expect `evaluated`, `improved`.
5. **Amiodarone change 3 days ago:** expect `too_early` with judgeableFrom ≈ +21 days.
6. **Missed dose:** a skipped morning dose followed by high noon BP. Expect R7, and no R1 for noon if that was the only out-of-range reading.
7. **Excluded tags:** above-range readings tagged `after_activity` do not trigger R1.
8. **Red flag:** HR 41 → RedFlag, regardless of other rules.
9. **Night after midnight:** a reading at 01:30 is assigned to Night of the previous day.
10. **Empty DB:** `runEngine` returns empty arrays without throwing.
11. **No prescribing:** across all fixture outputs, no `discussionPoint` matches `/\d+(\.\d+)?\s?(mg|g|ml|mcg|µg)/i`.

---

## 6. UI routes (`src/App.tsx`, HashRouter)

| Route | Screen | Component |
|---|---|---|
| `#/welcome` | Onboarding & disclaimer (shown until accepted) | `components/onboarding/Welcome.tsx` |
| `#/` | Today | `components/today/TodayScreen.tsx` |
| `#/log/:slotId?` | Quick log (full-screen sheet) | `components/log/QuickLogSheet.tsx` |
| `#/trends/:parameterId?` | Trends | `components/trends/TrendsScreen.tsx` |
| `#/insights` | Insights + change evaluations | `components/insights/InsightsScreen.tsx` |
| `#/regimen` | Current regimen, history, change flow | `components/regimen/RegimenScreen.tsx` |
| `#/medications` | Medication list + add | `components/medications/MedicationsScreen.tsx` |
| `#/settings` | Parameters, symptoms, slots, red flags, backup, theme | `components/settings/SettingsScreen.tsx` |
| `#/doctor` | Doctor view / print | `components/doctor/DoctorView.tsx` |

Data access in components goes through hooks in `src/hooks/` (`useLiveQuery` from dexie-react-hooks). `useEngine()` builds the snapshot and memoises `runEngine` on data changes.

---

## 7. Quick log behaviour (< 30 s budget)
- When opened, the slot is the one for `now`; the time defaults to `now` and can be edited with ±15 min chips plus a picker.
- Field order: SYS → DIA → HR → SpO₂ → RR. `inputmode="numeric"`. Auto-advance happens when the value has the expected digit count (SYS/DIA: 2–3 digits after a plausibility check, HR: 2–3, SpO₂: 2, RR: 2).
- Plausibility bounds reject typos without blocking: SYS 50–260, DIA 30–160, HR 25–250, SpO₂ 50–100, RR 4–60. An out-of-bounds value shows "Check value". It can still be saved after a confirm.
- Symptoms: all sliders default to "not recorded". A slider is only saved when touched. "No symptoms" sets all to 0 in one tap.
- Doses: the checklist comes from the current regimen for the slot. "All taken" records every item as `taken` at the log time. Per item: taken / skipped / changed (amount input). "+ extra dose" logs an unplanned dose.
- Save writes everything in one Dexie transaction, shows a toast with an undo action (5 s), and returns to Today.

---

## 8. Backup format (`src/lib/backup.ts`)
```json
{
  "app": "medicine-adjuster",
  "schemaVersion": 1,
  "exportedAt": "2026-10-02T10:00:00.000Z",
  "data": { "parameters": [], "symptoms": [], "slots": [], "medications": [],
            "regimens": [], "readings": [], "symptomEntries": [], "doseEvents": [], "settings": [] }
}
```
- Export filename: `medicine-adjuster-YYYY-MM-DD-HHmm.json`, downloaded via a Blob link.
- Import validates `app`, `schemaVersion` and array shapes, shows counts, and asks for confirmation, then **replaces** all tables in one transaction. Before the import it auto-exports the current DB as a safety copy.
- Settings shows "Last backup: x days ago". Today shows a gentle nudge if it was more than 3 days ago.

---

## 9. Doctor view / PDF
- A solid (non-glass) high-contrast layout, also used for `@media print` (A4 portrait, 1 page target).
- Sections: header (period, generated at) → current regimen table (slot × medication) → regimen change log with evaluation summaries → per-parameter compact SVG chart with target band and change markers (last 7 days) → per-slot in-range table → top 5 insights (title + explanation; discussion points worded neutrally) → footer disclaimer.
- The "Print / Save as PDF" button calls `window.print()`.

---

## 10. PWA & deployment
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`, precaching all build assets. App shell works offline from the first load.
- `manifest.json`: name "MedicineAdjuster", short_name "MedAdjust", `display: standalone`, theme colour = `--bg` dark, icons 192/512 + maskable.
- `vite.config.ts` uses `base: '/MedicineAdjuster/'`. HashRouter avoids GitHub Pages 404s on deep links.
- `.github/workflows/deploy.yml`: on push to `main`, run `npm ci`, `npm run typecheck`, `npm test` and `npm run build`, then upload the Pages artifact and deploy.

---

## 11. Folder structure

```
MedicineAdjuster/
├── CLAUDE.md                     # Claude Code project instructions
├── README.md
├── .claude/
│   └── settings.json             # permissions for npm/vitest/playwright/git
├── .github/workflows/deploy.yml  # typecheck + test + build + GitHub Pages
├── meta/
│   ├── PRD.md
│   ├── SPEC.md                   # this file
│   ├── claude-design/            # paste-ready Claude Design pack (01–05 + README)
│   └── IMPLEMENTATION_PLAN.md
├── design/mockups/               # approved mockup canvas sources (.dc.html), the visual reference
├── public/
│   ├── manifest.json
│   └── icons/                    # 192, 512, maskable
├── e2e/                          # Playwright specs (quick-log timing, backup round-trip)
├── src/
│   ├── main.tsx
│   ├── App.tsx                   # routes + layout + bottom nav
│   ├── styles/globals.css        # theme tokens, glass, print styles
│   ├── lib/
│   │   ├── types.ts              # §3 — shared by UI and engine
│   │   ├── db.ts                 # Dexie schema
│   │   ├── seed.ts               # defaults (§4)
│   │   ├── mockData.ts           # demo data for design/dev
│   │   ├── slots.ts              # slotFor(), dayKey()
│   │   ├── snapshot.ts           # buildSnapshot(db, now)
│   │   └── backup.ts             # export/import (§8)
│   ├── engine/
│   │   ├── index.ts              # runEngine(snapshot): EngineResult
│   │   ├── drugLibrary.ts        # §5.6
│   │   ├── preprocess.ts         # window, exclusions, status, effective PK
│   │   ├── coverage.ts           # coverage classification (§5.2)
│   │   ├── confidence.ts
│   │   ├── redFlags.ts           # R0
│   │   ├── rules/
│   │   │   ├── slotOutOfRange.ts # R1
│   │   │   ├── endOfDose.ts      # R2
│   │   │   ├── uncoveredSlot.ts  # R3
│   │   │   ├── peakLow.ts        # R4
│   │   │   ├── changeEvaluation.ts # R5
│   │   │   ├── symptomLink.ts    # R6
│   │   │   └── missedDose.ts     # R7
│   │   ├── text.ts               # wording templates (no-prescribing guard)
│   │   └── __tests__/            # fixtures.ts + one spec per rule + scenarios (§5.7)
│   ├── hooks/                    # useDb queries, useEngine, useCurrentSlot
│   └── components/
│       ├── ui/                   # shadcn/ui primitives
│       ├── charts/               # SVG TrendChart, RangeBand, Sparkline
│       ├── onboarding/
│       ├── today/
│       ├── log/
│       ├── trends/
│       ├── insights/
│       ├── regimen/
│       ├── medications/
│       ├── settings/
│       └── doctor/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── playwright.config.ts
```
