# PRD: MedicineAdjuster

## Overview
MedicineAdjuster is a mobile-first, offline PWA for tracking vital parameters, symptoms and medication doses through the day. A transparent rules engine shows **when** readings leave their target range, **how that relates to dose timing**, and **whether regimen changes helped**. It turns these findings into discussion points for the care team. It is a personal "second look" at the data, not a prescriber.

## Problem
After heart surgery, heart rate and blood pressure have to be titrated with several drugs (beta blocker, ACE inhibitor/ARB, rate control). Readings keep going out of range, and dose changes during rounds feel arbitrary. Nobody has a consolidated view of the data: readings by time of day, which doses were actually taken and when, and what happened after each change. Paper charts and memory don't show patterns like "BP is high every morning, about 14 h after the last dose".

## Target Users
- **Primary:** the author, a single patient currently in hospital and later recovering at home. Technically capable, on an Android phone, logging several times a day, sometimes tired or in pain. Entry must be fast and forgiving.
- **Secondary (read-only):** treating doctors and nurses, who see the data on the phone during rounds or in a 1-page PDF summary.

## MVP Feature Set
1. **Setup with sensible defaults**
   - Parameters with target ranges: Blood pressure (systolic/diastolic, mmHg), Heart rate (bpm), SpO₂ (%), Respiratory rate (/min). Each has an editable min/max.
   - Symptoms on a 0–10 scale with an alert threshold: chest pain, nausea, exhaustion, sluggishness, back pain.
   - Time slots: Morning, Noon, Evening, Night, with editable hour boundaries.
2. **Medications and versioned regimens**
   - Add medications from a built-in cardiac drug library (beta blockers, ACE inhibitors/ARBs, antiarrhythmics/rate control, plus common calcium channel blockers and diuretics) or as custom entries. Units: mg, g, ml, pill, piece, drop, scoop.
   - Each library drug has approximate onset, peak and duration and a flag for whether timing within the day matters. Custom drugs can set their own values.
   - A regimen is a set of (medication, slot, amount). Every change creates a new **regimen version** with a start date/time and an optional note (e.g. "Dr. X raised bisoprolol").
3. **Quick log (< 30 s per slot)**
   - One screen per slot showing parameter inputs, symptom sliders and a dose checklist. Checklist states: taken (one tap), skipped, or different amount.
   - Each entry stores an exact timestamp. It defaults to now, is editable, and is auto-assigned to a slot.
   - Context tags per reading: resting, after activity, lying, standing.
4. **Today dashboard:** the current slot's log status, the latest values coloured by range, active red-flag banners and the top insights.
5. **Insights engine (transparent rules)**
   - Detects patterns: out-of-range by slot, end-of-dose wearing-off, peak-effect lows, slots with no coverage, symptom correlations, and missed-dose effects.
   - Evaluates each regimen change before vs. after, including "too early to judge" for slow drugs.
   - Each insight shows a confidence level (Low/Medium/High), the readings behind it, and a phrased **discussion point** for the care team. It never gives a specific mg recommendation.
   - Red flags: dangerous values (e.g. SBP < 90 or > 180, HR < 45 or > 130, SpO₂ < 90, chest pain ≥ 7) show a "contact your care team now" banner instead of insights.
6. **Trends:** a chart per parameter with the target band, a slot filter, and regimen-change markers on the timeline.
7. **Doctor view and PDF:** a clean full-screen summary for showing the phone during rounds. The same layout prints to a 1-page PDF via the browser.
8. **Backup:** JSON export/import of the full database. The app requests persistent storage at start.
9. **PWA:** installable on Android, fully offline, with all data stored on the device.

## Post-MVP Features
- Statistical layer (regression of dose timing vs. readings) on top of the rules.
- Custom parameters and symptoms (weight, temperature, blood sugar, dizziness…).
- Dose and measurement reminders (Android notifications).
- Free-text notes per entry.
- CSV export.
- German UI / i18n.
- Import from a Bluetooth BP cuff or Health Connect.
- Multi-device sync.

## Tech Stack
- **Language/Runtime:** TypeScript (strict), browser only.
- **Framework:** Vite + React + Tailwind + shadcn/ui; `vite-plugin-pwa` (Workbox) for offline/installability; React Router with hash routing (GitHub Pages).
- **Database/Storage:** IndexedDB via Dexie.js. No backend. `navigator.storage.persist()` at start, plus JSON backup.
- **Charts:** raw SVG React components (no chart library).
- **PDF:** a print stylesheet plus `window.print()` (Android Chrome → "Save as PDF"). No PDF library.
- **Testing:** Vitest for the engine (pure functions, test-first) and Playwright for the main e2e flows.
- **Deployment:** GitHub Pages via a GitHub Actions workflow on push to `main`.

## Integrations
None. The app is standalone; data never leaves the device except through a user-initiated JSON or PDF export.

## Design Direction
Designed in Claude Design (see brief below). Mobile-first, slick and modern, with a subtle glass effect (frosted cards over a soft gradient) used only where it doesn't reduce legibility. Large tap targets, a clinical clarity of numbers and colour-coded ranges. Dark and light themes.

## Constraints
- **Timeline: ASAP (days).** It needs to be usable while still in hospital. A strict MVP; polish comes later.
- **Single user, single device**, no accounts and no server.
- **Offline-first;** must work with no hospital Wi-Fi.
- **Android Chrome** is the primary target.
- **Medical safety:**
  - The app shows patterns and discussion points only. It never gives specific dose numbers or tells the user to change medication on their own.
  - An onboarding disclaimer must be accepted.
  - Drug-library values are approximate and labelled as such.
  - Red flags override insights.
- **Privacy:** health data stays local. No analytics or third-party requests at runtime.
- **Accessibility:** WCAG AA contrast (including on glass surfaces), and range status is never shown by colour alone (icon/label too).

## Success Criteria
- Logging a full slot (BP + HR + SpO₂ + RR, symptoms, dose confirmation) takes **under 30 seconds**. A typical slot needs 4 numeric fields plus one tap for "all doses taken".
- For every regimen change, the before/after view clearly shows whether the in-range percentage per slot improved, or says honestly that it's too early or there's too little data.
- The engine has unit tests for every rule, including the issue's example scenario: high BP in the morning and at noon, with no night dose. That scenario produces an end-of-dose / night-coverage insight.

## Out of Scope
- Specific dose calculation or any automatic regimen change.
- Accounts, cloud sync, multi-user, sharing links.
- Drug interaction checking.
- Integration with hospital systems (HL7/FHIR).
- iOS-specific workarounds beyond what works by default.
- Notifications/reminders (post-MVP).
- Languages other than English (post-MVP).

---

## Claude Design Brief

> A self-contained, paste-ready version of this brief, plus the data contract, mock data and drug library, is in `meta/claude-design/` (start with its README).

**App context:** MedicineAdjuster is a personal, offline mobile PWA for a patient recovering from heart surgery. Several times a day they log blood pressure, heart rate, SpO₂, respiratory rate, symptom scores (0–10) and confirm medication doses. A rules engine shows when values leave their target ranges, how that relates to dose timing, and whether regimen changes helped. It phrases findings as discussion points for the care team.

**Screens to design:**
- **Onboarding / Disclaimer:** a short explanation and a safety disclaimer ("not medical advice; never change medication without your care team"). The primary action is Accept.
- **Today (home):** a greeting with the current slot; a "Log now" card for the current slot; the latest value per parameter as a tile coloured by range status; the dose checklist for the current slot; the top 2 insights; and a red-flag banner when active. Bottom navigation: Today, Trends, Insights, Regimen, More.
- **Quick Log (sheet):** a slot selector (Morning/Noon/Evening/Night, auto-selected) and an editable time. Inputs: a BP sys/dia pair with a large numeric keypad, HR, SpO₂ and RR, each showing its target range as a hint. Context tag chips. Symptom sliders 0–10 that show the threshold. Dose checklist: "All taken" button plus per-dose taken/skipped/changed amount. Primary action: Save. Must be completable in under 30 seconds.
- **Trends:** a parameter switcher (tabs); a line/dot chart with a shaded target band; a slot filter; vertical markers for regimen changes (tap one to see the change); a range selector (3d/7d/14d/all). Below the chart: a per-slot table of in-range %.
- **Insights:** a list of insight cards. Each card has a type icon, title, confidence badge (Low/Med/High) and a short explanation, and expands to show the supporting readings and the "Discuss with your care team" text. Filter: all / by parameter. Includes the regimen-change evaluation cards (before vs. after per slot).
- **Regimen:** the current regimen as a slot × medication grid; "Change regimen" (edit amounts/slots → date/time + note → saves a new version); version history timeline.
- **Medications:** a list, plus an add flow: search the built-in library or add a custom drug (name, unit, optional onset/peak/duration).
- **Settings (More):** parameters with target ranges, symptoms with thresholds, slot hour boundaries, red-flag limits, theme, JSON backup export/import, and links to Doctor view and About/disclaimer.
- **Doctor view / Print:** a clean, high-contrast, non-glass layout. Contents: patient period, current regimen, regimen change log, compact trend charts with target bands, per-slot in-range table, top insights. A "Print / Save PDF" button. A4 portrait print layout.

**Key interactions:**
- The "All doses taken" button confirms the whole checklist in one tap.
- The slot is auto-selected from the current time, and the timestamp is editable.
- Numeric entry uses large keypad-friendly inputs and moves to the next field automatically after a plausible value (e.g. 3 digits for systolic).
- Each range tile shows a status: in range, above or below (colour **plus** arrow icon), or red flag (pulsing outline + banner).
- Insight cards expand inline. Tapping a supporting reading jumps to the Trends chart at that point.
- A regimen change opens a stepped sheet: edit → effective date/time → note → confirm.
- Glass effect: frosted translucent cards over a soft, slowly drifting gradient background. Solid surfaces are used for inputs, charts and the doctor view.

**States to cover for each screen:** loading, empty state (first launch with no readings, no regimen, no insights yet — "need more data, keep logging"), error state (storage unavailable, import failed), populated state (use the realistic mock data in `src/lib/mockData.ts`: 5 days with a bisoprolol + ramipril + amiodarone regimen, one regimen change on day 3, and mornings above BP range).

**Aesthetic:** modern health app with a calm and clinical feel. Inspirations: Apple Health / Oura / Withings. Glassmorphism used sparingly on cards and the bottom navigation. Colours: a deep navy/indigo dark theme as the default plus a light theme. Teal accent. Status colours are green (in range), amber (out of range) and red (red flag). Large, tabular numerals for values. Rounded 20–24 px cards.

**Backend note:** there is no backend. All screens use the local Dexie database. For the design phase, seed it from `mockData.ts`. The insights engine (`src/engine/`) is built in parallel by Claude Code. The UI only calls `runEngine(snapshot)` from `src/engine/index.ts` and renders the returned `Insight[]`/`RedFlag[]`/`ChangeEvaluation[]`. Until the engine lands, use a stub that returns typed mock insights. The exact types are in `meta/SPEC.md` §3 and §5.

---

## Technical setup for Claude Design

**Scope:** there is no backend (IndexedDB only), so Claude Design delivers a complete runnable project: `npm install && npm run dev` works end to end.

**Project scaffold (always include):**
- `package.json` with all required dependencies (react, react-dom, react-router-dom, dexie, dexie-react-hooks, tailwindcss, shadcn/ui deps, vite-plugin-pwa, vitest, @playwright/test)
- `vite.config.ts` with `vite-plugin-pwa` config and `base: '/MedicineAdjuster/'`
- `tsconfig.json` (strict, `@/` alias → `src/`)
- `index.html`
- `src/main.tsx` — entry point
- `src/App.tsx` — HashRouter routing and layout
- `src/styles/globals.css` — CSS custom property theme tokens
- `public/manifest.json`

**Data layer:**
- `src/lib/types.ts` — copy the types from `meta/SPEC.md` §3 verbatim
- `src/lib/db.ts` — Dexie.js with typed tables (schema in `meta/SPEC.md` §4)
- `src/lib/seed.ts` — default parameters, symptoms and slots
- `src/lib/mockData.ts` — realistic demo data (see populated state)
- `src/engine/index.ts` — a stub `runEngine()` returning typed mock output (Claude Code replaces it)

**Components:**
- Each screen = `src/components/[feature]/[name].tsx`, named export
- No default exports except `src/App.tsx`
- Props typed with TypeScript interfaces at top of file
- shadcn/ui primitives where applicable (`Button`, `Dialog`, `Sheet`, `Badge`, `Slider`, `Tabs`, etc.) — import from `@/components/ui/[component]`
- Charts: raw SVG in React components — no charting library

**Styling:**
- Tailwind for all layout and spacing — no separate CSS files, no inline `style=` attributes
- Colors via CSS custom properties: `className="bg-[var(--bg)] text-[var(--text-primary)]"`
- Theme tokens in `globals.css`: `--bg`, `--surface`, `--surface-2`, `--border`, `--text-primary`, `--text-muted`, `--accent`, `--accent-subtle`, `--gain` (always green — in range), `--loss` (always red — red flag), plus `--warn` (amber — out of range), `--glass` and `--glass-border`
- A print stylesheet section in `globals.css` (`@media print`) for the doctor view

**Never:**
- `window.*` globals or CDN-loaded React/Tailwind
- Inline styles
- Untyped `any`
- CSS files other than `globals.css`

**Before exporting**, create `HANDOVER.md` in the project root:
- All files created and their purpose
- Which screens are complete and interactive
- TypeScript interfaces for all data shapes
- Engine calls the frontend expects (`runEngine` signature and output shapes)
- What is not implemented (real engine rules, backup edge cases)
