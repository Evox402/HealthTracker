import type { EngineResult, EngineSnapshot, Insight } from '@/lib/types';
import { runEngine } from '../index';
import { scenario } from './fixtures';

// Required scenarios from meta/SPEC.md §5.7.

const ofType = (r: EngineResult, type: Insight['type']) => r.insights.filter((i) => i.type === type);

/** #1 Issue example: evening-only short-acting beta blocker, BP high in the Morning and at Noon, no Night dose. */
export function issueExample(): EngineSnapshot {
  const s = scenario().med('metoprolol_tartrate').regimen(1, '06:00', [['metoprolol_tartrate', 'evening', 50]]);
  const morning = [142, 145, 148, 144, 146];
  const noon = [136, 138, 140, 137, 139];
  for (let d = 1; d <= 5; d++) {
    s.bp(d, '07:00', morning[d - 1], 85);
    s.bp(d, '12:00', noon[d - 1], 82);
    s.dose(d, '18:00', 'metoprolol_tartrate');
    s.bp(d, '19:30', 118, 74);
    s.bp(d, '22:00', 121, 76);
  }
  return s.now(5, '23:00').build();
}

/** #2 Wearing off: doses at 08:00 and 18:00, HR high at 07:00 (13 h after the evening dose), fine during the day. */
export function wearingOff(): EngineSnapshot {
  const s = scenario().med('metoprolol_tartrate')
    .regimen(1, '06:00', [['metoprolol_tartrate', 'morning', 50], ['metoprolol_tartrate', 'evening', 50]]);
  for (let d = 1; d <= 4; d++) {
    if (d > 1) s.hr(d, '07:00', [0, 98, 102, 96][d - 1]);
    s.dose(d, '08:00', 'metoprolol_tartrate');
    s.hr(d, '10:00', 72);
    s.hr(d, '14:00', 76);
    s.dose(d, '18:00', 'metoprolol_tartrate');
    s.hr(d, '21:00', 74);
  }
  s.hr(5, '07:00', 99);
  return s.now(5, '07:30').build();
}

/** #3 Peak low: carvedilol at 08:00, systolic below range 1.5 h later, with morning exhaustion. */
export function peakLow(): EngineSnapshot {
  const s = scenario().med('carvedilol')
    .regimen(1, '06:00', [['carvedilol', 'morning', 12.5], ['carvedilol', 'evening', 12.5]]);
  for (let d = 1; d <= 3; d++) {
    s.dose(d, '08:00', 'carvedilol');
    s.bp(d, '09:30', [94, 92, 96][d - 1], 60);
    s.symptom(d, '09:30', 'exhaustion', 6);
    s.bp(d, '14:00', 118, 72);
    s.dose(d, '20:00', 'carvedilol');
    s.bp(d, '19:00', 121, 75);
  }
  return s.now(3, '21:00').build();
}

/** #4 Regimen change that helped: bisoprolol 2.5 → 5 mg, morning HR in range 1/5 before, 4/5 after (from day 10). */
export function changeImproved(): EngineSnapshot {
  const s = scenario().med('bisoprolol')
    .regimen(1, '06:00', [['bisoprolol', 'morning', 2.5]])
    .regimen(6, '08:00', [['bisoprolol', 'morning', 5]], 'Dr. Weber: bisoprolol 2.5 → 5 mg');
  [95, 97, 85, 99, 94].forEach((v, i) => s.hr(i + 1, '07:30', v));
  [82, 80, 96, 78, 84].forEach((v, i) => s.hr(i + 10, '07:30', v));
  return s.now(14, '20:00').build();
}

/** #5 Amiodarone added 3 days ago: too early to judge. */
export function amiodaroneTooEarly(): EngineSnapshot {
  const s = scenario().med('bisoprolol').med('amiodarone')
    .regimen(1, '06:00', [['bisoprolol', 'morning', 5]])
    .regimen(4, '08:00', [['bisoprolol', 'morning', 5], ['amiodarone', 'morning', 200]], 'Amiodarone started');
  for (let d = 1; d <= 7; d++) s.hr(d, '07:30', 84);
  return s.now(7, '12:00').build();
}

/** #6 Missed dose: morning ramipril skipped on day 3, high BP at noon that day only. */
export function missedDose(): EngineSnapshot {
  const s = scenario().med('ramipril').regimen(1, '06:00', [['ramipril', 'morning', 5]]);
  for (let d = 1; d <= 5; d++) {
    s.dose(d, '08:00', 'ramipril', d === 3 ? { status: 'skipped' } : {});
    s.bp(d, '12:00', d === 3 ? 152 : 122, 78);
  }
  return s.now(5, '20:00').build();
}

/** #7 Readings after activity are excluded from patterns. */
export function excludedTags(): EngineSnapshot {
  const s = scenario().med('bisoprolol').regimen(1, '06:00', [['bisoprolol', 'morning', 5]]);
  for (let d = 1; d <= 4; d++) {
    s.dose(d, '08:00', 'bisoprolol');
    s.hr(d, '18:00', 112, ['after_activity']);
    s.hr(d, '21:30', 74);
  }
  return s.now(4, '21:00').build();
}

/** #8 Red flag: HR 41 at noon today. */
export function redFlag(): EngineSnapshot {
  const s = scenario().med('bisoprolol').regimen(1, '06:00', [['bisoprolol', 'morning', 5]]);
  s.hr(1, '12:00', 40); // older than 24 h at `now`: not a current red flag
  s.hr(3, '12:05', 41);
  s.symptom(3, '12:05', 'chest_pain', 8);
  return s.now(3, '13:30').build();
}

/** #9 Night readings after midnight belong to the previous day's Night slot. */
export function nightAfterMidnight(): EngineSnapshot {
  const s = scenario().med('ramipril').regimen(1, '06:00', [['ramipril', 'morning', 5]]);
  for (let d = 1; d <= 4; d++) s.dose(d, '08:00', 'ramipril');
  for (let d = 2; d <= 4; d++) s.bp(d, '01:30', 150, 85);
  return s.now(4, '12:00').build();
}

export const ALL_SCENARIOS = {
  issueExample, wearingOff, peakLow, changeImproved, amiodaroneTooEarly, missedDose, excludedTags, redFlag, nightAfterMidnight,
};

describe('engine scenarios (SPEC §5.7)', () => {
  it('#1 issue example → uncovered Morning and Noon, suggesting a dose in the preceding slot', () => {
    const r = runEngine(issueExample());
    const uncovered = ofType(r, 'uncovered_slot');
    const morning = uncovered.find((i) => i.slotId === 'morning' && i.component === 'sys');
    const noon = uncovered.find((i) => i.slotId === 'noon' && i.component === 'sys');
    expect(morning).toBeDefined();
    expect(noon).toBeDefined();
    expect(morning!.component).toBe('sys');
    expect(morning!.direction).toBe('above');
    expect(['medium', 'high']).toContain(morning!.confidence);
    expect(morning!.discussionPoint).toMatch(/Night/);
    expect(noon!.discussionPoint).toMatch(/Morning/);
    // R3 supersedes the plain slot pattern for the same key
    expect(ofType(r, 'slot_out_of_range').filter((i) => i.slotId === 'morning' && i.component === 'sys')).toHaveLength(0);
    // Evening and Night are in range
    expect(r.insights.some((i) => i.slotId === 'evening' || i.slotId === 'night')).toBe(false);
  });

  it('#2 wearing off → end_of_dose for metoprolol in the Morning', () => {
    const r = runEngine(wearingOff());
    const eod = ofType(r, 'end_of_dose');
    expect(eod).toHaveLength(1);
    expect(eod[0]).toMatchObject({ slotId: 'morning', medicationId: 'metoprolol_tartrate', direction: 'above', parameterId: 'hr' });
    expect(eod[0].explanation).toMatch(/13 h/);
    expect(ofType(r, 'uncovered_slot')).toHaveLength(0);
  });

  it('#3 peak low → peak_low for carvedilol with exhaustion as evidence', () => {
    const r = runEngine(peakLow());
    const pl = ofType(r, 'peak_low');
    expect(pl).toHaveLength(1);
    expect(pl[0]).toMatchObject({ medicationId: 'carvedilol', direction: 'below', component: 'sys' });
    expect(pl[0].evidence.filter((e) => e.kind === 'symptom')).toHaveLength(3);
    expect(ofType(r, 'slot_out_of_range')).toHaveLength(0);
  });

  it('#4 regimen change → evaluated, morning HR improved', () => {
    const r = runEngine(changeImproved());
    expect(r.changeEvaluations).toHaveLength(1);
    const ev = r.changeEvaluations[0];
    expect(ev.status).toBe('evaluated');
    expect(ev.diff).toEqual([{ medicationId: 'bisoprolol', slotId: 'morning', from: 2.5, to: 5 }]);
    const hr = ev.perSlot.find((p) => p.parameterId === 'hr' && p.slotId === 'morning');
    expect(hr).toMatchObject({ verdict: 'improved', before: { n: 5, inRangePct: 20 }, after: { n: 5, inRangePct: 80 } });
    expect(ev.summary).toMatch(/20 % → 80 %/);
  });

  it('#5 amiodarone change 3 days ago → too early, judgeable after about 3 weeks', () => {
    const r = runEngine(amiodaroneTooEarly());
    const ev = r.changeEvaluations[0];
    expect(ev.status).toBe('too_early');
    const days = (Date.parse(ev.judgeableFrom) - Date.parse(ev.effectiveFrom)) / 86_400_000;
    expect(days).toBeCloseTo(21, 0);
    expect(ev.summary).toMatch(/amiodarone/i);
    expect(ev.summary).toMatch(/3 weeks/);
  });

  it('#6 missed dose → missed_dose insight, no slot pattern at Noon', () => {
    const r = runEngine(missedDose());
    const md = ofType(r, 'missed_dose');
    expect(md).toHaveLength(1);
    expect(md[0].medicationId).toBe('ramipril');
    expect(md[0].evidence.map((e) => e.kind).sort()).toEqual(['dose', 'reading']);
    expect(r.insights.filter((i) => i.slotId === 'noon' && i.type !== 'missed_dose')).toHaveLength(0);
  });

  it('#7 readings tagged after_activity do not create patterns and are left out of slot stats', () => {
    const r = runEngine(excludedTags());
    expect(r.insights).toHaveLength(0);
    const evening = r.slotStats.find((s) => s.parameterId === 'hr' && s.slotId === 'evening');
    expect(evening?.n ?? 0).toBe(0);
  });

  it('#8 red flags for the last 24 h only, regardless of other rules', () => {
    const r = runEngine(redFlag());
    expect(r.redFlags.map((f) => f.title)).toEqual(['Heart rate 41 bpm', 'Chest pain 8/10']);
    expect(r.redFlags[0].message).toMatch(/Contact your care team now/);
  });

  it('#9 a reading at 01:30 belongs to Night of the previous day', () => {
    const r = runEngine(nightAfterMidnight());
    const night = ofType(r, 'slot_out_of_range').find((i) => i.slotId === 'night');
    expect(night).toBeDefined();
    expect(night!.confidence).toBe('low'); // 3 readings on 3 distinct days
  });

  it('#10 empty database → empty result, no throw', () => {
    const r = runEngine(scenario().now(1, '08:00').build());
    expect(r).toEqual({ redFlags: [], insights: [], changeEvaluations: [], slotStats: [] });
  });

  it('#11 no prescribing: no discussion point contains a dose amount', () => {
    const amount = /\d+(\.\d+)?\s?(mg|g|ml|mcg|µg)\b/i;
    for (const [name, build] of Object.entries(ALL_SCENARIOS)) {
      for (const insight of runEngine(build()).insights) {
        expect(insight.discussionPoint, `${name}: ${insight.key}`).not.toMatch(amount);
      }
    }
  });

  it('is deterministic', () => {
    for (const build of Object.values(ALL_SCENARIOS)) {
      const snap = build();
      expect(runEngine(snap)).toEqual(runEngine(structuredClone(snap)));
    }
  });
});
