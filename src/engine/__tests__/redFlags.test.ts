import { runEngine } from '../index';
import { redFlagReading, redFlagSymptom } from '../text';
import { scenario } from './fixtures';

// Red flags (meta/SPEC.md §5): the only rule left in the engine.

describe('red flags (SPEC §5)', () => {
  it('flags readings and scale symptoms of the last 24 h, oldest first', () => {
    const s = scenario();
    s.hr(1, '12:00', 40); // older than 24 h at `now`: not a current red flag
    s.hr(3, '12:05', 41);
    s.symptom(3, '12:05', 'chest_pain', 8);
    s.bp(3, '12:30', 185, 95);
    const r = runEngine(s.now(3, '13:30').build());
    expect(r.redFlags.map((f) => f.title)).toEqual(['Heart rate 41 bpm', 'Chest pain 8/10', 'Systolic BP 185 mmHg']);
    expect(r.redFlags[0].message).toMatch(/Contact your care team now/);
    expect(r.redFlags[0]).toMatchObject({ source: 'reading', key: expect.stringMatching(/^rf:/) });
  });

  it('flags both BP components separately', () => {
    const s = scenario();
    s.bp(1, '08:00', 85, 115);
    const r = runEngine(s.now(1, '09:00').build());
    expect(r.redFlags.map((f) => f.title)).toEqual(['Systolic BP 85 mmHg', 'Diastolic BP 115 mmHg']);
  });

  it('ignores values inside the limits, future entries and archived trackers', () => {
    const s = scenario();
    s.hr(1, '08:00', 72);
    s.hr(1, '20:00', 30); // after `now`
    s.reading(1, '08:00', 'spo2', { value: 85 }); // spo2 archived by default
    s.symptom(1, '08:00', 'chest_pain', 6); // below redFlagAt 7
    expect(runEngine(s.now(1, '09:00').build()).redFlags).toEqual([]);
  });

  it('never flags stool or event trackers, even with a stray redFlagAt', () => {
    const s = scenario();
    s.symptoms.push({ id: 'stool', name: 'Stool', type: 'stool', threshold: 0, redFlagAt: 1, order: 9, archived: false });
    s.symptom(1, '08:00', 'stool', 7);
    expect(runEngine(s.now(1, '09:00').build()).redFlags).toEqual([]);
  });

  it('handles weight and custom trackers without targets or limits', () => {
    const s = scenario();
    s.reading(1, '07:00', 'weight', { value: 82.4 });
    expect(runEngine(s.now(1, '09:00').build()).redFlags).toEqual([]);
  });

  it('empty database → empty result, no throw', () => {
    expect(runEngine(scenario().now(1, '08:00').build())).toEqual({ redFlags: [] });
  });

  it('no prescribing: red-flag wording never contains a dose amount', () => {
    const amount = /\d+(\.\d+)?\s?(mg|g|ml|mcg|µg)\b/i;
    const s = scenario();
    const texts = [
      ...s.parameters.flatMap((p) => p.components.map((c) => redFlagReading(p, c, 1, 'below', 2))),
      redFlagSymptom('Chest pain', 9, 7),
    ];
    for (const t of texts) {
      expect(t.title).not.toMatch(amount);
      expect(t.message).not.toMatch(amount);
      expect(t.message).not.toMatch(/\b(increase|decrease|reduce|raise|stop|take)\b/i);
    }
  });

  it('is deterministic', () => {
    const s = scenario();
    s.hr(1, '08:00', 41);
    const snap = s.now(1, '09:00').build();
    expect(runEngine(snap)).toEqual(runEngine(structuredClone(snap)));
  });
});
