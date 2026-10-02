import type { DoseEvent, DrugPK, ID } from '@/lib/types';
import { HOUR } from './preprocess';

// Coverage of a moment by one medication (meta/SPEC.md §5.2).

export type CoverageState = 'pre_onset' | 'peak' | 'covered' | 'wearing_off' | 'uncovered';

export interface Coverage {
  state: CoverageState;
  /** Hours since the last effective dose, null if there was none. */
  hours: number | null;
  dose: DoseEvent | null;
}

/** How long after `durationH` a dose still counts as "wearing off" rather than gone. */
export const WEARING_OFF_H = 6;

export function classifyHours(h: number, pk: DrugPK): CoverageState {
  if (h < pk.onsetH) return 'pre_onset';
  if (Math.abs(h - pk.peakH) <= Math.max(1, 0.25 * pk.durationH)) return 'peak';
  if (h <= pk.durationH) return 'covered';
  if (h <= pk.durationH + WEARING_OFF_H) return 'wearing_off';
  return 'uncovered';
}

export function isEffectiveDose(d: DoseEvent): boolean {
  return d.status !== 'skipped' && d.actualAmount > 0;
}

/** `doses` must be sorted by time. */
export function lastDoseBefore(t: number, medicationId: ID, doses: DoseEvent[]): DoseEvent | null {
  let last: DoseEvent | null = null;
  for (const d of doses) {
    if (Date.parse(d.takenAt) > t) break;
    if (d.medicationId === medicationId && isEffectiveDose(d)) last = d;
  }
  return last;
}

export function coverageAt(t: number, medicationId: ID, pk: DrugPK, doses: DoseEvent[]): Coverage {
  const dose = lastDoseBefore(t, medicationId, doses);
  if (!dose) return { state: 'uncovered', hours: null, dose: null };
  const hours = (t - Date.parse(dose.takenAt)) / HOUR;
  return { state: classifyHours(hours, pk), hours, dose };
}

export const isActive = (c: Coverage) => c.state === 'covered' || c.state === 'peak';
export const isFading = (c: Coverage) => c.state === 'wearing_off' || c.state === 'uncovered';
