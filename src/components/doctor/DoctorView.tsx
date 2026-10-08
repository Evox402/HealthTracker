import { ArrowLeft, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendChart } from '@/components/charts/TrendChart';
import { Loading } from '@/components/layout/Screen';
import { Button } from '@/components/ui/button';
import { componentLabel } from '@/engine/text';
import { useAppData, useCurrent, useEngine, useNow } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import { componentStatus, componentTargetText, fmtAmount, fmtDay, fmtDayTime, fmtValue, hasTarget } from '@/lib/format';
import { BRISTOL } from '@/lib/trackers';

const DAY = 86_400_000;
const h2 = 'm-0 text-sm font-extrabold tracking-[0.5px] text-[#334155] uppercase';
const th = 'p-1.5 font-extrabold';
const td = 'p-1.5';

/** Solid, high-contrast summary for appointments; prints to one A4 page (SPEC §9). */
export function DoctorView() {
  const data = useAppData();
  const now = useNow();
  const result = useEngine(data, now);
  const { regimen } = useCurrent(data, now);
  const [days, setDays] = useState(14);
  if (!data || !result) return <Loading />;

  const to = now.getTime();
  const from = to - days * DAY;
  const inPeriod = (iso: string) => {
    const t = Date.parse(iso);
    return t >= from && t <= to;
  };
  const readings = data.readings.filter((r) => inPeriod(r.takenAt));
  const entries = data.symptomEntries.filter((e) => inPeriod(e.takenAt));
  const doses = data.doseEvents.filter((d) => inPeriod(d.takenAt));
  const meds = data.medications.filter((m) => (regimen?.items ?? []).some((i) => i.medicationId === m.id));
  const vitals = data.parameters.filter((p) => !p.archived).flatMap((p) => p.components.map((c) => ({ p, c })))
    .map(({ p, c }) => ({ p, c, rows: readings.filter((r) => r.parameterId === p.id && r.values[c.key] !== undefined) }))
    .filter((v) => v.rows.length > 0);
  const charts = vitals.slice(0, 4);
  const symptoms = data.symptoms.filter((s) => !s.archived)
    .map((s) => ({ s, rows: entries.filter((e) => e.symptomId === s.id) }))
    .filter((x) => x.rows.length > 0);
  const counts = { taken: 0, changed: 0, skipped: 0 };
  for (const d of doses) if (d.status !== 'extra') counts[d.status] += 1;

  return (
    <div className="min-h-screen bg-[#e2e8f0] print:bg-white">
      <div className="no-print mx-auto flex max-w-[794px] flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] border border-[#94a3b8] bg-white px-3 font-bold text-[#0f172a] no-underline"><ArrowLeft size={18} aria-hidden /> Back</Link>
        <div role="group" aria-label="Period" className="flex gap-1.5">
          {[7, 14, 30].map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
              className={cn('min-h-11 cursor-pointer rounded-[14px] border px-3 font-bold', days === d ? 'border-[#0f766e] bg-[#0f766e] text-white' : 'border-[#94a3b8] bg-white text-[#0f172a]')}>
              {d} days
            </button>
          ))}
        </div>
        <Button onClick={() => window.print()}><Printer size={18} aria-hidden /> Print / PDF</Button>
      </div>
      <article className="mx-auto flex max-w-[794px] flex-col gap-4 bg-white px-6 py-8 text-[#0f172a] sm:px-12 print:max-w-none print:p-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-[#0f172a] pb-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-extrabold">Health summary</h1>
            <span className="text-[13px] text-[#475569]">
              Patient-recorded data · {fmtDay(new Date(from))} – {fmtDay(now)} · {readings.length} readings, {entries.length} symptom entries
            </span>
          </div>
          <span className="text-xs text-[#475569]">Generated {fmtDayTime(now)}</span>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className={h2}>Current medications</h2>
          {meds.length > 0 ? (
            <table className="num w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f1f5f9] text-left">
                  <th className={th}>Medication</th>
                  {data.slots.map((s) => <th key={s.id} className={th}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id} className="border-t border-[#cbd5e1]">
                    <td className={cn(td, 'font-bold')}>{m.name}</td>
                    {data.slots.map((s) => {
                      const i = regimen?.items.find((x) => x.medicationId === m.id && x.slotId === s.id);
                      return <td key={s.id} className={td}>{i ? `${fmtAmount(i.amount)} ${m.unit}` : '–'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="m-0 text-sm text-[#475569]">No medications recorded.</p>}
          {doses.length > 0 && (
            <p className="m-0 text-[13px] text-[#334155]">
              Doses ticked off in this period: {counts.taken} taken as planned{counts.changed > 0 ? `, ${counts.changed} at another amount` : ''}
              {counts.skipped > 0 ? `, ${counts.skipped} skipped` : ''}.
            </p>
          )}
        </section>

        {vitals.length > 0 && (
          <section className="flex break-inside-avoid flex-col gap-2">
            <h2 className={h2}>Measurements</h2>
            <table className="num w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f1f5f9] text-left">
                  <th className={th}>Value</th><th className={th}>Target</th><th className={th}>n</th>
                  <th className={th}>Min</th><th className={th}>Mean</th><th className={th}>Max</th><th className={th}>In range</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map(({ p, c, rows }) => {
                  const vals = rows.map((r) => r.values[c.key]);
                  const inRange = vals.filter((v) => componentStatus(c, v) === 'in').length;
                  return (
                    <tr key={`${p.id}${c.key}`} className="border-t border-[#cbd5e1]">
                      <td className={cn(td, 'font-bold')}>{componentLabel(p, c)} ({p.unit})</td>
                      <td className={td}>{hasTarget(c) ? componentTargetText(c) : '–'}</td>
                      <td className={td}>{vals.length}</td>
                      <td className={td}>{fmtValue(Math.min(...vals), p.decimals)}</td>
                      <td className={td}>{fmtValue(vals.reduce((a, b) => a + b, 0) / vals.length, p.decimals + 1)}</td>
                      <td className={td}>{fmtValue(Math.max(...vals), p.decimals)}</td>
                      <td className={td}>{hasTarget(c) ? `${Math.round((100 * inRange) / vals.length)} %` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {charts.map(({ p, c, rows }) => (
          <section key={`${p.id}${c.key}`} className="flex break-inside-avoid flex-col gap-1">
            <h2 className={h2}>{componentLabel(p, c)} ({p.unit}){hasTarget(c) ? ` · target ${componentTargetText(c)}` : ''}</h2>
            <TrendChart print label={`${componentLabel(p, c)} trend`} from={from} to={to} width={700} height={100}
              band={c.targetMin !== undefined && c.targetMax !== undefined ? [c.targetMin, c.targetMax] : undefined}
              points={rows.map((r) => ({ id: r.id, at: Date.parse(r.takenAt), value: r.values[c.key], status: componentStatus(c, r.values[c.key]) }))} />
          </section>
        ))}

        {symptoms.length > 0 && (
          <section className="flex break-inside-avoid flex-col gap-2">
            <h2 className={h2}>Symptoms</h2>
            <table className="num w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f1f5f9] text-left"><th className={th}>Tracker</th><th className={th}>Entries</th><th className={th}>Days</th><th className={th}>Details</th></tr>
              </thead>
              <tbody>
                {symptoms.map(({ s, rows }) => {
                  const dayCount = new Set(rows.map((r) => new Date(r.takenAt).toDateString())).size;
                  let details = '';
                  if (s.type === 'scale') {
                    const mean = rows.reduce((a, r) => a + r.score, 0) / rows.length;
                    const above = rows.filter((r) => r.score > s.threshold).length;
                    details = `0–10 · mean ${fmtValue(mean, 1)}, max ${Math.max(...rows.map((r) => r.score))}, ${above}× above ${s.threshold}`;
                  } else if (s.type === 'stool') {
                    details = `Bristol · ${fmtValue(rows.length / days, 1)}/day · ` +
                      BRISTOL.map((b) => [b.type, rows.filter((r) => r.score === b.type).length]).filter(([, n]) => n > 0).map(([t, n]) => `type ${t}: ${n}`).join(', ');
                  } else {
                    details = rows.filter((r) => r.note).slice(-3).map((r) => `${fmtDay(new Date(r.takenAt))}: ${r.note}`).join('; ') || 'Events';
                  }
                  return (
                    <tr key={s.id} className="border-t border-[#cbd5e1] align-top">
                      <td className={cn(td, 'font-bold')}>{s.name}</td>
                      <td className={td}>{rows.length}</td>
                      <td className={td}>{dayCount}</td>
                      <td className={td}>{details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {result.redFlags.length > 0 && (
          <p className="m-0 text-[13px] font-bold text-[#b91c1c]">Red flags in the last 24 h: {result.redFlags.map((f) => `${f.title} (${fmtDayTime(new Date(f.at))})`).join('; ')}.</p>
        )}

        <footer className="mt-2 border-t border-[#cbd5e1] pt-3 text-[11px] leading-snug text-[#475569]">
          Recorded by the patient with Health Tracker. Self-measured data, summarised without interpretation; not a diagnosis or
          treatment recommendation.
        </footer>
      </article>
    </div>
  );
}
