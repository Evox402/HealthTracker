# Implementation Plan: MedicineAdjuster

Goal: a usable MVP **within days**, while the author is still in hospital.

> **Change of plan (2 Oct):** Claude Design isn't available on mobile, and the author is mobile-only right now. The UI is therefore designed as a **clickable mockup canvas** (a Claude artifact you can open on a phone) and then **built directly by Claude Code** from those mockups. The mockup sources are in `design/mockups/`. The `meta/claude-design/` pack stays as the written UI spec and can still be used in Claude Design later from a desktop.

```
Day 1                       Day 2                  Day 3                  Day 4
Mockups ── review on phone ──▶ (feedback rounds)
Claude Code ── scaffold · types · engine (TDD) ──▶ UI screens from mockups ──▶ deploy ── real use
```

The cut line if time runs short: Phases 0–4 are the **must-have** for daily use in hospital. Phase 5 (trends polish, doctor view/PDF) can follow a day later. The JSON backup (in Phase 4) is never cut.

---

## Phase 0 — Scaffold & pipeline (Claude Code, ~0.5 day)
- [x] Vite + React + TS (strict) + Tailwind; `@/` alias. UI primitives are small hand-written shadcn-style components in `components/ui` (no Radix dependency).
- [x] `vite-plugin-pwa` (manifest generated from `vite.config.ts`), icons (`scripts/render-icons.mjs`), `base: '/MedicineAdjuster/'`, HashRouter shell with bottom nav and empty screens.
- [x] Vitest + Playwright configured; `npm run typecheck | test | e2e | build` scripts.
- [x] `.github/workflows/deploy.yml` → GitHub Pages (enable Pages "GitHub Actions" source in repo settings).
- [x] `src/lib/types.ts` copied verbatim from SPEC §3.
- **Done when:** the empty app is installable from the Pages URL on Android and opens offline.

## Phase 1 — Engine, test-first (Claude Code, ~1–1.5 days, parallel to mockup review)
Pure TypeScript in `src/engine/`, no UI dependency.
- [x] `fixtures.ts`: a builder for snapshots (`day(n).at('07:10').bp(142, 88)`, `.dose('bisoprolol', 5)`…).
- [x] `drugLibrary.ts` (SPEC §5.6). Double-check every value against product information while typing.
- [x] `preprocess.ts`, `coverage.ts`, `confidence.ts`, `slots.ts` (shared with UI), plus unit tests.
- [x] R0 red flags → R1 → R7 missed dose → R2 → R3 → R4 → R6 → R5 change evaluation, each with its own spec.
- [x] Scenario tests 1–11 from SPEC §5.7, including the **no-prescribing** guard.
- [x] `runEngine()` assembles, dedupes and sorts (SPEC §5.5).
- **Done when:** `npm test` is green and the coverage of `src/engine/` is ≥ 90 % lines. ✅ 64 tests, 99 % lines (see `npm run coverage`).
- Follow-up: drug library values were entered from SPEC §5.6 and still need a check against product information.

## Phase 2 — Mockups (user + Claude, in chat, parallel)
- [x] Clickable mockup canvas with Today, Quick Log, Trends, Insights, Regimen and the Doctor view (A4), using the demo data from `meta/claude-design/05-mock-data.md`. Sources: `design/mockups/`.
- [ ] The author reviews it on their phone and gives feedback; Claude revises the canvas. Repeat until the look and flow are approved.
- [ ] Copy the approved mockup sources back into `design/mockups/`.
- [ ] Still to mock up if needed: Onboarding/disclaimer, Medications (add from library), Settings, and the empty/error states.

## Phase 3 — UI build & integration (Claude Code, ~1–1.5 days)
- [x] Build the screens in React/Tailwind/shadcn following `design/mockups/` (look) and `meta/claude-design/01`–`04` (behaviour and states). Theme tokens come from the mockup colours.
- [x] `db.ts` schema + `seed.ts` defaults + `snapshot.ts`; replace the engine stub with the real `runEngine` through `useEngine()`.
- [x] Onboarding: disclaimer, prompt to enter the care team's target ranges, `navigator.storage.persist()`.
- [x] Medications + library search; Regimen grid + versioned change flow.
- [x] Quick Log wired to Dexie (single transaction, undo toast); Today dashboard with live tiles, red-flag banner and top insights.
- **Done when:** a full day can be logged on the phone and insights appear from real entries.

## Phase 4 — Insights screen + backup (Claude Code, ~0.5 day)
- [x] Insights list with expandable evidence, confidence badges, dismiss; change evaluation cards.
- [x] JSON export/import with validation, a safety auto-export before import, and a "last backup" nudge.
- [x] Playwright e2e: quick-log happy path (assert ≤ N interactions) and a backup round-trip.
- **🚀 Release to Pages and start real daily use.**

## Phase 5 — Trends & doctor view (Claude Code, ~1 day)
- [x] SVG `TrendChart` with target band, slot filter, regimen change markers and tap-to-inspect.
- [x] Per-slot in-range table.
- [x] Doctor view + `@media print` A4 layout.
- [ ] Test "Save as PDF" in Android Chrome on the real phone.

- **Status (2 Oct):** Phases 0 and 3–5 built in one pass; 86 unit tests + 6 Playwright e2e tests (onboarding, quick log + undo, red flag, unusual values, regimen + dose checklist, demo restore → insights/trends/doctor view).

## Phase 6 — Hardening (ongoing)
- [ ] Tune the rule thresholds with real data (keep a `meta/engine-notes.md` log of false positives/negatives).
- [ ] Accessibility pass (contrast on glass, labels, non-colour status).
- [ ] Start on the post-MVP backlog (PRD).

---

## Working agreements
- Engine changes always start with a failing test in `src/engine/__tests__/`.
- Any text shown as an insight goes through `engine/text.ts`, and the no-prescribing test must stay green.
- Small commits per checkbox; CI (typecheck + test + build) must pass before a deploy.

---

## Phase 7 — Pivot to a symptom & bio tracker (8 Oct)
Only the tracking was used in practice, so the regimen/insights part was removed (see the PRD "Pivot" section and SPEC).
- [x] Types + Dexie v2 upgrade (`lib/migrate.ts`): symptom types, weight added, SpO₂/RR archived, nothing deleted. Backup schema 2; v1 files upgraded on import.
- [x] Engine reduced to red flags (tests first), dead engine code deleted.
- [x] Today: med checklist (taken / skipped / other amount) + tracker tiles. Log sheet per tracker with note.
- [x] Meds screen (simple stack), Charts screen (TrendChart + EventChart), Settings → Trackers (show/hide, new tracker, targets).
- [x] Doctor view simplified; display name "Health Tracker" (repo, URL, DB name unchanged).
- [x] e2e rewritten, incl. restoring a v1 backup.
- [ ] e2e green in CI (couldn't run locally: WSL lacks Chromium system libraries).
- [ ] On the phone: export a backup, install the update, check the old data is still there.
