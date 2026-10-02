import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, parseNum } from '@/components/ui/field';
import { useAppData, useCurrent, useEngine, useNow } from '@/hooks/useAppData';
import { saveRegimenVersion } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { fmtAmount, fmtDayTime, toLocalInput } from '@/lib/format';
import { effectiveMed } from '@/engine/preprocess';
import { toSnapshot } from '@/lib/snapshot';
import type { RegimenItem } from '@/lib/types';
import { RegimenTable } from './RegimenTable';

export function RegimenScreen() {
  const data = useAppData();
  const now = useNow();
  const result = useEngine(data, now);
  const { regimen } = useCurrent(data, now);
  const [editing, setEditing] = useState(false);
  if (!data || !result) return <Loading />;

  const meds = data.medications.filter((m) => !m.archived);
  const versions = [...data.regimens].reverse();
  const evaluation = (id: string) => result.changeEvaluations.find((c) => c.regimenVersionId === id);
  const snapshot = toSnapshot(data, now);
  const inUse = regimen ? [...new Set(regimen.items.map((i) => i.medicationId))] : [];

  if (editing) return <RegimenEditor onDone={() => setEditing(false)} />;

  return (
    <Screen
      title="Regimen"
      action={regimen && <Badge tone="change">v{data.regimens.indexOf(regimen) + 1} · since {fmtDayTime(new Date(regimen.effectiveFrom)).split(',')[0]}</Badge>}
    >
      {regimen && regimen.items.length > 0 ? (
        <Card className="px-3.5 py-2"><RegimenTable regimen={regimen} medications={data.medications} slots={data.slots} /></Card>
      ) : (
        <Card>
          <div className="font-extrabold">No regimen yet</div>
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            {meds.length === 0 ? 'Start by adding your medications, then set when you take them.' : 'Set which medications you take at which time of day.'}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Button size="md" onClick={() => setEditing(true)} disabled={meds.length === 0}>{regimen ? 'Change regimen' : 'Set regimen'}</Button>
        <Link to="/medications" className={cn(buttonClass('secondary', 'md'), 'no-underline')}>Medications</Link>
      </div>

      {inUse.map((id) => {
        const m = data.medications.find((x) => x.id === id);
        if (!m) return null;
        const pk = effectiveMed(m, snapshot).pk;
        return (
          <Card key={id} className="gap-2 py-3.5">
            <span className="text-[13px] font-extrabold text-[var(--text-muted)]">{m.name} · approx. timing</span>
            {pk?.timingSensitive ? (
              <div className="num grid grid-cols-3 gap-2 text-sm">
                <span className="flex flex-col"><span className="text-xs text-[var(--text-muted)]">Onset</span><span className="font-extrabold">~{pk.onsetH} h</span></span>
                <span className="flex flex-col"><span className="text-xs text-[var(--text-muted)]">Peak</span><span className="font-extrabold">~{pk.peakH} h</span></span>
                <span className="flex flex-col"><span className="text-xs text-[var(--text-muted)]">Lasts</span><span className="font-extrabold">~{pk.durationH} h</span></span>
              </div>
            ) : (
              <span className="text-sm">
                {pk ? `Builds up over about ${pk.steadyStateDays} days; time of day doesn't matter.` : 'No timing data. Add it under Medications to include this drug in timing patterns.'}
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)]">Approx. values, verify with your pharmacist</span>
          </Card>
        );
      })}

      {versions.length > 0 && <SectionTitle>History</SectionTitle>}
      <ol className="m-0 flex list-none flex-col p-0">
        {versions.map((v, idx) => {
          const ev = evaluation(v.id);
          return (
            <li key={v.id} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span className={cn('mt-1 size-3.5 rounded-full', idx === 0 ? 'bg-[var(--change-line)]' : 'border-2 border-[var(--text-muted)]')} />
                {idx < versions.length - 1 && <span className="w-0.5 grow bg-[var(--border-strong)]" />}
              </div>
              <div className="flex flex-col gap-1 pb-5">
                <span className="text-[15px] font-extrabold">v{data.regimens.length - idx} · {fmtDayTime(new Date(v.effectiveFrom))}</span>
                <span className="text-sm text-[var(--text-secondary)]">
                  {v.note || 'No note'}
                  {v.items.length > 0 && ` · ${v.items.length} dose${v.items.length === 1 ? '' : 's'}/day`}
                </span>
                {ev && <Link to="/insights" className="text-[13px] font-extrabold text-[var(--accent-text)] no-underline">{ev.summary}</Link>}
              </div>
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}

interface RegimenEditorProps {
  onDone: () => void;
}

/** Creates a new regimen version (amounts per medication and slot, effective time, note). */
function RegimenEditor({ onDone }: RegimenEditorProps) {
  const data = useAppData();
  const now = useNow(600_000);
  const { regimen } = useCurrent(data, now);
  const [amounts, setAmounts] = useState<Record<string, string> | null>(null);
  const [effective, setEffective] = useState(() => toLocalInput(new Date()));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Loading />;

  const meds = data.medications.filter((m) => !m.archived);
  const k = (medId: string, slotId: string) => `${medId}|${slotId}`;
  const current =
    amounts ?? Object.fromEntries((regimen?.items ?? []).map((i) => [k(i.medicationId, i.slotId), fmtAmount(i.amount)]));

  async function save() {
    const items: RegimenItem[] = [];
    for (const [key, raw] of Object.entries(current)) {
      if (raw.trim() === '') continue;
      const amount = parseNum(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        setError('Amounts must be numbers.');
        return;
      }
      const [medicationId, slotId] = key.split('|');
      items.push({ medicationId, slotId, amount });
    }
    const at = new Date(effective);
    if (Number.isNaN(at.getTime())) {
      setError('Choose when the change takes effect.');
      return;
    }
    await saveRegimenVersion(db, { effectiveFrom: at.toISOString(), items, note });
    onDone();
  }

  return (
    <Screen title={regimen ? 'Change regimen' : 'Set regimen'} description="Creates a new version; the old one stays in the history." withNav={false}>
      {meds.map((m) => (
        <Card key={m.id}>
          <h2 className="m-0 text-base font-extrabold">{m.name} <span className="font-semibold text-[var(--text-muted)]">· {m.unit}</span></h2>
          <div className="grid grid-cols-4 gap-2">
            {data.slots.map((s) => (
              <Field
                key={s.id}
                label={s.name}
                inputMode="decimal"
                placeholder="–"
                value={current[k(m.id, s.id)] ?? ''}
                onChange={(e) => setAmounts({ ...current, [k(m.id, s.id)]: e.target.value })}
              />
            ))}
          </div>
        </Card>
      ))}
      <Card>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[var(--text-secondary)]">
          Takes effect
          <input
            type="datetime-local"
            value={effective}
            onChange={(e) => setEffective(e.target.value)}
            className="num min-h-12 rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-[17px] font-extrabold text-[var(--text-primary)]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[var(--text-secondary)]">
          Note (who changed what, why)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Dr. Weber: bisoprolol raised"
            className="min-h-12 rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-[15px] font-semibold text-[var(--text-primary)]"
          />
        </label>
      </Card>
      {error && <p role="alert" className="m-0 font-bold text-[var(--warn)]">{error}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" size="lg" onClick={onDone}>Cancel</Button>
        <Button size="lg" onClick={save}>Save version</Button>
      </div>
    </Screen>
  );
}
