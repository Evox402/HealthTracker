import { cn } from '@/lib/cn';
import { fmtWeekdayTime, type RangeStatus } from '@/lib/format';

export interface ChartPoint {
  id: string;
  at: number;
  value: number;
  status: RangeStatus;
  muted?: boolean;
}

/** A second series drawn in the same plot (e.g. diastolic next to systolic): dashed line, square markers. */
export interface ChartOverlay {
  label: string;
  points: ChartPoint[];
  band?: [number, number];
}

export interface ChartMarker {
  at: number;
  label: string;
}

export interface TrendChartProps {
  points: ChartPoint[];
  /** Shaded target band; omitted when the tracker has no target. */
  band?: [number, number];
  /** Extra series sharing the same axes. */
  overlay?: ChartOverlay[];
  /** Fixed y range (scales, Bristol types); otherwise fitted to the data and band. */
  domain?: [number, number];
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
  none: 'fill-[var(--accent)]',
  in: 'fill-[var(--gain)]',
  above: 'fill-[var(--warn)]',
  below: 'fill-[var(--warn)]',
  redflag: 'fill-[var(--loss-strong)]',
};
const PRINT_FILL: Record<ChartPoint['status'], string> = {
  none: 'fill-[#0f766e]',
  in: 'fill-[#15803d]',
  above: 'fill-[#b45309]',
  below: 'fill-[#b45309]',
  redflag: 'fill-[#b91c1c]',
};

const STATUS_TEXT: Record<ChartPoint['status'], string> = {
  none: '', in: ', in range', above: ', above range', below: ', below range', redflag: ', red flag',
};

/** y range: fixed domain, or data + band with some headroom. */
function yRange(values: number[], domain: [number, number] | undefined, bandValues: number[]): [number, number] {
  if (domain) return domain;
  const all = [...values, ...bandValues];
  if (all.length === 0) return [0, 1];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = Math.max((max - min) * 0.25, Math.abs(max) * 0.02, 1);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

/** Hand-written SVG line/dot chart with an optional shaded target band and markers. */
export function TrendChart({
  points, band, overlay = [], domain, from, to, markers = [], selectedId, onSelect, print, width = W, height = 200, label,
}: TrendChartProps) {
  const padL = 30;
  const padR = 8;
  const plotH = height - 22;
  const bands = [band, ...overlay.map((o) => o.band)].filter((b): b is [number, number] => !!b);
  const [lo, hi] = yRange([...points, ...overlay.flatMap((o) => o.points)].map((p) => p.value), domain, bands.flat());
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
      {bands.map((b) => (
        <rect key={b.join('-')} x={padL - 6} y={y(b[1])} width={width - padL - padR + 12} height={Math.max(0, y(b[0]) - y(b[1]))} rx={6}
          className={print ? 'fill-[#0d9488]/15' : 'fill-[var(--band)]'} />
      ))}
      {[...new Set(bands.length ? bands.flat() : [lo, hi])].map((v) => (
        <text key={v} x={0} y={Math.min(plotH, Math.max(10, y(v) + 4))} fontSize={11} className={textCls}>{v}</text>
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
      {overlay.map((o, i) => {
        const pts = [...o.points].sort((a, b) => a.at - b.at);
        return (
          <g key={`ov${i}`}>
            {pts.length > 1 && (
              <polyline points={pts.map((p) => `${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} fill="none" strokeWidth={1.5}
                strokeDasharray="5 3" className={print ? 'stroke-[#94a3b8]' : 'stroke-[var(--text-muted)]/50'} />
            )}
            {pts.map((p) => {
              const selected = p.id === selectedId;
              const s = print ? 5.5 : 8;
              const cx = x(p.at);
              const cy = y(p.value);
              const desc = `${o.label} ${p.value} at ${fmtWeekdayTime(new Date(p.at))}${STATUS_TEXT[p.status]}`;
              const mark = (
                <>
                  {onSelect && <circle cx={cx} cy={cy} r={14} className="fill-transparent" />}
                  {selected && <rect x={cx - s} y={cy - s} width={2 * s} height={2 * s} rx={2} className="fill-none stroke-[var(--text-primary)]" strokeWidth={2} />}
                  <rect x={cx - s / 2 - 0.5} y={cy - s / 2 - 0.5} width={s + 1} height={s + 1} rx={1.5}
                    className={cn(print ? PRINT_FILL[p.status] : FILL[p.status], p.muted && 'opacity-40')} />
                </>
              );
              return onSelect ? (
                <g key={`${p.id}-ov${i}`} role="button" tabIndex={0} aria-label={desc} aria-pressed={selected}
                  onClick={() => onSelect(p.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(p.id)} className="cursor-pointer outline-none">
                  {mark}
                </g>
              ) : (
                <g key={`${p.id}-ov${i}`}><title>{desc}</title>{mark}</g>
              );
            })}
          </g>
        );
      })}
      {sorted.map((p) => {
        const selected = p.id === selectedId;
        const common = { cx: x(p.at), cy: y(p.value) };
        const desc = `${p.value} at ${fmtWeekdayTime(new Date(p.at))}${STATUS_TEXT[p.status]}`;
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
