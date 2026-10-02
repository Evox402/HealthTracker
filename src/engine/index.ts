import type { EngineResult, EngineSnapshot, Insight } from '@/lib/types';
import type { Draft } from './draft';
import { buildContext } from './preprocess';
import { redFlags } from './redFlags';
import { changeEvaluation } from './rules/changeEvaluation';
import { endOfDose } from './rules/endOfDose';
import { missedDose } from './rules/missedDose';
import { peakLow } from './rules/peakLow';
import { findPatterns, patternPoints, slotOutOfRange } from './rules/slotOutOfRange';
import { symptomLink } from './rules/symptomLink';
import { uncoveredSlot } from './rules/uncoveredSlot';
import { slotStats } from './slotStats';
import { alsoComponent } from './text';

// Insights engine (meta/SPEC.md §5). Pure and deterministic: no I/O, no clock,
// no randomness. `snapshot.now` is the only notion of time.

export { DRUG_LIBRARY } from './drugLibrary';

/** One draft per base key: highest priority wins, evidence is merged (SPEC §5.5). */
export function dedupe(drafts: Draft[]): Draft[] {
  const byBase = new Map<string, Draft>();
  for (const d of drafts) {
    const prev = byBase.get(d.base);
    if (!prev) {
      byBase.set(d.base, d);
      continue;
    }
    const [win, lose] = d.priority > prev.priority ? [d, prev] : [prev, d];
    const ids = new Set(win.evidence.map((e) => `${e.kind}:${e.id}`));
    byBase.set(d.base, { ...win, evidence: [...win.evidence, ...lose.evidence.filter((e) => !ids.has(`${e.kind}:${e.id}`))] });
  }
  return [...byBase.values()];
}

/**
 * Merges the same slot pattern on several components of one parameter (systolic
 * and diastolic BP) into one insight led by the strongest component.
 */
export function mergeComponents(drafts: Draft[]): Draft[] {
  const groups = new Map<string, Draft[]>();
  const rest: Draft[] = [];
  for (const d of drafts) {
    if (!d.facts) {
      rest.push(d);
      continue;
    }
    const k = [d.type, d.parameterId, d.slotId, d.direction, d.medicationId ?? ''].join('|');
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.score - a.score || a.facts!.componentIndex - b.facts!.componentIndex);
    const [lead, ...others] = group;
    const ids = new Set(lead.evidence.map((e) => `${e.kind}:${e.id}`));
    rest.push({
      ...lead,
      explanation: lead.explanation + others.map((o) => alsoComponent(o.facts!.label, o.direction!, o.facts!.nOut, o.facts!.nTotal)).join(''),
      evidence: [...lead.evidence, ...others.flatMap((o) => o.evidence).filter((e) => !ids.has(`${e.kind}:${e.id}`) && ids.add(`${e.kind}:${e.id}`))],
      latestAt: Math.max(...group.map((g) => g.latestAt)),
    });
  }
  return rest;
}

/** Drops below-range slot patterns that a peak-low insight already explains. */
function supersededByPeakLow(drafts: Draft[], peak: Draft[]): Draft[] {
  return drafts.filter((d) => {
    if (d.type !== 'slot_out_of_range' || d.direction !== 'below') return true;
    return !peak.some((pl) =>
      pl.parameterId === d.parameterId && pl.component === d.component &&
      d.evidence.every((e) => pl.evidence.some((x) => x.kind === e.kind && x.id === e.id)));
  });
}

function toInsight({ base: _b, priority: _p, latestAt: _l, facts: _f, ...insight }: Draft): Insight {
  return insight;
}

export function runEngine(snapshot: EngineSnapshot): EngineResult {
  const ctx = buildContext(snapshot);

  const missed = missedDose(ctx);
  const points = patternPoints(ctx, missed.explained);
  const patterns = findPatterns(points);
  const peak = peakLow(ctx, points);

  const slotDrafts = mergeComponents(dedupe([
    ...slotOutOfRange(ctx, patterns),
    ...endOfDose(ctx, patterns, points),
    ...uncoveredSlot(ctx, patterns),
  ]));

  const drafts = [
    ...supersededByPeakLow(slotDrafts, peak.drafts),
    ...peak.drafts,
    ...symptomLink(ctx, points, peak.usedSymptoms),
    ...missed.drafts,
  ].sort((a, b) => b.score - a.score || b.latestAt - a.latestAt || a.key.localeCompare(b.key));

  return {
    redFlags: redFlags(ctx),
    insights: drafts.map(toInsight),
    changeEvaluations: changeEvaluation(ctx),
    slotStats: slotStats(ctx),
  };
}
