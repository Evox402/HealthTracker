import type { AppData } from '@/hooks/useAppData';
import { fmtAmount, fmtReading, shortWhen } from '@/lib/format';
import type { EvidenceRef, Insight } from '@/lib/types';

export interface EvidenceRow {
  key: string;
  at: string;
  when: string;
  value: string;
  parameterId?: string;
}

/** Turns evidence ids into readable rows, newest first. Unknown ids (deleted data) are skipped. */
export function describeEvidence(data: AppData, insight: Pick<Insight, 'evidence' | 'component'>): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  for (const ref of insight.evidence) {
    const row = describe(data, ref, insight.component);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

function describe(data: AppData, ref: EvidenceRef, component?: string): EvidenceRow | null {
  const key = `${ref.kind}:${ref.id}`;
  if (ref.kind === 'reading') {
    const r = data.readings.find((x) => x.id === ref.id);
    const p = r && data.parameters.find((x) => x.id === r.parameterId);
    if (!r || !p) return null;
    const single = component && r.values[component] !== undefined && p.components.length > 1 ? String(r.values[component]) : fmtReading(p, r);
    return { key, at: r.takenAt, when: shortWhen(r.takenAt), value: `${p.kind === 'bp' ? 'BP ' : ''}${single} ${p.unit}`, parameterId: p.id };
  }
  if (ref.kind === 'symptom') {
    const e = data.symptomEntries.find((x) => x.id === ref.id);
    const s = e && data.symptoms.find((x) => x.id === e.symptomId);
    if (!e || !s) return null;
    return { key, at: e.takenAt, when: shortWhen(e.takenAt), value: `${s.name} ${e.score}/10` };
  }
  const d = data.doseEvents.find((x) => x.id === ref.id);
  const m = d && data.medications.find((x) => x.id === d.medicationId);
  if (!d || !m) return null;
  const what = d.status === 'skipped' ? 'skipped' : `${fmtAmount(d.actualAmount)} ${m.unit}${d.status === 'changed' ? ' (changed)' : ''}`;
  return { key, at: d.takenAt, when: shortWhen(d.takenAt), value: `${m.name} ${what}` };
}
