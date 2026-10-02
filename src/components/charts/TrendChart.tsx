import { cn } from '@/lib/cn';
import { fmtWeekdayTime } from '@/lib/format';

export interface ChartPoint {
  id: string;
  at: number;
  value: number;
  status: 'in' | 'above' | 'below' | 'redflag';
  muted?: boolean;
}

export interface ChartMarker {
  at: number;
  label: string;
}

export interface TrendChartProps {
  points: ChartPoint[];
  band: [number, number];
  from: number;
  to: number;
  markers?: ChartMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Light, print-friendly rendering for the doctor view. */
  print?: boolean;
  width?: number;
  height?: number;
  label: string;
}

const W = 342;
const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FILL: Record<ChartPoint['status'], string> = {
  in: 'fill-[var(--gain)]',
  above: 'fill-[var(--warn)]',
  below: 'fill-[var(--warn)]',
  redflag: 'fill-[var(--loss-strong)]',
};
const PRINT_FILL: Record<ChartPoint['status'], string> = {
  in: 'fill-[#15803d]',
  above: 'fill-[#b45309]',
  below: 'fill-[#b45309]',
  redflag: 'fill-[#b91c1c]',
};

/** Hand-written SVG line/dot chart with a shaded target band and regimen-change markers. */
export function TrendChart({
  points, band, from, to, markers = [], selectedId, onSelect, print, width = W, height = 200, label,
}: TrendChartProps) {
  const padL = 30;
  const padR = 8;
  const plotH = height - 22;
  const values = points.map((p) => p.value);
  const lo = Math.floor(Math.min(band[0], ...values) - (band[1] - band[0]) * 0.25);
  const hi = Math.ceil(Math.max(band[1], ...values) + (band[1] - band[0]) * 0.25);
  const span = Math.max(1, to - from);
  const x = (t: number) => padL + ((t - from) / span) * (width - padL - padR);
  const y = (v: number) => ((hi - v) / Math.max(1, hi - lo)) * plotH;

  const ticks: number[] = [];
  const first = new Date(from);
  first.setHours(0, 0, 0, 0);
  const days = Math.ceil(span / DAY);
  const step = days > 10 ? Math.ceil(days / 6) : 1;
  for (let t = first.getTime() + DAY; t < to; t += DAY * step) ticks.push(t);

  const sorted = [...points].sort((a, b) => a.at - b.at);
  const line = sorted.map((p) => `${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const textCls = print ? 'fill-[#475569]' : 'fill-[var(--text-muted)]';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-auto w-full overflow-visible">
      <rect x={padL - 6} y={y(band[1])} width={width - padL - padR + 12} height={Math.max(0, y(band[0]) - y(band[1]))} rx={6}
        className={print ? 'fill-[#0d9488]/15' : 'fill-[var(--band)]'} />
      {[band[0], band[1]].map((v) => (
        <text key={v} x={0} y={y(v) + 4} fontSize={11} className={textCls}>{v}</text>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={0} y2={plotH} className={print ? 'stroke-[#e2e8f0]' : 'stroke-[var(--border)]'} strokeWidth={1} />
          <text x={x(t) + 3} y={height - 4} fontSize={11} className={textCls}>{WEEKDAYS[new Date(t).getDay()]}</text>
        </g>
      ))}
      {markers.filter((m) => m.at >= from && m.at <= to).map((m) => (
        <line key={m.at} x1={x(m.at)} x2={x(m.at)} y1={0} y2={plotH} strokeWidth={1.5} strokeDasharray="4 4"
          className={print ? 'stroke-[#7c3aed]' : 'stroke-[var(--change-line)]'}>
          <title>{m.label}</title>
        </line>
      ))}
      {sorted.length > 1 && (
        <polyline points={line} fill="none" strokeWidth={1.5} className={print ? 'stroke-[#94a3b8]' : 'stroke-[var(--text-muted)]/50'} />
      )}
      {sorted.map((p) => {
        const selected = p.id === selectedId;
        const common = { cx: x(p.at), cy: y(p.value) };
        const desc = `${p.value} at ${fmtWeekdayTime(new Date(p.at))}, ${p.status === 'in' ? 'in range' : p.status === 'redflag' ? 'red flag' : `${p.status} range`}`;
        return onSelect ? (
          <g key={p.id} role="button" tabIndex={0} aria-label={desc} aria-pressed={selected}
            onClick={() => onSelect(p.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(p.id)} className="cursor-pointer outline-none">
            <circle {...common} r={14} className="fill-transparent" />
            {selected && <circle {...common} r={8} className="fill-none stroke-[var(--text-primary)]" strokeWidth={2} />}
            <circle {...common} r={4.5} className={cn(FILL[p.status], p.muted && 'opacity-40')} />
          </g>
        ) : (
          <circle key={p.id} {...common} r={print ? 3.2 : 4.5} className={cn(print ? PRINT_FILL[p.status] : FILL[p.status], p.muted && 'opacity-40')}>
            <title>{desc}</title>
          </circle>
        );
      })}
    </svg>
  );
}
