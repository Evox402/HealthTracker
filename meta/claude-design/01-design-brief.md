# 01 — Design Brief: MedicineAdjuster

> Paste this file into claude.ai/design as the starting prompt. Attach or paste files 02–05 as well. Source of truth: `meta/PRD.md` / `meta/SPEC.md`; this folder duplicates the relevant parts so Claude Design needs nothing else.

## Design Direction
Mobile-first, slick and modern, with a subtle glass effect (frosted cards over a soft gradient) used only where it doesn't reduce legibility. Large tap targets, a clinical clarity of numbers and colour-coded ranges. Dark and light themes.

## Accessibility & safety constraints
- WCAG AA contrast everywhere, including text on glass surfaces.
- Range status is never shown by colour alone: always add an arrow/icon/label.
- The app never shows specific dose recommendations. Insights are phrased as discussion points for the care team.
- Red-flag banners ("Contact your care team now") always take precedence over everything else on screen.
- Drug timing values are labelled "approx. — verify with your pharmacist" wherever shown.
- Quick Log must be completable in under 30 seconds. Don't add required fields.

## Brief

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

**Backend note:** there is no backend. All screens use the local Dexie database. For the design phase, seed it from `mockData.ts`. The insights engine (`src/engine/`) is built in parallel by Claude Code. The UI only calls `runEngine(snapshot)` from `src/engine/index.ts` and renders the returned `Insight[]`/`RedFlag[]`/`ChangeEvaluation[]`. Until the engine lands, use a stub that returns typed mock insights. The exact types are in `03-data-contract.md`.

