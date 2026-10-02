# Implementation Plan: MedicineAdjuster

Goal: a usable MVP **within days**, while the author is still in hospital. The work runs in two parallel tracks that meet at the shared types in `src/lib/types.ts` (SPEC §3).

```
Day 1                 Day 2                  Day 3                  Day 4
Track A  Claude Design ── screens + Dexie + mock ──▶ export → design-handoff/
Track B  Claude Code   ── scaffold · types · engine (TDD) ──────────▶
                                                     Integration ── deploy ── real use
```

The cut line if time runs short: Phases 0–4 are the **must-have** for daily use in hospital. Phase 5 (trends polish, doctor view/PDF) can follow a day later. The JSON backup (in Phase 4) is never cut.

---

## Phase 0 — Scaffold & pipeline (Claude Code, ~0.5 day)
- [ ] Vite + React + TS (strict) + Tailwind + shadcn/ui init; `@/` alias.
- [ ] `vite-plugin-pwa`, `manifest.json`, placeholder icons, `base: '/MedicineAdjuster/'`, HashRouter shell with bottom nav and empty screens.
- [ ] Vitest + Playwright configured; `npm run typecheck | test | e2e | build` scripts.
- [ ] `.github/workflows/deploy.yml` → GitHub Pages (enable Pages "GitHub Actions" source in repo settings).
- [ ] `src/lib/types.ts` copied verbatim from SPEC §3.
- **Done when:** the empty app is installable from the Pages URL on Android and opens offline.

> If Claude Design's export arrives first, use its scaffold instead and re-apply the pipeline items on top.

## Phase 1 — Engine, test-first (Claude Code, ~1–1.5 days, parallel to Track A)
Pure TypeScript in `src/engine/`, no UI dependency.
- [ ] `fixtures.ts`: a builder for snapshots (`day(n).at('07:10').bp(142, 88)`, `.dose('bisoprolol', 5)`…).
- [ ] `drugLibrary.ts` (SPEC §5.6). Double-check every value against product information while typing.
- [ ] `preprocess.ts`, `coverage.ts`, `confidence.ts`, `slots.ts` (shared with UI), plus unit tests.
- [ ] R0 red flags → R1 → R7 missed dose → R2 → R3 → R4 → R6 → R5 change evaluation, each with its own spec.
- [ ] Scenario tests 1–11 from SPEC §5.7, including the **no-prescribing** guard.
- [ ] `runEngine()` assembles, dedupes and sorts (SPEC §5.5).
- **Done when:** `npm test` is green and the coverage of `src/engine/` is ≥ 90 % lines.

## Phase 2 — UI in Claude Design (user + Claude Design, ~1–2 days, parallel)
- [ ] Paste the **Claude Design Brief** + **Technical setup** sections of `meta/PRD.md` into claude.ai/design.
- [ ] Design all screens with their loading/empty/error/populated states; check the Quick Log on a real phone for the < 30 s goal.
- [ ] Ask Claude Design to create `HANDOVER.md`, then Export → "Send to Claude Code" → place the bundle in `design-handoff/`.

## Phase 3 — Integration (Claude Code, ~0.5–1 day)
- [ ] Merge the design-handoff code into `src/`, keeping our `types.ts`, `engine/` and pipeline. Reconcile any type drift, with SPEC as the source of truth.
- [ ] `db.ts` schema + `seed.ts` defaults + `snapshot.ts`; replace the engine stub with the real `runEngine` through `useEngine()`.
- [ ] Onboarding: disclaimer, prompt to enter the care team's target ranges, `navigator.storage.persist()`.
- [ ] Medications + library search; Regimen grid + versioned change flow.
- [ ] Quick Log wired to Dexie (single transaction, undo toast); Today dashboard with live tiles, red-flag banner and top insights.
- **Done when:** a full day can be logged on the phone and insights appear from real entries.

## Phase 4 — Insights screen + backup (Claude Code, ~0.5 day)
- [ ] Insights list with expandable evidence, confidence badges, dismiss; change evaluation cards.
- [ ] JSON export/import with validation, a safety auto-export before import, and a "last backup" nudge.
- [ ] Playwright e2e: quick-log happy path (assert ≤ N interactions) and a backup round-trip.
- **🚀 Release to Pages and start real daily use.**

## Phase 5 — Trends & doctor view (Claude Code, ~1 day)
- [ ] SVG `TrendChart` with target band, slot filter, regimen change markers and tap-to-inspect.
- [ ] Per-slot in-range table.
- [ ] Doctor view + `@media print` A4 layout; test "Save as PDF" in Android Chrome.

## Phase 6 — Hardening (ongoing)
- [ ] Tune the rule thresholds with real data (keep a `meta/engine-notes.md` log of false positives/negatives).
- [ ] Accessibility pass (contrast on glass, labels, non-colour status).
- [ ] Start on the post-MVP backlog (PRD).

---

## Working agreements
- Engine changes always start with a failing test in `src/engine/__tests__/`.
- Any text shown as an insight goes through `engine/text.ts`, and the no-prescribing test must stay green.
- Small commits per checkbox; CI (typecheck + test + build) must pass before a deploy.
