# CLAUDE.md — Health Tracker (formerly MedicineAdjuster)

Offline, mobile-first PWA for tracking a med stack (ticked off as taken), vitals (BP, pulse, weight) and custom trackers (0–10 scale, stool/Bristol, number with unit, yes/no + note), with charts and a printable doctor summary. The engine only raises red flags. Single user, Android Chrome, all data stays on the device. Repo and Pages base path: `HealthTracker` (renamed from `MedicineAdjuster` on 8 Oct 2026). The IndexedDB name and backup `app` id stay `medicine-adjuster` so existing data and backups keep working; never rename them.

**Read first:** `meta/PRD.md` (what & why), `meta/SPEC.md` (types, storage, engine rules — source of truth), `meta/IMPLEMENTATION_PLAN.md` (phases, current progress).

## Stack
Vite · React · TypeScript (strict) · Tailwind · shadcn-style primitives in `components/ui` (hand-written, no Radix) · lucide-react icons · Dexie (IndexedDB) · vite-plugin-pwa · React Router (HashRouter) · Vitest · Playwright · GitHub Pages.

## Commands
```bash
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm test           # vitest (engine + lib)
npm run e2e        # playwright: builds, serves on :4173 and runs e2e/ (uses pre-installed Chromium)
npm run build      # typecheck + production build incl. service worker
npm run coverage   # vitest with coverage of src/engine
```
Run `typecheck` and `test` before every commit; run `e2e` when UI flows change.

Other: `node scripts/render-icons.mjs` re-renders the PNG icons from `public/icons/*.svg`. `e2e/demo.ts` builds a demo backup (v2, plus a v1-format variant) used by the e2e tests.

## Architecture rules
- `src/engine/` is **pure**: no Dexie, no React, no `Date.now()`, no randomness. Input is `EngineSnapshot` and output is `EngineResult` (SPEC §3); today the engine only computes red flags (SPEC §5). UI code reaches the engine only through `hooks/useEngine`.
- `src/lib/types.ts` mirrors SPEC §3. If a type changes, update SPEC in the same commit.
- Engine changes are test-first: write or extend a spec in `src/engine/__tests__/` before changing a rule.
- Times are stored as ISO strings (UTC). Slot and day assignment use **local** time via `lib/slots.ts`; a Night reading after midnight belongs to the previous day.
- Dexie schema changes require a new `db.version(n)` with an `upgrade()`. Never drop user data.

## Medical safety (non-negotiable)
- The app **never** outputs specific dose amounts or tells the user to change medication. All engine wording lives in `engine/text.ts`, and the no-prescribing test (SPEC §5, test 7) must stay green.
- Red flags (SPEC §5) always take precedence in the UI.
- No network requests at runtime, no analytics, no third-party scripts.

## UI conventions
- No Google Fonts or CDNs: Manrope is bundled via `@fontsource-variable/manrope`.
- Screens live in `src/components/<feature>/<Name>.tsx` as named exports (only `App.tsx` is a default export). Props interfaces go at the top of the file.
- Tailwind only; colours via CSS tokens (`bg-[var(--surface)]`). No inline styles, no extra CSS files besides `src/styles/globals.css`.
- Charts are hand-written SVG components in `components/charts/`; no chart libraries.
- Status is never shown by colour alone (add an arrow/icon/label). Keep WCAG AA contrast, including on glass surfaces.
- The Doctor view uses solid surfaces (no glass) and must print to one A4 page.
- Logging one tracker must stay a few taps (log sheet, SPEC §7). Don't add required fields.

## Design
The UI is built by Claude Code directly. Look and layout: the approved mockups in `design/mockups/*.dc.html` (colours, spacing, glass treatment). Screens, interactions and states: `meta/claude-design/01`–`04`. If a mockup and SPEC disagree on data or behaviour, SPEC wins. Keep `types.ts`, `engine/` and the CI pipeline as the fixed points.
