# 05 — Mock Data & Engine Stub

> Used for the design phase only. `src/lib/mockData.ts` seeds Dexie with this scenario so every screen can be shown in its **populated** state. `src/engine/index.ts` is a stub returning the mock output below until Claude Code replaces it with the real engine.

## Scenario (5 days, `now` = day 5, 13:30 local)

**Defaults:** use the parameters, symptoms and slots from `03-data-contract.md` → *Defaults*.

**Medications**
| Name | libraryId | Unit |
|---|---|---|
| Bisoprolol | `bisoprolol` | mg |
| Ramipril | `ramipril` | mg |
| Amiodarone | `amiodarone` | mg |

**Regimen versions**
| Version | effectiveFrom | Items | Note |
|---|---|---|---|
| v1 | day 1, 07:00 | Bisoprolol 2.5 mg Morning · Ramipril 2.5 mg Morning · Ramipril 2.5 mg Evening · Amiodarone 200 mg Morning | "Started on ward" |
| v2 | day 3, 08:00 | Bisoprolol **5** mg Morning · Ramipril 2.5 mg Morning · Ramipril 2.5 mg Evening · Amiodarone 200 mg Morning | "Dr. Weber: bisoprolol 2.5 → 5 mg" |

There is no Night dose in either version.

**Readings** (4 slots per day, BP · HR · SpO₂ · RR). The pattern to show:
- Morning (≈ 07:00, before the morning dose): systolic 138–148 (**above** 130) on all 5 days; diastolic 82–88.
- Noon (≈ 12:00): systolic 132–140 on days 1–3, 124–128 on days 4–5.
- Evening (≈ 18:00): in range (112–125 / 70–78).
- Night (≈ 22:00): in range.
- HR: Morning 94–102 on days 1–2 (above 90), then 78–86 from day 3 (after the bisoprolol change); otherwise 68–84.
- One evening HR of 104 on day 4, tagged `after_activity`.
- SpO₂ 95–98, RR 14–18 throughout.
- **Day 5 noon** (logged at 12:05): HR **43**, which triggers the red-flag banner on Today.

**Symptoms**
- Exhaustion 5–6 on the mornings of days 4–5 (threshold 4).
- Back pain 3–4 sporadically.
- Chest pain 0–1.
- Nausea 0–2.

**Dose events**
- All doses `taken` near the slot default times.
- Day 2 evening ramipril was `skipped`.
- Day 5 morning doses taken at 08:10. Noon is logged at 12:05 (no noon doses are scheduled), so Today shows "Next: Evening · 18:00" with a "Log now" button.

## Mock engine output (stub)

```ts
export function runEngine(snapshot: EngineSnapshot): EngineResult {
  return {
    redFlags: [{
      key: 'rf:hr:day5noon', source: 'reading', refId: '<day-5 noon HR reading id>',
      title: 'Heart rate 43 bpm',
      message: '43 bpm is below 45 bpm. Contact your care team now.',
      at: '<day 5 12:05>',
    }],
    insights: [
      {
        key: 'uncovered_slot:<bp>:sys:morning:above', type: 'uncovered_slot',
        slotId: 'morning', direction: 'above', confidence: 'medium',
        title: 'Systolic BP above range in the Morning',
        explanation: '5 of 5 morning readings were above 130 mmHg (mean 143). They were taken about 13 h after the last ramipril dose; no BP medication is scheduled at Night.',
        discussionPoint: 'Early-morning coverage may be insufficient. Options to discuss: whether part of the evening dose could move to a Night dose, or a longer-acting drug.',
        evidence: [], score: 4,
      },
      {
        key: 'symptom_link:exhaustion:morning', type: 'symptom_link',
        slotId: 'morning', confidence: 'low',
        title: 'Morning exhaustion on 2 days',
        explanation: 'Exhaustion was 5–6 (threshold 4) on the mornings of the last 2 days.',
        discussionPoint: 'Mention the morning exhaustion to the care team, especially alongside the recent heart-rate changes.',
        evidence: [], score: 1,
      },
      {
        key: 'missed_dose:<bp>:sys:evening', type: 'missed_dose', confidence: 'low',
        title: 'Skipped evening ramipril on day 2',
        explanation: 'The next morning systolic was 148 mmHg, the highest in the period.',
        discussionPoint: 'This reading is likely explained by the skipped dose and is excluded from the other patterns.',
        evidence: [], score: 1,
      },
    ],
    changeEvaluations: [{
      regimenVersionId: '<v2>', effectiveFrom: '<day 3 08:00>',
      note: 'Dr. Weber: bisoprolol 2.5 → 5 mg',
      diff: [{ medicationId: '<bisoprolol>', slotId: 'morning', from: 2.5, to: 5 }],
      status: 'evaluated', judgeableFrom: '<day 4 08:00>',
      perSlot: [
        { parameterId: '<hr>', component: 'value', slotId: 'morning',
          before: { n: 2, inRangePct: 0, mean: 98 }, after: { n: 2, inRangePct: 100, mean: 82 }, verdict: 'improved' },
        { parameterId: '<bp>', component: 'sys', slotId: 'morning',
          before: { n: 2, inRangePct: 0, mean: 144 }, after: { n: 2, inRangePct: 0, mean: 142 }, verdict: 'unchanged' },
      ],
      summary: 'Since day 3 (bisoprolol 2.5 → 5 mg): morning HR in range 0 % → 100 %; morning systolic unchanged.',
    }],
    slotStats: [ /* derive from mock readings, or hard-code a few rows per slot */ ],
  };
}
```

Also show the **empty** variants: no red flags, no insights ("Keep logging — insights appear after a few readings per slot"), and a change evaluation with `status: 'too_early'`. For that, use an amiodarone change: "Changed 2 days ago; amiodarone needs about 2–3 weeks before its effect can be judged."

## Drug library (for the Medications search UI)

> Copied from `meta/SPEC.md` §5.6. Shown in the UI with the label "approx. — verify with your pharmacist".

Approximate values for **pattern reasoning only**, shown in the UI with "approx. — verify with your pharmacist". Sources: product information / standard references. They are summarised here and must be double-checked when implementing.

| id | Name | Class | Affects | Onset h | Peak h | Duration h | t½ h | Timing-sensitive | Steady-state days |
|---|---|---|---|---|---|---|---|---|---|
| metoprolol_tartrate | Metoprolol tartrate (IR) | beta_blocker | hr, bp | 1 | 1.5 | 12 | 3.5 | ✓ | 1 |
| metoprolol_succinate | Metoprolol succinate (ER) | beta_blocker | hr, bp | 2 | 7 | 24 | 5 | ✓ | 2 |
| bisoprolol | Bisoprolol | beta_blocker | hr, bp | 2 | 3 | 24 | 11 | ✓ | 3 |
| carvedilol | Carvedilol | beta_blocker | hr, bp | 1 | 1.5 | 12 | 8 | ✓ | 2 |
| nebivolol | Nebivolol | beta_blocker | hr, bp | 1.5 | 3 | 24 | 12 | ✓ | 3 |
| ramipril | Ramipril | ace_inhibitor | bp | 1.5 | 4.5 | 24 | 13 | ✓ | 3 |
| lisinopril | Lisinopril | ace_inhibitor | bp | 1 | 6.5 | 24 | 12 | ✓ | 3 |
| enalapril | Enalapril | ace_inhibitor | bp | 1 | 5 | 18 | 11 | ✓ | 3 |
| candesartan | Candesartan | arb | bp | 2 | 7 | 24 | 9 | ✓ | 3 |
| valsartan | Valsartan | arb | bp | 2 | 5 | 24 | 6 | ✓ | 2 |
| losartan | Losartan | arb | bp | 1 | 6 | 24 | 7 | ✓ | 3 |
| ivabradine | Ivabradine | if_inhibitor | hr | 1 | 1 | 12 | 11 (effective) | ✓ | 2 |
| diltiazem_ir | Diltiazem (IR) | rate_control_ccb | hr, bp | 0.5 | 3 | 7 | 4 | ✓ | 1 |
| verapamil_ir | Verapamil (IR) | rate_control_ccb | hr, bp | 1 | 2 | 7 | 6 | ✓ | 2 |
| amlodipine | Amlodipine | dhp_ccb | bp | 6 | 8 | 24 | 40 | ✗ | 8 |
| amiodarone | Amiodarone | antiarrhythmic | hr | — | — | — | ~50 days | ✗ | 21 |
| digoxin | Digoxin | cardiac_glycoside | hr | 1 | 4 | 24 | 40 | ✗ | 7 |
| furosemide | Furosemide | diuretic | bp | 1 | 1.5 | 6 | 1.5 | ✓ | 1 |
| torasemide | Torasemide | diuretic | bp | 1 | 2 | 12 | 3.5 | ✓ | 1 |
| spironolactone | Spironolactone | diuretic | bp | 24 | 72 | 72 | 20 (metabolites) | ✗ | 7 |

(For non-timing-sensitive drugs the onset/peak/duration are stored as `0` and ignored.)

