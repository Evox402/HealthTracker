# Health Tracker

Offline, mobile-first app (PWA) for tracking your medications (tick off doses as taken), blood pressure, pulse and weight, and your own trackers: 0–10 scales such as pain, stool (Bristol scale), any number with a unit, or yes/no events with a note. Every tracker has a chart, and a one-page summary prints for your care team. Dangerous values (red flags you set) show a warning first.

> **Not medical advice.** Never change medication without your care team. Charts and summaries show your own measurements; they are not a diagnosis.

Formerly *MedicineAdjuster*: the repo was renamed on 8 Oct 2026. The local database keeps its old name (`medicine-adjuster`) so existing data carries over.

All data stays on the device (IndexedDB). Use **Settings → Backup → Export** regularly.

## Install on Android
1. Open the GitHub Pages URL (`https://evox402.github.io/HealthTracker/`) in Chrome.
2. Menu ⋮ → **Install app** (or "Add to Home screen").
3. Open it from the home screen. It works offline from then on.

## Development
```bash
npm ci
npm run dev        # http://localhost:5173/HealthTracker/
npm test           # engine + data layer (Vitest)
npm run e2e        # end-to-end (Playwright)
npm run build      # production build → dist/
```

Docs: [`meta/PRD.md`](meta/PRD.md) (what & why), [`meta/SPEC.md`](meta/SPEC.md) (data model and engine rules), [`meta/IMPLEMENTATION_PLAN.md`](meta/IMPLEMENTATION_PLAN.md) (progress), [`CLAUDE.md`](CLAUDE.md) (conventions).

Deployment: pushing to `main` runs `.github/workflows/deploy.yml`. Enable it once under **Settings → Pages → Source: GitHub Actions**.
