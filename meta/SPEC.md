# SPEC: Health Tracker (repo: MedicineAdjuster)

Technical specification for the app described in `meta/PRD.md`. It is the single source of truth for data shapes and engine behaviour, and the UI and the engine are both built against it.

> **Pivot (8 Oct 2026):** the MVP shipped as "MedicineAdjuster", a regimen/PK insights engine. In practice only the tracking was used, so the app became a symptom & bio tracker: a med stack to tick off, vitals, custom trackers and charts. The insights engine, drug library and regimen history UI were removed; red flags stay. The repo name, Pages URL and IndexedDB name are unchanged so installed apps keep their data (database v1 → v2, §4).

---

## 1. Architecture

```
┌──────────────────────── Browser (Android Chrome, installed PWA) ───────────────────────┐
│  React UI (screens)  ──reads/writes──▶  Dexie (IndexedDB)                              │
│        │                                     │                                         │
│        └──── toSnapshot(data, now) ──────────┘                                         │
│                       │                                                                │
│                       ▼                                                                │
│           runEngine(snapshot) — pure TS, no I/O, deterministic                         │
│                       │                                                                │
│                       ▼                                                                │
│                 { redFlags }  → UI renders banners first                               │
│                                                                                        │
│  Service worker (vite-plugin-pwa / Workbox): precache app shell, fully offline         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **The engine is a pure function.** Input `EngineSnapshot`, output `EngineResult`. No Dexie, no `Date.now()` (`now` is part of the snapshot), no randomness.
- **Nothing derived is stored.** Red flags, chart points and summaries are recomputed on every data change.

---

## 2. Domain concepts

| Concept | Meaning |
|---|---|
| **Tracker** | Anything the user logs. Two storage kinds: a *parameter* (numeric) or a *symptom* (score/event). The UI treats both as one list (`lib/trackers.ts`, route kind `p` / `s`). |
| **Parameter** | A numeric tracker with one or more components and an optional target range per component. BP has components `sys` and `dia`. Kinds: `bp`, `hr`, `weight`, `spo2`, `rr`, `custom` ("number with unit"). |
| **Symptom** | A score/event tracker of type `scale` (0–10 with a threshold; score **>** threshold = above threshold), `stool` (Bristol type 1–7) or `event` (happened, score 1, with a note). |
| **Slot** | A named part of the day defined by `startHour` (inclusive). A slot ends where the next one starts, wrapping past midnight. Used for the med stack. |
| **Medication** | Name + unit. |
| **Med stack** | Which medications, how much, at which slot. Stored as immutable regimen versions: the current version *is* the stack; every edit creates a new version effective now, so past dose events keep the right planned amount. No version history is shown. |
| **Dose event** | What happened to one planned dose on one day: taken / skipped / changed (other amount). `extra` exists in v1 data only. |
| **Reading / symptom entry** | One logged value at a timestamp, with an optional note. |

---

## 3. Types (`src/lib/types.ts`)

```ts
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
```

---

## 4. Storage (`src/lib/db.ts`)

Dexie database `medicine-adjuster` (name kept for existing installs), version 2:

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
db.version(2).stores({}).upgrade(...); // no index changes, see below
```

- **v1 → v2 upgrade** (`lib/migrate.ts`, shared with v1 backup import): every symptom without a `type` becomes `scale`; the `weight` parameter is added (order 2, later parameters shift down); `spo2` and `rr` are archived. No rows are deleted. Readings of archived parameters stay and reappear when the parameter is shown again.
- **First launch:** `seed.ts` inserts the defaults in one transaction, only if `settings` is empty.
- **Persistence:** `navigator.storage.persist()` after the disclaimer; the result is shown in Settings.
- **Migrations:** every schema change bumps the Dexie version with an `upgrade()`. Never drop user data.

### Defaults (`src/lib/defaults.ts`)

Generic starting points. Onboarding offers to replace the ranges with the care team's targets (skippable).

| Parameter | Component | Target | Red flag | Shown |
|---|---|---|---|---|
| Blood pressure (mmHg) | sys | 100–130 | ≤ 90 or ≥ 180 | yes |
| | dia | 60–80 | ≥ 110 | |
| Heart rate (bpm) | value | 60–90 | ≤ 45 or ≥ 130 | yes |
| Weight (kg, 1 decimal) | value | — | — | yes |
| SpO₂ (%) | value | 94–100 | ≤ 90 | archived |
| Respiratory rate (/min) | value | 12–20 | ≤ 8 or ≥ 25 | archived |

| Symptom | Type | Threshold | Red flag |
|---|---|---|---|
| Chest pain | scale | 2 | ≥ 7 |
| Pain | scale | 3 | — |
| Stool | stool | — | — |

Existing (v1) installs keep their own symptoms (chest pain, nausea, exhaustion, …) as `scale` trackers.

| Slot | startHour | defaultTime |
|---|---|---|
| Morning | 5 | 08:00 |
| Noon | 11 | 12:00 |
| Evening | 17 | 18:00 |
| Night | 21 | 22:00 |

### Slot assignment (`src/lib/slots.ts`)
`slotFor(date, slots)`: the last slot whose `startHour <= localHour`; before the first slot (e.g. 03:00) it is the previous day's last slot (Night). **Local** time. `dayKey()` puts Night entries after midnight on the previous day, so "today's doses" stay correct after midnight.

---

## 5. Engine (`src/engine/`): red flags only

- `runEngine(snapshot)` returns `{ redFlags }`. Wording lives in `engine/text.ts`.
- **Readings:** for each non-archived parameter, each component value of a reading taken in the last 24 h (and not after `now`) that is `<= redFlagMin` or `>= redFlagMax` gives one red flag (`key: rf:<readingId>:<component>`).
- **Symptoms:** only non-archived `scale` symptoms with `redFlagAt`; an entry in the last 24 h with `score >= redFlagAt` gives one red flag (`key: rf:<entryId>`). `stool` and `event` trackers never raise red flags.
- Sorted by time, then component order. The UI shows unacknowledged red flags above everything on Today; acknowledging is per device (`useAckedFlags`, localStorage).
- **Wording:** the value, the limit and "Contact your care team now." Never dose amounts or instructions to change medication.

### Required tests (`src/engine/__tests__/redFlags.test.ts`)
1. Readings and scale symptoms of the last 24 h flag, older ones don't; oldest first.
2. Both BP components flag separately.
3. Values inside limits, future entries and archived trackers don't flag.
4. Stool/event trackers never flag, even with a stray `redFlagAt`.
5. Trackers without targets or limits (weight, custom) don't flag.
6. Empty database → `{ redFlags: [] }`, no throw.
7. **No prescribing:** no red-flag title or message contains a dose amount (`/\d+(\.\d+)?\s?(mg|g|ml|mcg|µg)\b/i`) or an instruction verb (increase, decrease, reduce, raise, stop, take).
8. Deterministic.

---

## 6. UI routes (`src/App.tsx`, HashRouter)

| Route | Screen | Component |
|---|---|---|
| (until accepted) | Onboarding: disclaimer, optional targets | `components/onboarding/Welcome.tsx` |
| `#/` | Today: red flags, med checklist, tracker tiles | `components/today/TodayScreen.tsx` |
| `#/log/:kind/:id` | Log one tracker (full-screen, no nav) | `components/log/LogSheet.tsx` |
| `#/charts/:kind?/:id?` | Charts per tracker | `components/charts/ChartsScreen.tsx` |
| `#/meds` | Med stack | `components/meds/MedsScreen.tsx` |
| `#/settings` (`#trackers` opens the Trackers tab) | General (backup, slots, theme) · Trackers (show/hide, new tracker, targets & red flags) | `components/settings/SettingsScreen.tsx` |
| `#/doctor` | Doctor view / print | `components/doctor/DoctorView.tsx` |

Bottom nav: Today · Charts · Meds · Doctor. Data access goes through `hooks/useAppData` (`useLiveQuery`); `useEngine()` memoises `runEngine`. `useCurrent()` uses the real current time so a stack edit shows immediately.

---

## 7. Logging behaviour

**Today**
- Med checklist for the current slot (from the current stack). One tap on the check records `taken` at the tap time; tapping again deletes it. "…" offers *Skipped* and *Other amount* (amount input); each replaces the earlier record of the same dose. "All taken" records every open dose of the slot. Other slots of today are folded under "Other times today · n open". A dose belongs to the day of `dayKey(takenAt)` and the slot it was planned in.
- One tile per shown tracker: last value with status mark and time; the tile opens its chart, the "+" opens the log sheet.

**Log sheet** (< 10 s per value)
- Time defaults to now; ±15 min chips plus a picker.
- Parameter: one field per component, numeric keypad, autofocus. Auto-advance SYS → DIA at the expected digit count (BP/HR: 3 digits, or 2 when ≥ 30). Plausibility bounds (SYS 50–260, DIA 30–160, HR 25–250, SpO₂ 50–100, RR 4–60, weight 20–400 kg) show "Check value" and need a second tap, never block. Enter on the last field saves.
- Scale: 11 buttons 0–10, the threshold shown. Stool: 7 Bristol buttons with number, label and description. Event: no value.
- Optional note. Save writes one row, shows a toast with Undo (5 s) and returns to the screen it came from.

**Charts**
- Tracker chips, component switch for BP, range 7/14/30/90 days/All.
- Number: line/dot chart with the target band when min and max are set; status by symbol and colour. Scale: 0–10 axis with band 0–threshold. Stool: Bristol type per entry (1–7 axis) plus entries per day. Event: entries per day. Tap a point or bar for details and notes.
- Summary (min/mean/max/in range; scale mean/max/above threshold; stool type distribution and per day; event count and days) and the last 12 entries with delete + Undo.

**Settings → Trackers**
- Show/hide any tracker (archive; data kept). Delete a tracker with all its entries (confirmation shows the entry count; Undo in the toast restores both). New tracker: name + type (0–10 / Stool / Number with unit, decimals, optional target min/max / Yes-No). Targets and red flags for shown number trackers and thresholds/red flags for scale trackers; empty = none.

---

## 8. Backup format (`src/lib/backup.ts`)
```json
{
  "app": "medicine-adjuster",
  "schemaVersion": 2,
  "exportedAt": "2026-10-08T10:00:00.000Z",
  "data": { "parameters": [], "symptoms": [], "slots": [], "medications": [],
            "regimens": [], "readings": [], "symptomEntries": [], "doseEvents": [], "settings": [] }
}
```
- `app` stays `medicine-adjuster` so old files keep validating. Export filename: `health-tracker-YYYY-MM-DD-HHmm.json`.
- Import accepts schema 1 and 2. A v1 file is upgraded with the same transform as the database (§4) before it is restored.
- Import validates `app`, `schemaVersion` and array shapes, shows counts, asks for confirmation, auto-exports the current DB as a safety copy, then **replaces** all tables in one transaction.
- Settings shows "Last backup: x days ago". Today shows a nudge after more than 3 days.

---

## 9. Doctor view / PDF
- Solid, high-contrast layout, also used for `@media print` (A4 portrait, 1 page target). Period 7 / 14 / 30 days (screen only).
- Sections: header (period, counts, generated at) → current medications (medication × slot) and dose counts (taken / other amount / skipped) → measurements table (target, n, min, mean, max, % in range) → up to 4 compact SVG charts → symptoms table (entries, days, details: scale mean/max/above threshold, stool per day and type counts, last event notes) → red flags of the last 24 h → footer disclaimer.
- "Print / PDF" calls `window.print()`.

---

## 10. PWA & deployment
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`, precaching all build assets. Works offline from the first load.
- Manifest (from `vite.config.ts`): name "Health Tracker", short_name "Health", `display: standalone`, theme colour = `--bg` dark, icons 192/512 + maskable.
- `base: '/MedicineAdjuster/'` (unchanged, so installs and IndexedDB origin stay the same). HashRouter avoids GitHub Pages 404s.
- `ci.yml`: typecheck, unit tests, Playwright e2e. `deploy.yml`: on push to `main`, typecheck + test + build, then deploy to Pages.

---

## 11. Folder structure

```
src/
├── main.tsx, App.tsx             # routes + bottom nav
├── styles/globals.css            # theme tokens, glass, print styles
├── lib/
│   ├── types.ts                  # §3
│   ├── db.ts, migrate.ts         # Dexie schema + v1→v2 upgrade (§4)
│   ├── defaults.ts, seed.ts      # defaults
│   ├── actions.ts                # all writes (log, doses, stack, trackers, settings)
│   ├── trackers.ts               # unified tracker list, Bristol scale, formatting
│   ├── slots.ts, format.ts, plausibility.ts
│   ├── snapshot.ts               # loadSnapshotData, toSnapshot
│   └── backup.ts                 # export/import (§8)
├── engine/
│   ├── index.ts                  # runEngine → { redFlags }
│   ├── redFlags.ts, text.ts
│   └── __tests__/                # fixtures.ts (Scenario builder, also used by e2e/demo.ts), redFlags.test.ts
├── hooks/                        # useAppData, useEngine, useCurrent, useAckedFlags
└── components/
    ├── ui/                       # hand-written shadcn-style primitives
    ├── charts/                   # ChartsScreen, TrendChart, EventChart (SVG)
    ├── onboarding/, today/, log/, meds/, settings/, doctor/, layout/
e2e/                              # app.spec.ts, demo.ts (v2 demo + v1 backup)
```
