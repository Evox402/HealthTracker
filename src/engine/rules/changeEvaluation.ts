import type { ChangeEvaluation, RegimenItem, RegimenVersion } from '@/lib/types';
import { DAY, slotName, type Ctx, type MedInfo, type Point } from '../preprocess';
import { changeEvaluated, changeInsufficient, changeLabel, changePart, changeTooEarly, labelLower, pct } from '../text';

// R5 (meta/SPEC.md §5.4): compare in-range % per slot before and after each
// regimen change, once the changed drugs had time to reach steady state.

export const MIN_N = 2;
export const VERDICT_DELTA = 20; // percentage points

type Diff = ChangeEvaluation['diff'][number];

function diffOf(prev: RegimenVersion, next: RegimenVersion): Diff[] {
  const key = (i: RegimenItem) => `${i.medicationId}|${i.slotId}`;
  const before = new Map(prev.items.map((i) => [key(i), i]));
  const after = new Map(next.items.map((i) => [key(i), i]));
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  return keys
    .map((k) => {
      const [medicationId, slotId] = k.split('|');
      return { medicationId, slotId, from: before.get(k)?.amount ?? null, to: after.get(k)?.amount ?? null };
    })
    .filter((d) => d.from !== d.to);
}

/** Days until a change of this medication can be judged. */
export function steadyStateDays(m: MedInfo | undefined): number {
  const pk = m?.pk;
  if (!pk) return 1;
  if (pk.steadyStateDays > 0) return pk.steadyStateDays;
  return Math.max(1, Math.ceil((5 * pk.halfLifeH) / 24));
}

function stats(points: Point[]) {
  const n = points.length;
  const inRange = points.filter((p) => p.status === 'in').length;
  return { n, inRangePct: pct(inRange, n), mean: n ? Math.round((points.reduce((a, p) => a + p.value, 0) / n) * 10) / 10 : null };
}

function groupKey(p: Point) {
  return `${p.parameter.id}|${p.component.key}|${p.slotId}`;
}

export function changeEvaluation(ctx: Ctx): ChangeEvaluation[] {
  const regimens = [...ctx.snap.regimens]
    .filter((r) => Date.parse(r.effectiveFrom) <= ctx.now)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const points = ctx.points.filter((p) => !p.excluded);
  const windowMs = ctx.snap.settings.analysisWindowDays * DAY;
  const slotOrder = new Map(ctx.slots.map((s, i) => [s.id, i]));
  const paramOrder = new Map(ctx.snap.parameters.map((p) => [p.id, p.order]));

  const evaluations: ChangeEvaluation[] = [];
  for (let i = 1; i < regimens.length; i++) {
    const prev = regimens[i - 1];
    const cur = regimens[i];
    const next = regimens[i + 1];
    const effective = Date.parse(cur.effectiveFrom);
    const diff = diffOf(prev, cur);

    const changed = [...new Set(diff.map((d) => d.medicationId))];
    const slowest = changed
      .map((id) => ({ id, days: steadyStateDays(ctx.meds.get(id)) }))
      .sort((a, b) => b.days - a.days || a.id.localeCompare(b.id))[0];
    const settleDays = slowest?.days ?? 1;
    const judgeable = effective + settleDays * DAY;

    const base = {
      regimenVersionId: cur.id, effectiveFrom: cur.effectiveFrom, note: cur.note, diff,
      judgeableFrom: new Date(judgeable).toISOString(),
    };

    if (ctx.now < judgeable) {
      const daysAgo = Math.floor((ctx.now - effective) / DAY);
      evaluations.push({
        ...base, status: 'too_early', perSlot: [],
        summary: changeTooEarly(daysAgo, ctx.meds.get(slowest?.id ?? '')?.name ?? 'this medication', settleDays),
      });
      continue;
    }

    const beforeStart = Math.max(Date.parse(prev.effectiveFrom), effective - windowMs);
    const afterEnd = Math.min(next ? Date.parse(next.effectiveFrom) : Infinity, ctx.now);
    const before = points.filter((p) => p.at >= beforeStart && p.at < effective);
    const after = points.filter((p) => p.at >= judgeable && p.at <= afterEnd);

    const keys = [...new Set([...before, ...after].map(groupKey))];
    const sample = new Map<string, Point>();
    for (const p of [...before, ...after]) if (!sample.has(groupKey(p))) sample.set(groupKey(p), p);
    keys.sort((a, b) => {
      const pa = sample.get(a)!;
      const pb = sample.get(b)!;
      return (paramOrder.get(pa.parameter.id) ?? 0) - (paramOrder.get(pb.parameter.id) ?? 0)
        || pa.parameter.components.indexOf(pa.component) - pb.parameter.components.indexOf(pb.component)
        || (slotOrder.get(pa.slotId) ?? 0) - (slotOrder.get(pb.slotId) ?? 0);
    });

    const perSlot: ChangeEvaluation['perSlot'] = keys.map((k) => {
      const p = sample.get(k)!;
      const b = stats(before.filter((x) => groupKey(x) === k));
      const a = stats(after.filter((x) => groupKey(x) === k));
      let verdict: ChangeEvaluation['perSlot'][number]['verdict'] = 'unknown';
      if (b.n >= MIN_N && a.n >= MIN_N) {
        const delta = a.inRangePct - b.inRangePct;
        verdict = delta >= VERDICT_DELTA ? 'improved' : delta <= -VERDICT_DELTA ? 'worse' : 'unchanged';
      }
      return { parameterId: p.parameter.id, component: p.component.key, slotId: p.slotId, before: b, after: a, verdict };
    });

    const known = perSlot.filter((s) => s.verdict !== 'unknown');
    if (known.length === 0) {
      evaluations.push({ ...base, status: 'insufficient_data', perSlot, summary: changeInsufficient() });
      continue;
    }

    const diffText = diff.map((d) => {
      const m = ctx.meds.get(d.medicationId);
      return changeLabel(m?.name ?? d.medicationId, d.from, d.to, m?.med.unit ?? '', slotName(ctx, d.slotId).toLowerCase());
    }).join(', ') || 'no dose changes';
    const notable = known.filter((s) => s.verdict !== 'unchanged');
    const parts = (notable.length > 0 ? notable : known).map((s) => {
      const p = sample.get(`${s.parameterId}|${s.component}|${s.slotId}`)!;
      return changePart(slotName(ctx, s.slotId), labelLower(p.parameter, p.component), s.before.inRangePct, s.after.inRangePct, s.verdict);
    });
    evaluations.push({
      ...base, status: 'evaluated', perSlot,
      summary: changeEvaluated(effective, diffText, parts, notable.length > 0 && notable.length < known.length),
    });
  }
  return evaluations;
}

