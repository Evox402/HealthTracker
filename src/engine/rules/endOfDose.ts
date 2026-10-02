import { coverageAt, isActive, isFading } from '../coverage';
import { PRIORITY, type Draft } from '../draft';
import { mean, relevantMeds, type Ctx, type Point } from '../preprocess';
import { endOfDose as wording } from '../text';
import { MAJORITY, draftBase, patternFacts, type Pattern } from './slotOutOfRange';

// R2 (meta/SPEC.md §5.4): above-range readings happen when a medication's effect
// has worn off, while in-range readings happen while it is active.

export function endOfDose(ctx: Ctx, patterns: Pattern[], points: Point[]): Draft[] {
  const drafts: Draft[] = [];
  for (const pat of patterns) {
    if (pat.direction !== 'above') continue;
    const { parameter, component } = pat.out[0];
    const inRange = points.filter((p) => p.parameter.id === parameter.id && p.component.key === component.key && p.status === 'in');
    if (inRange.length === 0) continue;

    let best: { draft: Draft; share: number } | null = null;
    for (const m of relevantMeds(ctx, parameter.kind)) {
      const pk = m.pk!;
      const outCov = pat.out.map((p) => coverageAt(p.at, m.med.id, pk, ctx.doses));
      const fading = outCov.filter(isFading);
      const share = fading.length / pat.out.length;
      const inActive = inRange.filter((p) => isActive(coverageAt(p.at, m.med.id, pk, ctx.doses))).length;
      if (share < MAJORITY || inActive / inRange.length < MAJORITY) continue;

      // Contrast for the explanation: all readings of this component while the drug was active.
      const all = points.filter((p) => p.parameter.id === parameter.id && p.component.key === component.key);
      const active = all.filter((p) => isActive(coverageAt(p.at, m.med.id, pk, ctx.doses)));
      const hours = fading.map((c) => c.hours).filter((h): h is number => h !== null);
      if (hours.length === 0) continue;

      const draft: Draft = {
        ...draftBase(pat),
        key: `end_of_dose:${pat.base}`, type: 'end_of_dose', priority: PRIORITY.end_of_dose, medicationId: m.med.id,
        ...wording(patternFacts(ctx, pat), m.name, mean(hours)!, pk.durationH, active.filter((p) => p.status === 'in').length, active.length),
      };
      if (!best || share > best.share) best = { draft, share };
    }
    if (best) drafts.push(best.draft);
  }
  return drafts;
}
