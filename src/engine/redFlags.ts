import type { RedFlag } from '@/lib/types';
import { DAY, type Ctx } from './preprocess';
import { redFlagReading, redFlagSymptom } from './text';

// R0 (meta/SPEC.md §5.4): dangerous values in the last 24 h. Applies to every
// reading, including ones tagged for exclusion from patterns.

export function redFlags(ctx: Ctx): RedFlag[] {
  const since = ctx.now - DAY;
  const flags: (RedFlag & { t: number; order: number })[] = [];

  for (const p of ctx.points) {
    if (p.at < since) continue;
    const { redFlagMin, redFlagMax } = p.component;
    let wording: ReturnType<typeof redFlagReading> | null = null;
    if (redFlagMin !== undefined && p.value <= redFlagMin) wording = redFlagReading(p.parameter, p.component, p.value, 'below', redFlagMin);
    else if (redFlagMax !== undefined && p.value >= redFlagMax) wording = redFlagReading(p.parameter, p.component, p.value, 'above', redFlagMax);
    if (wording) {
      flags.push({
        key: `rf:${p.readingId}:${p.component.key}`, source: 'reading', refId: p.readingId,
        ...wording, at: new Date(p.at).toISOString(), t: p.at, order: p.parameter.components.indexOf(p.component),
      });
    }
  }

  for (const s of ctx.symptomPoints) {
    const limit = s.symptom.redFlagAt;
    if (s.at < since || limit === undefined || s.entry.score < limit) continue;
    flags.push({
      key: `rf:${s.entry.id}`, source: 'symptom', refId: s.entry.id,
      ...redFlagSymptom(s.symptom.name, s.entry.score, limit), at: new Date(s.at).toISOString(), t: s.at, order: 100,
    });
  }

  return flags
    .sort((a, b) => a.t - b.t || a.order - b.order || a.key.localeCompare(b.key))
    .map(({ t: _t, order: _o, ...flag }) => flag);
}
