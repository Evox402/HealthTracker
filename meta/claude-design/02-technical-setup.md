# 02 — Technical Setup for Claude Design


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
- `src/lib/types.ts` — copy the types from `03-data-contract.md` verbatim
- `src/lib/db.ts` — Dexie.js with typed tables (schema in `03-data-contract.md`)
- `src/lib/seed.ts` — default parameters, symptoms and slots
- `src/lib/mockData.ts` — realistic demo data (see `05-mock-data.md`)
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
