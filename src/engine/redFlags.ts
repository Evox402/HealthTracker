import type { EngineSnapshot, RedFlag } from '@/lib/types';
import { redFlagReading, redFlagSymptom } from './text';

// R0 (meta/SPEC.md §5): dangerous values in the last 24 h, from non-archived
// parameters with red-flag limits and from 'scale' symptoms with redFlagAt.

const DAY = 86_400_000;

export function redFlags(snap: EngineSnapshot): RedFlag[] {
  const now = Date.parse(snap.now);
  const since = now - DAY;
  const recent = (iso: string) => {
    const t = Date.parse(iso);
    return t >= since && t <= now;
  };
  const flags: (RedFlag & { t: number; order: number })[] = [];

  const params = new Map(snap.parameters.filter((p) => !p.archived).map((p) => [p.id, p]));
  for (const r of snap.readings) {
    const p = params.get(r.parameterId);
    if (!p || !recent(r.takenAt)) continue;
    p.components.forEach((c, order) => {
      const value = r.values[c.key];
      if (value === undefined) return;
      let wording: ReturnType<typeof redFlagReading> | null = null;
      if (c.redFlagMin !== undefined && value <= c.redFlagMin) wording = redFlagReading(p, c, value, 'below', c.redFlagMin);
      else if (c.redFlagMax !== undefined && value >= c.redFlagMax) wording = redFlagReading(p, c, value, 'above', c.redFlagMax);
      if (wording) {
        flags.push({ key: `rf:${r.id}:${c.key}`, source: 'reading', refId: r.id, ...wording, at: r.takenAt, t: Date.parse(r.takenAt), order });
      }
    });
  }

  const symptoms = new Map(snap.symptoms.filter((s) => !s.archived && s.type === 'scale').map((s) => [s.id, s]));
  for (const e of snap.symptomEntries) {
    const s = symptoms.get(e.symptomId);
    if (!s || s.redFlagAt === undefined || !recent(e.takenAt) || e.score < s.redFlagAt) continue;
    flags.push({
      key: `rf:${e.id}`, source: 'symptom', refId: e.id,
      ...redFlagSymptom(s.name, e.score, s.redFlagAt), at: e.takenAt, t: Date.parse(e.takenAt), order: 100,
    });
  }

  return flags
    .sort((a, b) => a.t - b.t || a.order - b.order || a.key.localeCompare(b.key))
    .map(({ t: _t, order: _o, ...flag }) => flag);
}
