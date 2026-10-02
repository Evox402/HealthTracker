import type { SlotStat } from '@/lib/types';
import type { Ctx, Point } from './preprocess';
import { pct } from './text';

// In-range share and mean per parameter component and slot over the pattern
// window (current regimen, last analysisWindowDays). Tagged readings are left out.

export function slotStats(ctx: Ctx): SlotStat[] {
  const stats: SlotStat[] = [];
  const params = [...ctx.snap.parameters].filter((p) => !p.archived).sort((a, b) => a.order - b.order);
  const points = ctx.windowPoints.filter((p) => !p.excluded);
  for (const param of params) {
    for (const component of param.components) {
      for (const slot of ctx.slots) {
        const group: Point[] = points.filter((p) => p.parameter.id === param.id && p.component.key === component.key && p.slotId === slot.id);
        if (group.length === 0) continue;
        const inRange = group.filter((p) => p.status === 'in').length;
        const mean = group.reduce((a, p) => a + p.value, 0) / group.length;
        stats.push({
          parameterId: param.id, component: component.key, slotId: slot.id, n: group.length,
          inRangePct: pct(inRange, group.length), mean: Math.round(mean * 10) / 10,
        });
      }
    }
  }
  return stats;
}
