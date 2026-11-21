import { Layers, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Segmented } from '@/components/ui/segmented';
import { StatusMark } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { useAppData, useNow } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { componentStatus, componentTargetText, fmtDay, fmtDayTime, fmtValue, hasTarget } from '@/lib/format';
import { allTrackers, BRISTOL, findTracker, fmtSymptom, trackerPath, type Tracker } from '@/lib/trackers';
import type { Reading, SymptomEntry } from '@/lib/types';
import { EventChart } from './EventChart';
import { TrendChart, type ChartPoint, type ChartOverlay } from './TrendChart';

const DAY = 86_400_000;
const RANGES = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'all', label: 'All' },
] as const;

type Entry = { kind: 'reading'; row: Reading } | { kind: 'symptom'; row: SymptomEntry };

const ALL = 'all';
const keyOf = (t: Pick<Tracker, 'kind' | 'id'>) => `${t.kind}:${t.id}`;

function entriesFor(data: NonNullable<ReturnType<typeof useAppData>>, t: Tracker): Entry[] {
  return t.kind === 'p'
    ? data.readings.filter((r) => r.parameterId === t.id).map((row) => ({ kind: 'reading' as const, row }))
    : data.symptomEntries.filter((e) => e.symptomId === t.id).map((row) => ({ kind: 'symptom' as const, row }));
}

/** One chart per tracker: numeric trend, 0–10 scale, Bristol types and entries per day. Compare mode stacks several. */
export function ChartsScreen() {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const params = useParams();
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('14');
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  if (!data) return <Loading />;

  const trackers = allTrackers(data.parameters, data.symptoms);
  const tracker = findTracker(trackers, params.kind, params.id) ?? trackers[0];
  if (!tracker) {
    return (
      <Screen title="Charts">
        <p className="m-0 text-sm text-[var(--text-muted)]">No trackers. Add one in Settings.</p>
      </Screen>
    );
  }

  const shown = compare ? trackers.filter((t) => picked.includes(keyOf(t))) : [tracker];
  const visible = shown.length ? shown : [tracker];
  const to = now.getTime();
  // One shared time axis, so stacked charts line up.
  const firsts = visible.flatMap((t) => entriesFor(data, t).map((e) => Date.parse(e.row.takenAt)));
  const first = firsts.length ? Math.min(...firsts) : to - 7 * DAY;
  const from = range === 'all' ? Math.min(first, to - DAY) : to - Number(range) * DAY;

  function pick(t: Tracker) {
    if (compare) {
      const k = keyOf(t);
      setPicked((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]));
    } else {
      navigate(`/charts/${trackerPath(t)}`, { replace: true });
    }
  }

  function toggleCompare() {
    if (!compare) setPicked([keyOf(tracker)]);
    else if (picked.length) {
      const t = trackers.find((x) => keyOf(x) === picked[0]);
      if (t) navigate(`/charts/${trackerPath(t)}`, { replace: true });
    }
    setCompare(!compare);
  }

  return (
    <Screen
      title="Charts"
      action={<Link to={`/log/${trackerPath(tracker)}`} aria-label={`Log ${tracker.name}`} className={buttonClass('primary', 'icon')}><Plus size={22} aria-hidden /></Link>}
    >
      <div role="group" aria-label="Tracker" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip pressed={compare} onClick={toggleCompare} className="shrink-0 whitespace-nowrap">
          <Layers size={14} aria-hidden className="mr-1 inline" />Compare
        </Chip>
        {trackers.map((t) => (
          <Chip key={keyOf(t)} pressed={compare ? picked.includes(keyOf(t)) : t === tracker} onClick={() => pick(t)} className="shrink-0 whitespace-nowrap">{t.name}</Chip>
        ))}
      </div>
      {compare && <p className="m-0 text-xs text-[var(--text-secondary)]">Tap trackers to stack their charts below each other on the same time axis.</p>}

      {visible.map((t) => (
        <ChartCard key={keyOf(t)} tracker={t} entries={entriesFor(data, t)} from={from} to={to} compact={compare} />
      ))}

      <Card className="py-2">
        <div className="flex gap-1.5 px-1">
          {RANGES.map((r) => (
            <Chip key={r.value} pressed={range === r.value} onClick={() => setRange(r.value)} className="rounded-[10px] px-3">{r.label}</Chip>
          ))}
        </div>
      </Card>

      {!compare && <Details tracker={tracker} entries={entriesFor(data, tracker).filter((e) => { const t = Date.parse(e.row.takenAt); return t >= from && t <= to; })} />}
    </Screen>
  );
}

interface ChartCardProps {
  tracker: Tracker;
  entries: Entry[];
  from: number;
  to: number;
  compact: boolean;
}

function ChartCard({ tracker, entries, from, to, compact }: ChartCardProps) {
  const [componentKey, setComponentKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const inRange = entries.filter((e) => {
    const t = Date.parse(e.row.takenAt);
    return t >= from && t <= to;
  });
  const describe = (e: Entry) => describeEntry(tracker, e);
  const dayEntries = selectedDay === null ? [] : inRange.filter((e) => {
    const t = Date.parse(e.row.takenAt);
    return t >= selectedDay && t < selectedDay + DAY;
  });

  return (
    <>
      {tracker.kind === 'p' && tracker.def.components.length > 1 && (
        <Segmented label={`${tracker.name} value`} value={componentKey ?? ALL}
          onChange={(v) => setComponentKey(v === ALL ? null : v)}
          options={[{ value: ALL, label: 'All' }, ...tracker.def.components.map((c) => ({ value: c.key, label: c.label }))]} />
      )}
      <Card className="px-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="m-0 text-base font-extrabold">{tracker.name}{tracker.kind === 'p' ? ` · ${tracker.def.unit}` : ''}</h2>
          <span className="text-[13px] text-[var(--text-muted)]">{inRange.length} entries</span>
        </div>
        {inRange.length === 0 ? (
          <p className={cn('m-0 px-1 text-center text-sm text-[var(--text-muted)]', compact ? 'py-4' : 'py-10')}>No entries in this period yet.</p>
        ) : (
          <TrackerChart tracker={tracker} entries={inRange} componentKey={componentKey} from={from} to={to}
            selected={selected} onSelect={(id) => { setSelected(id); setSelectedDay(null); }}
            selectedDay={selectedDay} onSelectDay={(d) => { setSelectedDay(d); setSelected(null); }}
            height={compact ? 150 : undefined} />
        )}
        {selected && inRange.filter((e) => e.row.id === selected).map((e) => (
          <div key={e.row.id} className="num flex flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
            <span className="flex items-center justify-between"><span>{fmtDayTime(new Date(e.row.takenAt))}</span><span className="font-extrabold">{describe(e)}</span></span>
            {e.row.note && <span className="text-[var(--text-secondary)]">{e.row.note}</span>}
          </div>
        ))}
        {selectedDay !== null && (
          <div className="flex flex-col gap-1 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
            <span className="font-extrabold">{fmtDay(new Date(selectedDay))} · {dayEntries.length}</span>
            {dayEntries.map((e) => (
              <span key={e.row.id} className="num text-[var(--text-secondary)]">
                {fmtDayTime(new Date(e.row.takenAt)).split(', ')[1]} · {describe(e)}{e.row.note ? ` · ${e.row.note}` : ''}
              </span>
            ))}
          </div>
        )}
        <Legend tracker={tracker} componentKey={componentKey} />
      </Card>
    </>
  );
}

function describeEntry(tracker: Tracker, e: Entry): string {
  return e.kind === 'reading' && tracker.kind === 'p'
    ? tracker.def.components.map((c) => (e.row.values[c.key] === undefined ? '–' : fmtValue(e.row.values[c.key], tracker.def.decimals))).join('/') + ` ${tracker.def.unit}`
    : e.kind === 'symptom' && tracker.kind === 's' ? fmtSymptom(tracker.def, e.row) : '';
}

interface DetailsProps {
  tracker: Tracker;
  entries: Entry[];
}

function Details({ tracker, entries }: DetailsProps) {
  const toast = useToast();
  const recent = [...entries].reverse().slice(0, 12);

  async function remove(e: Entry) {
    if (e.kind === 'reading') await db.readings.delete(e.row.id);
    else await db.symptomEntries.delete(e.row.id);
    toast({
      message: 'Entry deleted',
      action: { label: 'Undo', onClick: () => void (e.kind === 'reading' ? db.readings.put(e.row) : db.symptomEntries.put(e.row)) },
    });
  }

  return (
    <>
      {entries.length > 0 && <Summary tracker={tracker} entries={entries} />}
      {recent.length > 0 && (
        <>
          <SectionTitle>Recent entries</SectionTitle>
          <Card className="gap-0 py-1">
            <ul className="m-0 flex list-none flex-col p-0">
              {recent.map((e) => (
                <li key={e.row.id} className="flex items-center justify-between gap-2 border-b border-[var(--border)] py-2 last:border-b-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="num text-[15px] font-extrabold">{describeEntry(tracker, e)}</span>
                    <span className="truncate text-xs text-[var(--text-muted)]">{fmtDayTime(new Date(e.row.takenAt))}{e.row.note ? ` · ${e.row.note}` : ''}</span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`Delete entry from ${fmtDayTime(new Date(e.row.takenAt))}`} onClick={() => void remove(e)}>
                    <Trash2 size={18} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

interface TrackerChartProps {
  tracker: Tracker;
  entries: Entry[];
  componentKey: string | null;
  from: number;
  to: number;
  selected?: string | null;
  onSelect?: (id: string) => void;
  selectedDay?: number | null;
  onSelectDay?: (day: number) => void;
  print?: boolean;
  height?: number;
  width?: number;
}

/** The right chart for each tracker type. */
export function TrackerChart({ tracker, entries, componentKey, from, to, selected, onSelect, selectedDay, onSelectDay, print, height, width }: TrackerChartProps) {
  if (tracker.kind === 'p') {
    const comps = tracker.def.components;
    const series = (c: (typeof comps)[number]) => ({
      points: entries.flatMap((e): ChartPoint[] =>
        e.kind === 'reading' && e.row.values[c.key] !== undefined
          ? [{ id: e.row.id, at: Date.parse(e.row.takenAt), value: e.row.values[c.key], status: componentStatus(c, e.row.values[c.key]) }]
          : []),
      band: (c.targetMin !== undefined && c.targetMax !== undefined ? [c.targetMin, c.targetMax] : undefined) as [number, number] | undefined,
    });
    const single = comps.find((x) => x.key === componentKey);
    if (comps.length > 1 && !single) {
      // All components in one plot: first = dots, others = dashed line with square markers.
      const [head, ...rest] = comps;
      const h = series(head);
      const overlay: ChartOverlay[] = rest.map((c) => ({ label: c.label, ...series(c) }));
      return (
        <TrendChart label={`${comps.map((c) => c.label).join(' and ')}, ${tracker.def.unit}`} points={h.points} band={h.band} overlay={overlay}
          from={from} to={to} selectedId={selected} onSelect={onSelect} print={print} height={height} width={width} />
      );
    }
    const c = single ?? comps[0];
    const sc = series(c);
    return (
      <TrendChart label={`${c.label}${hasTarget(c) ? `, target ${componentTargetText(c)}` : ''}`} points={sc.points} band={sc.band}
        from={from} to={to} selectedId={selected} onSelect={onSelect} print={print} height={height} width={width} />
    );
  }
  const def = tracker.def;
  const rows = entries.flatMap((e) => (e.kind === 'symptom' ? [e.row] : []));
  const times = rows.map((r) => Date.parse(r.takenAt));
  if (def.type === 'event') {
    return <EventChart label={`${def.name} per day`} times={times} from={from} to={to} selectedDay={selectedDay} onSelectDay={onSelectDay} print={print} width={width} height={height} />;
  }
  const points: ChartPoint[] = rows.map((r) => ({
    id: r.id, at: Date.parse(r.takenAt), value: r.score,
    status: def.type === 'scale' ? (r.score > def.threshold ? 'above' : 'in') : 'none',
  }));
  if (def.type === 'scale') {
    return (
      <TrendChart label={`${def.name}, 0 to 10, threshold ${def.threshold}`} points={points} band={[0, def.threshold]} domain={[0, 10]}
        from={from} to={to} selectedId={selected} onSelect={onSelect} print={print} height={height} width={width} />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <TrendChart label={`${def.name}, Bristol type 1 to 7`} points={points} domain={[1, 7]}
        from={from} to={to} selectedId={selected} onSelect={onSelect} print={print} height={height ?? 170} width={width} />
      <EventChart label={`${def.name} per day`} times={times} from={from} to={to} selectedDay={selectedDay} onSelectDay={onSelectDay} print={print}
        width={width} height={print ? 70 : 110} />
    </div>
  );
}

interface LegendProps {
  tracker: Tracker;
  componentKey: string | null;
}

function Legend({ tracker, componentKey }: LegendProps) {
  const item = 'flex items-center gap-1.5';
  if (tracker.kind === 'p') {
    const comps = tracker.def.components;
    const combined = comps.length > 1 && !comps.some((x) => x.key === componentKey);
    const c = comps.find((x) => x.key === componentKey) ?? comps[0];
    if (!combined && !hasTarget(c)) return null;
    return (
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-1 text-xs text-[var(--text-secondary)]">
        {combined && comps.map((x, i) => (
          <span key={x.key} className={item}>
            <span className={cn('size-2.5 bg-[var(--text-muted)]', i === 0 ? 'rounded-full' : 'rounded-[2px]')} />{x.label} ({i === 0 ? 'dots' : 'squares'})
          </span>
        ))}
        {(!combined || comps.some(hasTarget)) && (
          <>
            <span className={item}><span className="size-2.5 rounded-full bg-[var(--gain)]" />✓ In range</span>
            <span className={item}><span className="size-2.5 rounded-full bg-[var(--warn)]" />▲▼ Out of range</span>
            <span className={item}><span className="h-2.5 w-3.5 rounded-sm bg-[var(--band)]" />Target {comps.filter(hasTarget).map(componentTargetText).join(' · ')}</span>
          </>
        )}
      </div>
    );
  }
  if (tracker.def.type === 'scale') {
    return (
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-1 text-xs text-[var(--text-secondary)]">
        <span className={item}><span className="size-2.5 rounded-full bg-[var(--gain)]" />✓ At or below {tracker.def.threshold}</span>
        <span className={item}><span className="size-2.5 rounded-full bg-[var(--warn)]" />▲ Above threshold</span>
      </div>
    );
  }
  if (tracker.def.type === 'stool') {
    return <p className="m-0 px-1 text-xs text-[var(--text-secondary)]">Top: Bristol type per entry (1 hard … 7 liquid). Bottom: entries per day. Tap to see details.</p>;
  }
  return <p className="m-0 px-1 text-xs text-[var(--text-secondary)]">Entries per day. Tap a bar to see notes.</p>;
}

interface SummaryProps {
  tracker: Tracker;
  entries: Entry[];
}

function Summary({ tracker, entries }: SummaryProps) {
  const days = new Set(entries.map((e) => new Date(e.row.takenAt).toDateString())).size;
  const cell = 'flex flex-col';
  const k = 'text-xs text-[var(--text-muted)]';
  const v = 'num text-[17px] font-extrabold';

  if (tracker.kind === 'p') {
    return (
      <Card className="gap-2">
        <h2 className="m-0 text-base font-extrabold">Summary</h2>
        {tracker.def.components.map((c) => {
          const vals = entries.flatMap((e) => (e.kind === 'reading' && e.row.values[c.key] !== undefined ? [e.row.values[c.key]] : []));
          if (vals.length === 0) return null;
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          const inTarget = hasTarget(c) ? vals.filter((x) => componentStatus(c, x) === 'in').length : null;
          const f = (x: number) => fmtValue(x, Math.max(tracker.def.decimals, 0));
          return (
            <div key={c.key} className="flex flex-col gap-1">
              {tracker.def.components.length > 1 && <span className="text-[13px] font-bold text-[var(--text-secondary)]">{c.label}</span>}
              <div className="grid grid-cols-4 gap-2">
                <span className={cell}><span className={k}>Min</span><span className={v}>{f(Math.min(...vals))}</span></span>
                <span className={cell}><span className={k}>Mean</span><span className={v}>{fmtValue(mean, tracker.def.decimals + 1)}</span></span>
                <span className={cell}><span className={k}>Max</span><span className={v}>{f(Math.max(...vals))}</span></span>
                <span className={cell}>
                  <span className={k}>{inTarget === null ? 'Entries' : 'In range'}</span>
                  <span className={v}>{inTarget === null ? vals.length : `${Math.round((100 * inTarget) / vals.length)} %`}</span>
                </span>
              </div>
            </div>
          );
        })}
      </Card>
    );
  }

  const rows = entries.flatMap((e) => (e.kind === 'symptom' ? [e.row] : []));
  const def = tracker.def;
  if (def.type === 'stool') {
    const max = Math.max(1, ...BRISTOL.map((b) => rows.filter((r) => r.score === b.type).length));
    return (
      <Card className="gap-2">
        <h2 className="m-0 text-base font-extrabold">Summary</h2>
        <div className="grid grid-cols-2 gap-2">
          <span className={cell}><span className={k}>Entries</span><span className={v}>{rows.length}</span></span>
          <span className={cell}><span className={k}>Per day (days with entries)</span><span className={v}>{fmtValue(rows.length / Math.max(1, days), 1)}</span></span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {BRISTOL.map((b) => {
            const count = rows.filter((r) => r.score === b.type).length;
            return (
              <li key={b.type} className="grid grid-cols-[88px_1fr_28px] items-center gap-2 text-[13px]">
                <span className="font-bold">Type {b.type}</span>
                <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden className="h-2.5 w-full">
                  <rect width={100} height={10} rx={5} className="fill-[var(--surface-2)]" />
                  {count > 0 && <rect width={(100 * count) / max} height={10} rx={5} className="fill-[var(--accent)]" />}
                </svg>
                <span className="num text-right font-bold">{count}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }
  if (def.type === 'event') {
    return (
      <Card className="gap-2">
        <h2 className="m-0 text-base font-extrabold">Summary</h2>
        <div className="grid grid-cols-2 gap-2">
          <span className={cell}><span className={k}>Entries</span><span className={v}>{rows.length}</span></span>
          <span className={cell}><span className={k}>Days with entries</span><span className={v}>{days}</span></span>
        </div>
      </Card>
    );
  }
  const mean = rows.reduce((a, r) => a + r.score, 0) / rows.length;
  const above = rows.filter((r) => r.score > def.threshold).length;
  return (
    <Card className="gap-2">
      <h2 className="m-0 text-base font-extrabold">Summary</h2>
      <div className="grid grid-cols-3 gap-2">
        <span className={cell}><span className={k}>Mean</span><span className={v}>{fmtValue(mean, 1)}</span></span>
        <span className={cell}><span className={k}>Max</span><span className={v}>{Math.max(...rows.map((r) => r.score))}</span></span>
        <span className={cell}>
          <span className={k}>Above {def.threshold}</span>
          <span className={cn(v, 'flex items-center gap-1')}>{above}{above > 0 && <StatusMark status="above" short />}</span>
        </span>
      </div>
    </Card>
  );
}
