# Claude Design Handoff Pack

Everything claude.ai/design needs to build the MedicineAdjuster frontend. It's self-contained and deliberately duplicates content from `meta/PRD.md` and `meta/SPEC.md`. **If they ever disagree, PRD/SPEC win.** Update this folder whenever they change.

| File | Purpose |
|---|---|
| `01-design-brief.md` | App context, screens, interactions, states, aesthetic. **Start the Claude Design session with this.** |
| `02-technical-setup.md` | Project scaffold, data layer, component and styling rules, what goes into `HANDOVER.md`. |
| `03-data-contract.md` | TypeScript types (use verbatim), Dexie schema, defaults, slot logic, routes. |
| `04-screen-behaviour.md` | Quick Log details (< 30 s), backup, doctor view/print, PWA, folder structure. |
| `05-mock-data.md` | Demo scenario for the populated states, engine stub output, and the drug library. |

## How to use
1. Open claude.ai/design and start a new project.
2. Paste `01-design-brief.md` as the first prompt, and attach/paste `02`–`05`.
3. Iterate until every screen covers its loading, empty, error and populated states. Try the Quick Log on a real Android phone (goal: < 30 s).
4. Ask Claude Design to write `HANDOVER.md` (see `02-technical-setup.md`).
5. Export → "Send to Claude Code", and place the bundle in `design-handoff/` at the repo root.
6. Claude Code then merges it with the engine (see `meta/IMPLEMENTATION_PLAN.md`, Phase 3).
