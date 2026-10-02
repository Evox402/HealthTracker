import type { Direction } from '@/lib/types';
import { confidenceFor, scoreOf, severityOf } from '../confidence';
import { coverageAt } from '../coverage';
import { PRIORITY, latest, patternBase, readingEvidence, type Draft } from '../draft';
import { distinctDays, mean, relevantMeds, slotName, type Ctx, type Point } from '../preprocess';
import { componentLabel, slotOutOfRange as wording } from '../text';

// R1 (meta/SPEC.md §5.4): a parameter component is out of range in the same
// direction in at least half of a slot's readings (and at least twice).

export interface Pattern {
  base: string;
  direction: Direction;
  slotId: string;
  /** All pattern-eligible points of this parameter component in the slot. */
  all: Point[];
  out: Point[];
}

export const MIN_OUT = 2;
export const MIN_SHARE = 0.5;
/** Share of supporting readings a timing explanation must cover (R2–R4, R6). */
export const MAJORITY = 0.6;

/** Points eligible for pattern rules: in the window, not tagged, not explained by a missed dose. */
export function patternPoints(ctx: Ctx, explained: Set<string>): Point[] {
  return ctx.windowPoints.filter((p) => !p.excluded && !explained.has(p.readingId));
}

export function findPatterns(points: Point[]): Pattern[] {
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const k = `${p.parameter.id}:${p.component.key}:${p.slotId}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const patterns: Pattern[] = [];
  for (const all of groups.values()) {
    for (const direction of ['above', 'below'] as const) {
      const out = all.filter((p) => p.status === direction);
      if (out.length >= MIN_OUT && out.length / all.length >= MIN_SHARE) {
        patterns.push({ base: patternBase(all[0], direction), direction, slotId: all[0].slotId, all, out });
      }
    }
  }
  return patterns;
}

export function patternFacts(ctx: Ctx, pat: Pattern) {
  const p = pat.out[0];
  return {
    p: p.parameter, c: p.component, slot: slotName(ctx, pat.slotId), dir: pat.direction,
    nOut: pat.out.length, nTotal: pat.all.length, meanOut: mean(pat.out.map((x) => x.value))!,
  };
}

export function draftBase(pat: Pattern) {
  const p = pat.out[0];
  const confidence = confidenceFor(pat.out.length, distinctDays(pat.out));
  return {
    base: pat.base, parameterId: p.parameter.id, component: p.component.key, slotId: pat.slotId,
    direction: pat.direction, confidence, evidence: readingEvidence(pat.out),
    score: scoreOf(confidence, severityOf(pat.out)), latestAt: latest(pat.out),
    facts: {
      componentIndex: p.parameter.components.indexOf(p.component), label: componentLabel(p.parameter, p.component),
      nOut: pat.out.length, nTotal: pat.all.length,
    },
  };
}

/** A relevant medication had been taken too recently to act at most of the out-of-range readings. */
function preOnset(ctx: Ctx, pat: Pattern) {
  for (const m of relevantMeds(ctx, pat.out[0].parameter.kind)) {
    const n = pat.out.filter((p) => coverageAt(p.at, m.med.id, m.pk!, ctx.doses).state === 'pre_onset').length;
    if (n / pat.out.length >= MAJORITY) return { med: m.name, onsetH: m.pk!.onsetH };
  }
  return undefined;
}

export function slotOutOfRange(ctx: Ctx, patterns: Pattern[]): Draft[] {
  return patterns.map((pat) => ({
    ...draftBase(pat),
    key: `slot_out_of_range:${pat.base}`, type: 'slot_out_of_range' as const, priority: PRIORITY.slot_out_of_range,
    ...wording(patternFacts(ctx, pat), pat.direction === 'above' ? preOnset(ctx, pat) : undefined),
  }));
}
