import type { EvidenceRef, Insight } from '@/lib/types';
import type { Point, SymptomPoint } from './preprocess';

/** An insight before dedupe and sorting. */
export interface Draft extends Insight {
  /** Insights with the same base describe the same pattern; the highest priority wins (SPEC §5.5). */
  base: string;
  priority: number;
  latestAt: number;
  /** Set on slot patterns (R1–R3) so components of one parameter can be merged into one insight. */
  facts?: { componentIndex: number; label: string; nOut: number; nTotal: number };
}

export const PRIORITY = { slot_out_of_range: 1, end_of_dose: 2, uncovered_slot: 3, peak_low: 4, symptom_link: 1, missed_dose: 1 } as const;

export function readingEvidence(points: Point[]): EvidenceRef[] {
  return [...new Set(points.map((p) => p.readingId))].map((id) => ({ kind: 'reading', id }));
}

export function symptomEvidence(points: SymptomPoint[]): EvidenceRef[] {
  return points.map((s) => ({ kind: 'symptom', id: s.entry.id }));
}

export const latest = (items: { at: number }[]) => Math.max(...items.map((i) => i.at));

/** Base key of a slot pattern: parameter, component, slot, direction. */
export const patternBase = (p: Point, dir: string) => `${p.parameter.id}:${p.component.key}:${p.slotId}:${dir}`;
