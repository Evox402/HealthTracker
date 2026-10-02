import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TrendChart, type ChartPoint } from '@/components/charts/TrendChart';
import { Loading, Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Segmented } from '@/components/ui/segmented';
import { StatusMark, statusTextClass } from '@/components/ui/status';
import { useAppData, useNow } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import { componentStatus, fmtDay, fmtDayTime } from '@/lib/format';
import { slotFor } from '@/lib/slots';

const RANGES = [
  { value: '3', label: '3d' },
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: 'all', label: 'All' },
] as const;

const SHORT: Record<string, string> = { bp: 'BP', hr: 'HR', spo2: 'SpO₂', rr: 'Resp.' };

export function TrendsScreen() {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const { parameterId } = useParams();
  const [componentKey, setComponentKey] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('7');
  const [selected, setSelected] = useState<string | null>(null);
  if (!data) return <Loading />;

  const params = data.parameters.filter((p) => !p.archived);
  const param = params.find((p) => p.id === parameterId) ?? params[0];
  if (!param) return <Loading />;
  const component = param.components.find((c) => c.key === componentKey) ?? param.components[0];
  const to = now.getTime();
  const firstReading = data.readings.length ? Date.parse(data.readings[0].takenAt) : to - 7 * 86_400_000;
  const from = range === 'all' ? Math.min(firstReading, to - 86_400_000) : to - Number(range) * 86_400_000;
  const excluded = new Set(data.appSettings.excludeTags);

  const readings = data.readings.filter(
    (r) => r.parameterId === param.id && r.values[component.key] !== undefined && Date.parse(r.takenAt) >= from && Date.parse(r.takenAt) <= to,
  );
  const points: ChartPoint[] = readings.map((r) => ({
    id: r.id, at: Date.parse(r.takenAt), value: r.values[component.key],
    status: componentStatus(component, r.values[component.key]), muted: r.tags.some((t) => excluded.has(t)),
  }));
  const markers = data.regimens.slice(1).map((r) => ({ at: Date.parse(r.effectiveFrom), label: r.note || 'Regimen change' }));
  const changesInRange = data.regimens.slice(1).filter((r) => Date.parse(r.effectiveFrom) >= from);
  const sel = readings.find((r) => r.id === selected);

  const counted = readings.filter((r) => !r.tags.some((t) => excluded.has(t)));
  const perSlot = data.slots.map((s) => {
    const rows = counted.filter((r) => slotFor(new Date(r.takenAt), data.slots).id === s.id).map((r) => r.values[component.key]);
    const inRange = rows.filter((v) => componentStatus(component, v) === 'in').length;
    const mean = rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : null;
    const above = rows.filter((v) => v > component.targetMax).length;
    const below = rows.filter((v) => v < component.targetMin).length;
    return { slot: s, n: rows.length, pct: rows.length ? Math.round((100 * inRange) / rows.length) : null, mean, dir: above >= below ? 'above' : 'below' } as const;
  });

  return (
    <Screen title="Trends">
      <Segmented
        label="Parameter"
        value={param.id}
        onChange={(id) => {
          setComponentKey(null);
          setSelected(null);
          navigate(`/trends/${id}`, { replace: true });
        }}
        options={params.map((p) => ({ value: p.id, label: SHORT[p.kind] ?? p.name }))}
      />
      {param.components.length > 1 && (
        <Segmented label="Value" value={component.key} onChange={setComponentKey} options={param.components.map((c) => ({ value: c.key, label: c.label }))} />
      )}

      <Card className="px-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="m-0 text-base font-extrabold">{param.components.length > 1 ? `${component.label} ${SHORT[param.kind] ?? ''}` : param.name} · {param.unit}</h2>
          <span className="text-[13px] text-[var(--text-muted)]">{readings.length} readings</span>
        </div>
        {points.length === 0 ? (
          <p className="m-0 px-1 py-10 text-center text-sm text-[var(--text-muted)]">No readings in this period yet.</p>
        ) : (
          <TrendChart
            label={`${component.label}, target ${component.targetMin} to ${component.targetMax}`}
            points={points} band={[component.targetMin, component.targetMax]} from={from} to={to} markers={markers}
            selectedId={selected} onSelect={setSelected}
          />
        )}
        {sel && (
          <div className="num flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
            <span>{fmtDayTime(new Date(sel.takenAt))}{sel.tags.length > 0 && ` · ${sel.tags.join(', ').replace('_', ' ')}`}</span>
            <span className="flex items-center gap-2 font-extrabold">
              {sel.values[component.key]} <StatusMark status={componentStatus(component, sel.values[component.key])} short />
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-1 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[var(--gain)]" />✓ In range</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[var(--warn)]" />▲▼ Out of range</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm bg-[var(--band)]" />Target {component.targetMin}–{component.targetMax}</span>
          <span className="flex items-center gap-1.5"><span className="h-3 border-l-2 border-dashed border-[var(--change-line)]" />Regimen change</span>
          {points.some((p) => p.muted) && <span>Faded: after activity (not counted)</span>}
        </div>
        <div className="flex gap-1.5 px-1">
          {RANGES.map((r) => (
            <Chip key={r.value} pressed={range === r.value} onClick={() => setRange(r.value)} className="rounded-[10px]">{r.label}</Chip>
          ))}
        </div>
      </Card>

      {changesInRange.map((r) => (
        <Link key={r.id} to="/regimen" className="glass flex items-center gap-3 rounded-[18px] px-4 py-3.5 text-[var(--text-primary)] no-underline">
          <span className="w-1 self-stretch rounded-sm bg-[var(--change-line)]" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold">{fmtDay(new Date(r.effectiveFrom))} · Regimen change</span>
            <span className="text-[13px] text-[var(--text-secondary)]">{r.note || 'No note'}</span>
          </span>
        </Link>
      ))}

      <Card className="gap-1">
        <h2 className="m-0 mb-2 text-base font-extrabold">In range by time of day</h2>
        <table className="num w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
              <th className="pb-1.5 font-bold">Slot</th><th className="pb-1.5 font-bold">In range</th><th className="pb-1.5 font-bold">Mean</th><th className="pb-1.5 font-bold">n</th>
            </tr>
          </thead>
          <tbody>
            {perSlot.map(({ slot, n, pct, mean, dir }) => (
              <tr key={slot.id}>
                <td className="py-2 font-bold">{slot.name}</td>
                <td className={cn('py-2 font-extrabold', pct === null ? 'text-[var(--text-muted)]' : statusTextClass(pct === 100 ? 'in' : dir))}>
                  {pct === null ? '–' : `${pct === 100 ? '✓' : dir === 'above' ? '▲' : '▼'} ${pct} %`}
                </td>
                <td className="py-2">{mean === null ? '–' : Math.round(mean)}</td>
                <td className="py-2">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Screen>
  );
}
