import { confidenceFor, scoreOf, severityOf } from '../confidence';
import { coverageAt } from '../coverage';
import { PRIORITY, latest, readingEvidence, symptomEvidence, type Draft } from '../draft';
import { distinctDays, relevantMeds, type Ctx, type Point, type SymptomPoint } from '../preprocess';
import { peakLow as wording } from '../text';
import { MAJORITY, MIN_OUT } from './slotOutOfRange';

// R4 (meta/SPEC.md §5.4): below-range readings cluster around a medication's
// expected peak effect. Fatigue-type symptoms in the same slot and day are added
// as evidence.

const FATIGUE = /exhaust|slugg|fatigue|tired|dizz|weak/i;

export interface PeakLowResult {
  drafts: Draft[];
  /** Symptom entries attached as evidence, so R6 does not report them again. */
  usedSymptoms: Set<string>;
}

export function peakLow(ctx: Ctx, points: Point[]): PeakLowResult {
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    if (p.status !== 'below') continue;
    const k = `${p.parameter.id}:${p.component.key}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }

  const drafts: Draft[] = [];
  const usedSymptoms = new Set<string>();
  for (const [k, below] of groups) {
    const { parameter, component } = below[0];
    for (const m of relevantMeds(ctx, parameter.kind)) {
      const atPeak = below.filter((p) => coverageAt(p.at, m.med.id, m.pk!, ctx.doses).state === 'peak');
      if (atPeak.length < MIN_OUT || atPeak.length / below.length < MAJORITY) continue;

      const symptoms: SymptomPoint[] = ctx.windowSymptoms.filter((s) =>
        s.above && FATIGUE.test(s.symptom.name) && atPeak.some((p) => p.day === s.day && p.slotId === s.slotId));
      symptoms.forEach((s) => usedSymptoms.add(s.entry.id));
      const named = symptoms.length > 0 ? { name: symptoms[0].symptom.name, count: symptoms.length } : null;

      const confidence = confidenceFor(atPeak.length, distinctDays(atPeak));
      const base = `peak_low:${k}:${m.med.id}`;
      drafts.push({
        key: base, base, priority: PRIORITY.peak_low, type: 'peak_low',
        parameterId: parameter.id, component: component.key, medicationId: m.med.id, direction: 'below', confidence,
        ...wording(parameter, component, m.name, atPeak.length, below.length, m.pk!.peakH, named),
        evidence: [...readingEvidence(atPeak), ...symptomEvidence(symptoms)],
        score: scoreOf(confidence, severityOf(atPeak)),
        latestAt: latest(atPeak),
      });
    }
  }
  return { drafts, usedSymptoms };
}
