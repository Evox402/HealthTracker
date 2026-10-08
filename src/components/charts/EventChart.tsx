import { cn } from '@/lib/cn';
import { fmtDay } from '@/lib/format';

export interface EventChartProps {
  /** Entry times (ms). */
  times: number[];
  from: number;
  to: number;
  selectedDay?: number | null;
  onSelectDay?: (dayStart: number) => void;
  print?: boolean;
  width?: number;
  height?: number;
  label: string;
}

const W = 342;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const nextDay = (t: number) => {
  const d = new Date(t);
  d.setDate(d.getDate() + 1);
  return d.getTime();
};

/** Entries per calendar day as bars (stool, yes/no trackers). Count is printed on each bar. */
export function EventChart({ times, from, to, selectedDay, onSelectDay, print, width = W, height = 150, label }: EventChartProps) {
  const days: { start: number; count: number }[] = [];
  for (let d = startOfDay(from); d <= to; d = nextDay(d)) {
    const end = nextDay(d);
    days.push({ start: d, count: times.filter((t) => t >= d && t < end).length });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const padL = 4;
  const plotH = height - 22;
  const slot = (width - padL) / Math.max(1, days.length);
  const barW = Math.max(4, Math.min(28, slot * 0.7));
  const labelEvery = days.length > 10 ? Math.ceil(days.length / 7) : 1;
  const textCls = print ? 'fill-[#475569]' : 'fill-[var(--text-muted)]';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-auto w-full overflow-visible">
      <line x1={0} x2={width} y1={plotH} y2={plotH} strokeWidth={1} className={print ? 'stroke-[#cbd5e1]' : 'stroke-[var(--border)]'} />
      {days.map((d, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const h = (d.count / max) * (plotH - 16);
        const selected = d.start === selectedDay;
        const desc = `${fmtDay(new Date(d.start))}: ${d.count}`;
        const bar = (
          <>
            {d.count > 0 && (
              <rect x={x} y={plotH - h} width={barW} height={h} rx={4}
                className={cn(print ? 'fill-[#0f766e]' : 'fill-[var(--accent)]', selected && 'stroke-[var(--text-primary)]')} strokeWidth={selected ? 2 : 0} />
            )}
            {d.count > 0 && slot >= 14 && (
              <text x={x + barW / 2} y={plotH - h - 4} fontSize={11} textAnchor="middle" className={cn(textCls, 'font-bold')}>{d.count}</text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={height - 4} fontSize={11} textAnchor="middle" className={textCls}>
                {days.length > 10 ? new Date(d.start).getDate() : WEEKDAYS[new Date(d.start).getDay()]}
              </text>
            )}
          </>
        );
        return onSelectDay ? (
          <g key={d.start} role="button" tabIndex={0} aria-label={desc} aria-pressed={selected} className="cursor-pointer outline-none"
            onClick={() => onSelectDay(d.start)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectDay(d.start)}>
            <rect x={padL + i * slot} y={0} width={slot} height={plotH} className="fill-transparent" />
            {bar}
          </g>
        ) : (
          <g key={d.start}><title>{desc}</title>{bar}</g>
        );
      })}
    </svg>
  );
}
