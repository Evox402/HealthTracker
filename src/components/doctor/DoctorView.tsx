import { ArrowLeft, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TrendChart } from '@/components/charts/TrendChart';
import { Loading } from '@/components/layout/Screen';
import { RegimenTable } from '@/components/regimen/RegimenTable';
import { Button } from '@/components/ui/button';
import { componentLabel } from '@/engine/text';
import { useAppData, useCurrent, useEngine, useNow } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import { componentStatus, fmtDay, fmtDayTime } from '@/lib/format';

const DAY = 86_400_000;

/** Solid, high-contrast summary for rounds; prints to one A4 page (SPEC §9). */
export function DoctorView() {
  const data = useAppData();
  const now = useNow();
  const result = useEngine(data, now);
  const { regimen } = useCurrent(data, now);
  if (!data || !result) return <Loading />;

  const to = now.getTime();
  const from = to - data.appSettings.analysisWindowDays * DAY;
  const inPeriod = data.readings.filter((r) => Date.parse(r.takenAt) >= from);
  const markers = data.regimens.slice(1).map((r) => ({ at: Date.parse(r.effectiveFrom), label: r.note }));
  const skipped = data.doseEvents.filter((d) => d.status === 'skipped' && Date.parse(d.takenAt) >= from);
  const charts = data.parameters.filter((p) => !p.archived).flatMap((p) => p.components.map((c) => ({ p, c })))
    .filter(({ p, c }) => inPeriod.some((r) => r.parameterId === p.id && r.values[c.key] !== undefined))
    .slice(0, 4);
  const stats = result.slotStats;

  return (
    <div className="min-h-screen bg-[#e2e8f0] print:bg-white">
      <div className="no-print mx-auto flex max-w-[794px] items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] border border-[#94a3b8] bg-white px-3 font-bold text-[#0f172a] no-underline"><ArrowLeft size={18} aria-hidden /> Back</Link>
        <Button onClick={() => window.print()}><Printer size={18} aria-hidden /> Print / Save as PDF</Button>
      </div>
      <article className="mx-auto flex max-w-[794px] flex-col gap-5 bg-white px-6 py-8 text-[#0f172a] sm:px-12 print:max-w-none print:p-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-[#0f172a] pb-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-extrabold">Vitals &amp; medication summary</h1>
            <span className="text-[13px] text-[#475569]">
              Patient-recorded data · {fmtDay(new Date(from))} – {fmtDay(now)} · {inPeriod.length} readings
            </span>
          </div>
          <span className="text-xs text-[#475569]">Generated {fmtDayTime(now)}</span>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-sm font-extrabold tracking-[0.5px] text-[#334155] uppercase">
            Current regimen{regimen ? ` (since ${fmtDayTime(new Date(regimen.effectiveFrom))})` : ''}
          </h2>
          {regimen && regimen.items.length > 0 ? (
            <div className="rounded-lg border border-[#cbd5e1] px-2"><RegimenTable regimen={regimen} medications={data.medications} slots={data.slots} print /></div>
          ) : <p className="m-0 text-sm text-[#475569]">No regimen recorded.</p>}
          {result.changeEvaluations.length > 0 && (
            <ul className="m-0 flex flex-col gap-1 pl-5 text-[13px] text-[#334155]">
              {result.changeEvaluations.slice(-3).map((c) => <li key={c.regimenVersionId}>{c.note ? `${c.note}: ` : ''}{c.summary}</li>)}
            </ul>
          )}
          {skipped.length > 0 && <p className="m-0 text-[13px] text-[#334155]">Skipped doses in this period: {skipped.length}.</p>}
        </section>

        {charts.map(({ p, c }) => {
          const pts = inPeriod.filter((r) => r.parameterId === p.id && r.values[c.key] !== undefined).map((r) => ({
            id: r.id, at: Date.parse(r.takenAt), value: r.values[c.key], status: componentStatus(c, r.values[c.key]),
          }));
          return (
            <section key={`${p.id}${c.key}`} className="flex break-inside-avoid flex-col gap-1">
              <h2 className="m-0 text-sm font-extrabold tracking-[0.5px] text-[#334155] uppercase">
                {componentLabel(p, c)} ({p.unit}) · target {c.targetMin}–{c.targetMax}
              </h2>
              <TrendChart print label={`${componentLabel(p, c)} trend`} points={pts} band={[c.targetMin, c.targetMax]} from={from} to={to}
                markers={markers} width={700} height={110} />
            </section>
          );
        })}

        {stats.length > 0 && (
          <section className="flex break-inside-avoid flex-col gap-2">
            <h2 className="m-0 text-sm font-extrabold tracking-[0.5px] text-[#334155] uppercase">% of readings in range by time of day (mean)</h2>
            <table className="num w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f1f5f9] text-left">
                  <th className="p-1.5 font-extrabold">Value</th>
                  {data.slots.map((s) => <th key={s.id} className="p-1.5 font-extrabold">{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.parameters.flatMap((p) => p.components.map((c) => ({ p, c }))).filter(({ p, c }) => stats.some((x) => x.parameterId === p.id && x.component === c.key)).map(({ p, c }) => (
                  <tr key={`${p.id}${c.key}`} className="border-t border-[#cbd5e1]">
                    <td className="p-1.5 font-bold">{componentLabel(p, c)}</td>
                    {data.slots.map((s) => {
                      const st = stats.find((x) => x.parameterId === p.id && x.component === c.key && x.slotId === s.id);
                      if (!st) return <td key={s.id} className="p-1.5 text-[#94a3b8]">–</td>;
                      const flag = st.inRangePct < 100 && st.mean !== null ? (st.mean > c.targetMax ? '▲ ' : st.mean < c.targetMin ? '▼ ' : '') : '';
                      return (
                        <td key={s.id} className={cn('p-1.5', flag && 'font-extrabold text-[#b45309]')}>
                          {flag}{st.inRangePct} % ({Math.round(st.mean ?? 0)})
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 text-[11px] text-[#475569]">Last {data.appSettings.analysisWindowDays} days within the current regimen. Slots: {data.slots.map((s) => `${s.name} from ${s.startHour}:00`).join(', ')}.</p>
          </section>
        )}

        {result.insights.length > 0 && (
          <section className="flex break-inside-avoid flex-col gap-2">
            <h2 className="m-0 text-sm font-extrabold tracking-[0.5px] text-[#334155] uppercase">Patterns noted</h2>
            <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[13px] leading-snug">
              {result.insights.slice(0, 5).map((i) => (
                <li key={i.key}><strong>{i.title}</strong>: {i.explanation}</li>
              ))}
            </ol>
          </section>
        )}

        {result.redFlags.length > 0 && (
          <p className="m-0 text-[13px] font-bold text-[#b91c1c]">Red flags in the last 24 h: {result.redFlags.map((f) => `${f.title} (${fmtDayTime(new Date(f.at))})`).join('; ')}.</p>
        )}

        <footer className="mt-2 border-t border-[#cbd5e1] pt-3 text-[11px] leading-snug text-[#475569]">
          Recorded by the patient with MedicineAdjuster. Patterns are rule-based summaries of self-measured data, not a diagnosis or
          treatment recommendation. Drug timing values are approximate.
        </footer>
      </article>
    </div>
  );
}
