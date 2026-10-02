# CLAUDE.md — MedicineAdjuster

Offline, mobile-first PWA for logging vitals, symptoms and medication doses after heart surgery. A transparent rules engine finds out-of-range patterns relative to dose timing and evaluates regimen changes. Single user, Android Chrome, all data stays on the device.

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

Other: `node scripts/render-icons.mjs` re-renders the PNG icons from `public/icons/*.svg`. `e2e/demo.ts` builds a demo backup (the 05-mock-data scenario) used by the e2e tests.

## Architecture rules
- `src/engine/` is **pure**: no Dexie, no React, no `Date.now()`, no randomness. Input is `EngineSnapshot` and output is `EngineResult` (SPEC §3). UI code reaches the engine only through `hooks/useEngine`.
- `src/lib/types.ts` mirrors SPEC §3. If a type changes, update SPEC in the same commit.
- Engine changes are test-first: write or extend a spec in `src/engine/__tests__/` before changing a rule.
- Times are stored as ISO strings (UTC). Slot and day assignment use **local** time via `lib/slots.ts`; a Night reading after midnight belongs to the previous day.
- Dexie schema changes require a new `db.version(n)` with an `upgrade()`. Never drop user data.

## Medical safety (non-negotiable)
- The app **never** outputs specific dose amounts or tells the user to change medication. Insights state facts and a `discussionPoint` for the care team. All insight wording lives in `engine/text.ts`, and the no-prescribing test (SPEC §5.7 #11) must stay green.
- Red flags (SPEC §5.4 R0) always take precedence in the UI.
- Drug library values are approximate. Keep the "approx. — verify with pharmacist" label wherever they are shown.
- No network requests at runtime, no analytics, no third-party scripts.

## UI conventions
- No Google Fonts or CDNs: Manrope is bundled via `@fontsource-variable/manrope`.
- Screens live in `src/components/<feature>/<Name>.tsx` as named exports (only `App.tsx` is a default export). Props interfaces go at the top of the file.
- Tailwind only; colours via CSS tokens (`bg-[var(--surface)]`). No inline styles, no extra CSS files besides `src/styles/globals.css`.
- Charts are hand-written SVG components in `components/charts/`; no chart libraries.
- Status is never shown by colour alone (add an arrow/icon/label). Keep WCAG AA contrast, including on glass surfaces.
- The Doctor view uses solid surfaces (no glass) and must print to one A4 page.
- Quick Log must stay under 30 s for a full slot. Don't add required fields.

## Design
The UI is built by Claude Code directly. Look and layout: the approved mockups in `design/mockups/*.dc.html` (colours, spacing, glass treatment). Screens, interactions and states: `meta/claude-design/01`–`04`. If a mockup and SPEC disagree on data or behaviour, SPEC wins. Keep `types.ts`, `engine/` and the CI pipeline as the fixed points.
