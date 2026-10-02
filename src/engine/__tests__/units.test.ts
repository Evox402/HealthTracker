import type { DoseEvent, DrugPK } from '@/lib/types';
import { confidenceFor, scoreOf } from '../confidence';
import { classifyHours, coverageAt } from '../coverage';
import { DRUG_LIBRARY } from '../drugLibrary';
import { runEngine } from '../index';
import { buildContext, effectiveMed } from '../preprocess';
import { steadyStateDays } from '../rules/changeEvaluation';
import { fmtDuration, inSlot } from '../text';
import { scenario } from './fixtures';

const pk = (id: string): DrugPK => DRUG_LIBRARY.find((d) => d.id === id)!;

describe('classifyHours (metoprolol tartrate: onset 1, peak 1.5, duration 12)', () => {
  const m = pk('metoprolol_tartrate');
  it.each([
    [0.5, 'pre_onset'], [1, 'peak'], [4.5, 'peak'], [4.6, 'covered'], [12, 'covered'],
    [12.1, 'wearing_off'], [18, 'wearing_off'], [18.1, 'uncovered'],
  ])('%f h → %s', (h, state) => expect(classifyHours(h, m)).toBe(state));
});

describe('coverageAt', () => {
  const dose = (id: string, takenAt: string, status: DoseEvent['status'] = 'taken', actualAmount = 50): DoseEvent => ({
    id, medicationId: 'm', regimenVersionId: 'v1', slotId: 'morning', plannedAmount: 50, actualAmount, status, takenAt,
  });
  const doses = [dose('a', '2026-09-30T06:00:00Z'), dose('b', '2026-09-30T18:00:00Z', 'skipped', 0)];
  const m = pk('metoprolol_tartrate');

  it('uses the last effective dose, ignoring skipped ones', () => {
    const c = coverageAt(Date.parse('2026-09-30T19:00:00Z'), 'm', m, doses);
    expect(c.dose?.id).toBe('a');
    expect(c.hours).toBe(13);
    expect(c.state).toBe('wearing_off');
  });

  it('is uncovered before any dose', () => {
    expect(coverageAt(Date.parse('2026-09-30T05:00:00Z'), 'm', m, doses)).toEqual({ state: 'uncovered', hours: null, dose: null });
  });
});

describe('confidence', () => {
  it.each([[2, 2, 'low'], [3, 3, 'low'], [4, 2, 'medium'], [6, 3, 'medium'], [7, 3, 'high'], [7, 1, 'medium'], [4, 1, 'low'], [2, 1, 'low']])(
    'n=%i over %i days → %s', (n, days, c) => expect(confidenceFor(n, days)).toBe(c),
  );
  it('scores severity × confidence', () => {
    expect(scoreOf('low', 1)).toBe(1);
    expect(scoreOf('high', 2)).toBe(6);
  });
});

describe('text helpers', () => {
  it('uses "at" for Noon and Night', () => {
    expect(inSlot('Morning')).toBe('in the Morning');
    expect(inSlot('Noon')).toBe('at Noon');
    expect(inSlot('Night')).toBe('at Night');
  });
  it('formats durations', () => {
    expect(fmtDuration(1)).toBe('1 day');
    expect(fmtDuration(3)).toBe('3 days');
    expect(fmtDuration(21)).toBe('3 weeks');
  });
});

describe('effective medication data', () => {
  it('applies overrides on top of the library', () => {
    const snap = scenario().med('bisoprolol', { pkOverride: { durationH: 20 } }).build();
    expect(effectiveMed(snap.medications[0], snap).pk?.durationH).toBe(20);
  });

  it('treats a custom medication without timing as not timing-sensitive', () => {
    const snap = scenario().med('mystery', { affectsOverride: ['bp'] }).build();
    expect(effectiveMed(snap.medications[0], snap).pk).toBeNull();
  });

  it('accepts timing for a custom medication', () => {
    const snap = scenario().med('custom_bb', { pkOverride: { durationH: 8, onsetH: 1 }, affectsOverride: ['hr'] }).build();
    expect(effectiveMed(snap.medications[0], snap).pk).toMatchObject({ durationH: 8, onsetH: 1, timingSensitive: true });
  });

  it('derives steady-state days', () => {
    expect(steadyStateDays(undefined)).toBe(1);
    const snap = scenario().med('x', { pkOverride: { durationH: 12, halfLifeH: 30, steadyStateDays: 0 } }).build();
    expect(steadyStateDays(effectiveMed(snap.medications[0], snap))).toBe(7);
  });
});

describe('preprocessing', () => {
  it('ignores future readings and archived parameters', () => {
    const s = scenario();
    s.hr(1, '08:00', 70);
    s.hr(2, '08:00', 70);
    const snap = s.now(1, '12:00').build();
    expect(buildContext(snap).points).toHaveLength(1);
    snap.parameters.find((p) => p.id === 'hr')!.archived = true;
    expect(buildContext(snap).points).toHaveLength(0);
  });

  it('limits the pattern window to the current regimen', () => {
    const s = scenario().med('bisoprolol')
      .regimen(1, '06:00', [['bisoprolol', 'morning', 2.5]])
      .regimen(3, '06:00', [['bisoprolol', 'morning', 5]]);
    s.hr(2, '08:00', 70);
    s.hr(3, '08:00', 70);
    expect(buildContext(s.now(4, '08:00').build()).windowPoints).toHaveLength(1);
  });
});

describe('rules beyond the SPEC scenarios', () => {
  it('merges systolic and diastolic into one insight', () => {
    const s = scenario();
    for (let d = 1; d <= 3; d++) s.bp(d, '07:00', 145, 88);
    const slot = runEngine(s.now(3, '12:00').build()).insights.filter((i) => i.type === 'slot_out_of_range');
    expect(slot).toHaveLength(1);
    expect(slot[0].component).toBe('sys');
    expect(slot[0].explanation).toMatch(/Diastolic BP was also above range in 3 of 3 readings/);
  });

  it('reports a below-range slot pattern', () => {
    const s = scenario();
    for (let d = 1; d <= 2; d++) s.hr(d, '22:00', 55);
    const [i] = runEngine(s.now(3, '08:00').build()).insights;
    expect(i).toMatchObject({ type: 'slot_out_of_range', direction: 'below', slotId: 'night', title: 'Heart rate below range at Night' });
  });

  it('notes when a dose had not started working yet', () => {
    const s = scenario().med('ramipril').regimen(1, '06:00', [['ramipril', 'morning', 5]]);
    for (let d = 1; d <= 3; d++) {
      s.dose(d, '08:00', 'ramipril');
      s.bp(d, '08:30', 145, 75);
    }
    const [i] = runEngine(s.now(3, '12:00').build()).insights;
    expect(i.explanation).toMatch(/had likely not reached its effect yet/);
  });

  it('links a symptom to out-of-range readings in the same slot', () => {
    const s = scenario();
    for (let d = 1; d <= 3; d++) {
      s.hr(d, '19:00', 52);
      s.symptom(d, '19:00', 'nausea', 5);
    }
    const link = runEngine(s.now(3, '22:00').build()).insights.find((i) => i.type === 'symptom_link');
    expect(link?.title).toBe('Nausea often coincides with heart rate below range');
    expect(link?.evidence).toHaveLength(6);
  });

  it('links a symptom to a medication peak', () => {
    const s = scenario().med('ivabradine').regimen(1, '06:00', [['ivabradine', 'morning', 5]]);
    for (let d = 1; d <= 2; d++) {
      s.dose(d, '08:00', 'ivabradine');
      s.symptom(d, '09:00', 'sluggishness', 6);
    }
    const link = runEngine(s.now(2, '20:00').build()).insights.find((i) => i.type === 'symptom_link');
    expect(link?.title).toBe('Sluggishness often coincides with the expected peak of Ivabradine');
  });

  it('does not link unrelated symptoms', () => {
    const s = scenario();
    s.symptom(1, '09:00', 'back_pain', 6);
    s.symptom(2, '09:00', 'back_pain', 6);
    expect(runEngine(s.now(2, '20:00').build()).insights).toHaveLength(0);
  });

  it('never explains chest pain, only reports it neutrally', () => {
    const s = scenario();
    for (let d = 1; d <= 2; d++) {
      s.bp(d, '07:00', 150, 85);
      s.symptom(d, '07:00', 'chest_pain', 4);
    }
    const chest = runEngine(s.now(2, '20:00').build()).insights.find((i) => i.key === 'symptom_link:chest_pain');
    expect(chest?.title).toBe('Chest pain above threshold 2 times');
    expect(chest?.discussionPoint).toBe('Mention the chest pain episodes to the care team.');
  });

  it('flags a reduced dose as missed', () => {
    const s = scenario().med('bisoprolol').regimen(1, '06:00', [['bisoprolol', 'morning', 5]]);
    s.dose(1, '08:00', 'bisoprolol', { status: 'changed', amount: 2.5 });
    s.hr(1, '12:00', 96);
    const [i] = runEngine(s.now(1, '20:00').build()).insights;
    expect(i.type).toBe('missed_dose');
    expect(i.title).toMatch(/reduced/);
  });

  it('flags red-flag highs too', () => {
    const s = scenario();
    s.bp(1, '08:00', 185, 112);
    const flags = runEngine(s.now(1, '09:00').build()).redFlags;
    expect(flags.map((f) => f.title)).toEqual(['Systolic BP 185 mmHg', 'Diastolic BP 112 mmHg']);
  });

  it('marks a change with too few readings as insufficient data', () => {
    const s = scenario().med('bisoprolol')
      .regimen(1, '06:00', [['bisoprolol', 'morning', 2.5]])
      .regimen(3, '06:00', [['bisoprolol', 'morning', 5]]);
    s.hr(2, '08:00', 95);
    s.hr(8, '08:00', 80);
    const [ev] = runEngine(s.now(8, '12:00').build()).changeEvaluations;
    expect(ev.status).toBe('insufficient_data');
    expect(ev.perSlot[0].verdict).toBe('unknown');
  });

  it('reports a change that made things worse, and a stopped medication', () => {
    const s = scenario().med('bisoprolol').med('ramipril')
      .regimen(1, '06:00', [['bisoprolol', 'morning', 5], ['ramipril', 'evening', 5]])
      .regimen(4, '06:00', [['bisoprolol', 'morning', 5]], 'Ramipril paused');
    [1, 2, 3].forEach((d) => s.bp(d, '19:00', 120, 75));
    [8, 9, 10].forEach((d) => s.bp(d, '19:00', 142, 86));
    const [ev] = runEngine(s.now(10, '22:00').build()).changeEvaluations;
    expect(ev.status).toBe('evaluated');
    expect(ev.diff).toEqual([{ medicationId: 'ramipril', slotId: 'evening', from: 5, to: null }]);
    expect(ev.perSlot.find((p) => p.component === 'sys')?.verdict).toBe('worse');
    expect(ev.summary).toMatch(/^Since Thu 1 Oct \(Ramipril stopped, evening\): evening systolic BP in range 100 % → 0 %/);
  });

  it('computes slot stats for the window', () => {
    const s = scenario();
    s.hr(1, '08:00', 95);
    s.hr(2, '08:00', 75);
    expect(runEngine(s.now(2, '12:00').build()).slotStats).toEqual([
      { parameterId: 'hr', component: 'value', slotId: 'morning', n: 2, inRangePct: 50, mean: 85 },
    ]);
  });
});
