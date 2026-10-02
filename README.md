# MedicineAdjuster

Offline, mobile-first app (PWA) for logging blood pressure, heart rate, SpO₂, breathing rate, symptoms and medication doses through the day. A transparent rules engine shows **when** values leave their target range, **how that relates to dose timing**, and **whether regimen changes helped**. It phrases its findings as points to discuss with your care team.

> **Not medical advice.** Never change medication without your care team. Patterns are rule-based summaries of self-measured data; drug timing values are approximate.

All data stays on the device (IndexedDB). Use **Settings → Backup → Export** regularly.

## Install on Android
1. Open the GitHub Pages URL (`https://<user>.github.io/MedicineAdjuster/`) in Chrome.
2. Menu ⋮ → **Install app** (or "Add to Home screen").
3. Open it from the home screen. It works offline from then on.

## Development
```bash
npm ci
npm run dev        # http://localhost:5173/MedicineAdjuster/
npm test           # engine + data layer (Vitest)
npm run e2e        # end-to-end (Playwright)
npm run build      # production build → dist/
```

Docs: [`meta/PRD.md`](meta/PRD.md) (what & why), [`meta/SPEC.md`](meta/SPEC.md) (data model and engine rules), [`meta/IMPLEMENTATION_PLAN.md`](meta/IMPLEMENTATION_PLAN.md) (progress), [`CLAUDE.md`](CLAUDE.md) (conventions).

Deployment: pushing to `main` runs `.github/workflows/deploy.yml`. Enable it once under **Settings → Pages → Source: GitHub Actions**.
