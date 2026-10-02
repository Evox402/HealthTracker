import type { DoseEvent } from '@/lib/types';
import { confidenceFor, scoreOf, severityOf } from '../confidence';
import { PRIORITY, latest, readingEvidence, type Draft } from '../draft';
import { DAY, distinctDays, relevantMeds, slotName, type Ctx, type Point } from '../preprocess';
import { missedDose as wording } from '../text';

// R7 (meta/SPEC.md §5.4): out-of-range readings after a skipped or reduced planned
// dose. Returns the insights plus the reading ids they explain, which the pattern
// rules (R1–R4) then leave out.

export interface MissedDoseResult {
  drafts: Draft[];
  explained: Set<string>;
}

function lastPlannedDose(ctx: Ctx, medicationId: string, t: number): DoseEvent | null {
  let last: DoseEvent | null = null;
  for (const d of ctx.doses) {
    const at = Date.parse(d.takenAt);
    if (at > t) break;
    if (d.medicationId === medicationId && d.status !== 'extra' && at >= t - DAY) last = d;
  }
  return last;
}

function isMissed(d: DoseEvent): boolean {
  if (d.status === 'skipped') return true;
  return d.status === 'changed' && d.plannedAmount !== null && d.actualAmount < d.plannedAmount;
}

export function missedDose(ctx: Ctx): MissedDoseResult {
  const groups = new Map<string, { dose: DoseEvent; points: Point[] }>();
  for (const p of ctx.windowPoints) {
    if (p.excluded || p.status === 'in') continue;
    for (const m of relevantMeds(ctx, p.parameter.kind)) {
      const dose = lastPlannedDose(ctx, m.med.id, p.at);
      if (!dose || !isMissed(dose)) continue;
      const key = `${dose.id}:${p.parameter.id}:${p.component.key}`;
      const g = groups.get(key) ?? { dose, points: [] };
      g.points.push(p);
      groups.set(key, g);
    }
  }

  const drafts: Draft[] = [];
  const explained = new Set<string>();
  for (const [key, { dose, points }] of groups) {
    points.forEach((p) => explained.add(p.readingId));
    const p0 = points[0];
    const info = ctx.meds.get(dose.medicationId)!;
    const at = Date.parse(dose.takenAt);
    const confidence = confidenceFor(points.length, distinctDays(points));
    drafts.push({
      key: `missed_dose:${key}`, base: `missed_dose:${key}`, priority: PRIORITY.missed_dose,
      type: 'missed_dose', parameterId: p0.parameter.id, component: p0.component.key, slotId: dose.slotId,
      medicationId: dose.medicationId, direction: p0.status === 'below' ? 'below' : 'above', confidence,
      ...wording(info.name, slotName(ctx, dose.slotId), at, dose.status === 'changed', p0.parameter, p0.component,
        points.map((p) => ({ at: p.at, value: p.value, dir: p.status === 'below' ? 'below' : 'above' }))),
      evidence: [{ kind: 'dose', id: dose.id }, ...readingEvidence(points)],
      score: scoreOf(confidence, severityOf(points)),
      latestAt: latest(points),
    });
  }
  return { drafts, explained };
}
