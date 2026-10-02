# 04 — Screen Behaviour & Folder Structure

> Copied from `meta/SPEC.md` §7–§11.

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
│   └── IMPLEMENTATION_PLAN.md
├── design-handoff/               # Claude Design export bundle (Send to Claude Code)
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
