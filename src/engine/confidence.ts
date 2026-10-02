import type { Confidence } from '@/lib/types';
import type { Point } from './preprocess';

// Confidence and scoring (meta/SPEC.md §5.3).

const LEVELS: Confidence[] = ['low', 'medium', 'high'];

export function confidenceFor(n: number, distinctDays: number): Confidence {
  let level = n >= 7 ? 2 : n >= 4 ? 1 : 0;
  if (distinctDays < 2) level = Math.max(0, level - 1);
  return LEVELS[level];
}

/** 2 if any supporting value is more than 15 % outside its target bound, else 1. */
export function severityOf(points: Point[]): 1 | 2 {
  const far = points.some((p) =>
    (p.status === 'above' && p.value > p.component.targetMax * 1.15) ||
    (p.status === 'below' && p.value < p.component.targetMin * 0.85));
  return far ? 2 : 1;
}

export function scoreOf(confidence: Confidence, severity: number): number {
  return severity * (LEVELS.indexOf(confidence) + 1);
}
