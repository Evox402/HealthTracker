import { coverageAt, isFading, type Coverage } from '../coverage';
import { PRIORITY, type Draft } from '../draft';
import { mean, previousSlot, relevantMeds, slotName, type Ctx, type MedInfo } from '../preprocess';
import { uncoveredSlot as wording } from '../text';
import { MAJORITY, draftBase, patternFacts, type Pattern } from './slotOutOfRange';

// R3 (meta/SPEC.md §5.4): an above-range slot with no scheduled dose of any
// relevant medication, where the last dose has already worn off.

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

export function uncoveredSlot(ctx: Ctx, patterns: Pattern[]): Draft[] {
  const drafts: Draft[] = [];
  const items = ctx.current?.items ?? [];
  for (const pat of patterns) {
    if (pat.direction !== 'above') continue;
    const meds = relevantMeds(ctx, pat.out[0].parameter.kind);
    if (meds.length === 0) continue;
    const ids = new Set(meds.map((m) => m.med.id));
    const dosedSlots = new Set(items.filter((i) => ids.has(i.medicationId)).map((i) => i.slotId));
    if (dosedSlots.has(pat.slotId)) continue;

    const coverage = pat.out.map((p) => meds.map((m) => ({ m, c: coverageAt(p.at, m.med.id, m.pk!, ctx.doses) })));
    const allFading = coverage.filter((row) => row.every(({ c }) => isFading(c)));
    if (allFading.length / pat.out.length < MAJORITY) continue;

    // Name the medication whose last dose is most recent on average.
    const byMed = meds
      .map((m) => {
        const covs: Coverage[] = allFading.map((row) => row.find((x) => x.m === m)!.c).filter((c) => c.dose !== null);
        return { m, covs, avg: mean(covs.map((c) => c.hours!)) };
      })
      .filter((x): x is { m: MedInfo; covs: Coverage[]; avg: number } => x.avg !== null)
      .sort((a, b) => a.avg - b.avg || a.m.med.id.localeCompare(b.m.med.id));
    const named = byMed[0];
    if (!named) continue; // no dose logged at all yet: nothing to relate the pattern to
    const lastSlotId = mostCommon(named.covs.map((c) => c.dose!.slotId));

    const prev = previousSlot(ctx, pat.slotId);
    const suggest = prev.id !== lastSlotId && !dosedSlots.has(prev.id) ? prev.name : null;
    drafts.push({
      ...draftBase(pat),
      key: `uncovered_slot:${pat.base}`, type: 'uncovered_slot', priority: PRIORITY.uncovered_slot,
      medicationId: named.m.med.id,
      ...wording(patternFacts(ctx, pat), named.m.name, named.avg, named.m.pk!.durationH, slotName(ctx, lastSlotId), suggest),
    });
  }
  return drafts;
}
