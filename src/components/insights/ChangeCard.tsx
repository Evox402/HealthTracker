import { Badge, type Tone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { componentLabel } from '@/engine/text';
import type { AppData } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import { fmtDay, fmtDayTime } from '@/lib/format';
import type { ChangeEvaluation } from '@/lib/types';

export interface ChangeCardProps {
  evaluation: ChangeEvaluation;
  data: AppData;
  compact?: boolean;
}

const STATUS: Record<ChangeEvaluation['status'], { label: string; tone: Tone }> = {
  evaluated: { label: 'Evaluated', tone: 'gain' },
  too_early: { label: 'Too early', tone: 'change' },
  insufficient_data: { label: 'Need more data', tone: 'neutral' },
};

const VERDICT = {
  improved: { text: '✓ Better', cls: 'text-[var(--gain)]' },
  worse: { text: '▼ Worse', cls: 'text-[var(--warn)]' },
  unchanged: { text: '= Same', cls: 'text-[var(--text-secondary)]' },
  unknown: { text: '? Unknown', cls: 'text-[var(--text-muted)]' },
};

export function ChangeCard({ evaluation: ev, data, compact }: ChangeCardProps) {
  const status = STATUS[ev.status];
  const rows = ev.perSlot.filter((r) => r.verdict !== 'unknown');
  const slotName = (id: string) => data.slots.find((s) => s.id === id)?.name ?? id;
  return (
    <Card as="article">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-extrabold">{ev.note || 'Regimen change'}</span>
          <span className="text-[13px] text-[var(--text-muted)]">{fmtDayTime(new Date(ev.effectiveFrom))}</span>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">{ev.summary}</p>
      {ev.status === 'too_early' && (
        <p className="m-0 text-xs text-[var(--text-muted)]">Can be judged from {fmtDay(new Date(ev.judgeableFrom))}.</p>
      )}
      {!compact && rows.length > 0 && (
        <table className="num w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)]">
              <th className="py-1 font-bold">Slot · value</th>
              <th className="py-1 font-bold">Before</th>
              <th className="py-1 font-bold">After</th>
              <th className="py-1 font-bold">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = data.parameters.find((x) => x.id === r.parameterId);
              const c = p?.components.find((x) => x.key === r.component);
              const v = VERDICT[r.verdict];
              return (
                <tr key={`${r.parameterId}${r.component}${r.slotId}`} className="border-t border-[var(--border)]">
                  <td className="py-1.5 font-bold">{slotName(r.slotId)} · {p && c ? componentLabel(p, c) : r.component}</td>
                  <td className="py-1.5">{r.before.inRangePct} %</td>
                  <td className="py-1.5">{r.after.inRangePct} %</td>
                  <td className={cn('py-1.5 font-extrabold', v.cls)}>{v.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!compact && ev.status === 'evaluated' && (
        <p className="m-0 text-xs text-[var(--text-muted)]">% of readings in range, before vs. after the change.</p>
      )}
    </Card>
  );
}
