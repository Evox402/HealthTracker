import { Check, Plus, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loading } from '@/components/layout/Screen';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field, parseNum } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { useAppData } from '@/hooks/useAppData';
import { currentRegimen, saveLog, undoLog, type LogDose } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { fmtAmount, toLocalInput } from '@/lib/format';
import { autoAdvanceDigits, isPlausible } from '@/lib/plausibility';
import { slotFor } from '@/lib/slots';
import type { ContextTag, DoseStatus } from '@/lib/types';

const TAGS: { value: ContextTag; label: string }[] = [
  { value: 'resting', label: 'Resting' },
  { value: 'after_activity', label: 'After activity' },
  { value: 'lying', label: 'Lying' },
  { value: 'standing', label: 'Standing' },
];

type DoseChoice = { status: Exclude<DoseStatus, 'extra'>; amount: string };

/** Full-screen log for one slot: vitals, context, symptoms, dose checklist (SPEC §7). */
export function QuickLogScreen() {
  const data = useAppData();
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [time, setTime] = useState(() => new Date());
  const [slotChoice, setSlotChoice] = useState<string | null>(params.slotId ?? null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<ContextTag[]>([]);
  const [symptoms, setSymptoms] = useState<Record<string, number | null>>({});
  const [doses, setDoses] = useState<Record<string, DoseChoice>>({});
  const [extras, setExtras] = useState<{ medicationId: string; amount: string }[]>([]);
  const [confirmOdd, setConfirmOdd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const fields = useMemo(
    () => (data?.parameters ?? []).filter((p) => !p.archived).flatMap((p) => p.components.map((c) => ({ p, c, k: `${p.id}.${c.key}` }))),
    [data],
  );
  if (!data) return <Loading />;

  const slotId = slotChoice && data.slots.some((s) => s.id === slotChoice) ? slotChoice : slotFor(time, data.slots).id;
  const slot = data.slots.find((s) => s.id === slotId)!;
  const regimen = currentRegimen(data.regimens, time);
  const planned = (regimen?.items ?? []).filter((i) => i.slotId === slotId);
  const med = (id: string) => data.medications.find((m) => m.id === id);
  const doseKey = (medicationId: string) => `${slotId}:${medicationId}`;
  const allTaken = planned.length > 0 && planned.every((i) => doses[doseKey(i.medicationId)]?.status === 'taken');

  const odd = fields.filter(({ p, c, k }) => {
    const v = parseNum(values[k] ?? '');
    return Number.isFinite(v) && !isPlausible(p.id, c.key, v);
  });

  function setValue(index: number, k: string, pId: string, cKey: string, raw: string) {
    const clean = raw.replace(/[^\d.,]/g, '');
    setValues((v) => ({ ...v, [k]: clean }));
    setConfirmOdd(false);
    if (autoAdvanceDigits(pId, cKey, clean)) inputs.current[index + 1]?.focus();
  }

  function shiftTime(minutes: number) {
    setTime((t) => new Date(t.getTime() + minutes * 60_000));
  }

  async function save() {
    const readings = data!.parameters
      .filter((p) => !p.archived)
      .map((p) => {
        const vals: Record<string, number> = {};
        for (const c of p.components) {
          const v = parseNum(values[`${p.id}.${c.key}`] ?? '');
          if (Number.isFinite(v)) vals[c.key] = v;
        }
        return { parameterId: p.id, values: vals };
      })
      .filter((r) => Object.keys(r.values).length > 0);
    const symptomRows = Object.entries(symptoms).filter((e): e is [string, number] => e[1] !== null).map(([symptomId, score]) => ({ symptomId, score }));
    const doseRows: LogDose[] = planned.flatMap((i) => {
      const choice = doses[doseKey(i.medicationId)];
      if (!choice) return [];
      const amount = choice.status === 'changed' ? parseNum(choice.amount) : i.amount;
      return [{ medicationId: i.medicationId, status: choice.status, plannedAmount: i.amount, actualAmount: Number.isFinite(amount) ? amount : 0 }];
    });
    for (const e of extras) {
      const amount = parseNum(e.amount);
      if (e.medicationId && Number.isFinite(amount) && amount > 0) {
        doseRows.push({ medicationId: e.medicationId, status: 'extra', plannedAmount: null, actualAmount: amount });
      }
    }

    if (readings.length + symptomRows.length + doseRows.length === 0) {
      setMessage('Nothing to save yet. Enter a value, a symptom or a dose.');
      return;
    }
    if (odd.length > 0 && !confirmOdd) {
      setConfirmOdd(true);
      setMessage('Some values look unusual. Check them, then tap Save again to keep them.');
      return;
    }
    const saved = await saveLog(db, {
      takenAt: time.toISOString(), slotId, regimenVersionId: regimen?.id ?? null, tags,
      readings, symptoms: symptomRows, doses: doseRows,
    });
    toast({ message: `${slot.name} log saved`, action: { label: 'Undo', onClick: () => void undoLog(db, saved) } });
    navigate('/');
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 text-2xl font-extrabold">Log</h1>
            <div className="text-[13px] text-[var(--text-muted)]">Fill in only what you measured</div>
          </div>
          <Link to="/" aria-label="Close without saving" className={buttonClass('secondary', 'icon')}>
            <X size={20} aria-hidden />
          </Link>
        </header>

        <Segmented label="Time of day" value={slotId} onChange={setSlotChoice} options={data.slots.map((s) => ({ value: s.id, label: s.name }))} />

        <Card className="gap-2 py-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-muted)]">
            Time
            <input
              type="datetime-local"
              value={toLocalInput(time)}
              onChange={(e) => e.target.value && setTime(new Date(e.target.value))}
              className="num min-h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-[17px] font-extrabold text-[var(--text-primary)]"
            />
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => shiftTime(-15)}>−15 min</Button>
            <Button variant="secondary" size="sm" onClick={() => setTime(new Date())}>Now</Button>
            <Button variant="secondary" size="sm" onClick={() => shiftTime(15)}>+15 min</Button>
          </div>
        </Card>

        <Card>
          <h2 className="m-0 text-base font-extrabold">Vitals</h2>
          <div className="grid grid-cols-6 gap-2.5">
            {fields.map(({ p, c, k }, index) => {
              const v = parseNum(values[k] ?? '');
              const unusual = Number.isFinite(v) && !isPlausible(p.id, c.key, v);
              const wide = p.components.length > 1;
              return (
                <Field
                  key={k}
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  className={wide ? 'col-span-3' : 'col-span-2'}
                  big={wide}
                  label={p.components.length > 1 ? c.label : p.kind === 'rr' ? 'Resp.' : p.kind === 'spo2' ? 'SpO₂' : p.kind === 'hr' ? 'HR' : p.name}
                  inputMode="decimal"
                  enterKeyHint={index === fields.length - 1 ? 'done' : 'next'}
                  placeholder={p.unit}
                  value={values[k] ?? ''}
                  invalid={unusual}
                  hint={unusual ? 'Check value' : `${c.targetMin}–${c.targetMax}`}
                  onChange={(e) => setValue(index, k, p.id, c.key, e.target.value)}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-[var(--text-secondary)]">Context</span>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <Chip
                  key={t.value}
                  pressed={tags.includes(t.value)}
                  onClick={() => setTags((x) => (x.includes(t.value) ? x.filter((y) => y !== t.value) : [...x, t.value]))}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
            {tags.includes('after_activity') && data.appSettings.excludeTags.includes('after_activity') && (
              <span className="text-xs text-[var(--text-muted)]">Readings after activity are kept but left out of the patterns.</span>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-extrabold">Symptoms</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSymptoms(Object.fromEntries(data.symptoms.filter((s) => !s.archived).map((s) => [s.id, 0])))}
            >
              No symptoms
            </Button>
          </div>
          {data.symptoms.filter((s) => !s.archived).map((s) => {
            const v = symptoms[s.id] ?? null;
            const above = v !== null && v > s.threshold;
            return (
              <div key={s.id} className="flex flex-col gap-1">
                <span className="flex justify-between text-sm font-bold">
                  <span>{s.name}</span>
                  <span className={cn('num', v === null ? 'font-semibold text-[var(--text-muted)]' : above ? 'text-[var(--warn)]' : '')}>
                    {v === null ? 'not recorded' : above ? `▲ ${v}` : v}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={v ?? 0}
                  aria-label={s.name}
                  aria-valuetext={v === null ? 'not recorded' : `${v} of 10`}
                  onChange={(e) => setSymptoms((x) => ({ ...x, [s.id]: Number(e.target.value) }))}
                  onClick={(e) => setSymptoms((x) => ({ ...x, [s.id]: Number((e.target as HTMLInputElement).value) }))}
                  className={cn('min-h-8 w-full', v === null && 'opacity-50')}
                />
                <span className="text-xs text-[var(--text-muted)]">Threshold {s.threshold}</span>
              </div>
            );
          })}
        </Card>

        <Card>
          <h2 className="m-0 text-base font-extrabold">Doses · {slot.name}</h2>
          {planned.length === 0 ? (
            <p className="m-0 text-sm text-[var(--text-muted)]">
              No doses planned {slot.name === 'Noon' || slot.name === 'Night' ? 'at' : 'in the'} {slot.name.toLowerCase()}.
            </p>
          ) : (
            <Button
              size="lg"
              variant={allTaken ? 'success' : 'secondary'}
              aria-pressed={allTaken}
              onClick={() =>
                setDoses((d) => {
                  const next = { ...d };
                  for (const i of planned) {
                    if (allTaken) delete next[doseKey(i.medicationId)];
                    else next[doseKey(i.medicationId)] = { status: 'taken', amount: '' };
                  }
                  return next;
                })
              }
            >
              <Check size={18} strokeWidth={2.6} aria-hidden /> {allTaken ? 'All doses taken' : 'All taken as planned'}
            </Button>
          )}
          {planned.map((i) => {
            const m = med(i.medicationId);
            const choice = doses[doseKey(i.medicationId)];
            const pick = (status: DoseChoice['status']) =>
              setDoses((d) => ({ ...d, [doseKey(i.medicationId)]: { status, amount: d[doseKey(i.medicationId)]?.amount ?? '' } }));
            return (
              <div key={i.medicationId} className="flex flex-col gap-2.5 rounded-2xl bg-[var(--surface-2)] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-extrabold">{m?.name ?? 'Unknown medication'}</span>
                  <span className="num text-sm text-[var(--text-secondary)]">{fmtAmount(i.amount)} {m?.unit} planned</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['taken', 'skipped', 'changed'] as const).map((s) => (
                    <Chip key={s} pressed={choice?.status === s} onClick={() => pick(s)} className="rounded-xl">
                      {s === 'taken' ? 'Taken' : s === 'skipped' ? 'Skipped' : 'Other amount'}
                    </Chip>
                  ))}
                </div>
                {choice?.status === 'changed' && (
                  <Field
                    label={`Amount taken (${m?.unit ?? ''})`}
                    inputMode="decimal"
                    value={choice.amount}
                    onChange={(e) => setDoses((d) => ({ ...d, [doseKey(i.medicationId)]: { status: 'changed', amount: e.target.value } }))}
                  />
                )}
              </div>
            );
          })}
          {extras.map((e, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_96px_auto] items-end gap-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[var(--text-secondary)]">
                Extra dose
                <select
                  value={e.medicationId}
                  onChange={(ev) => setExtras((x) => x.map((y, j) => (j === idx ? { ...y, medicationId: ev.target.value } : y)))}
                  className="min-h-12 rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 text-[15px] font-bold text-[var(--text-primary)]"
                >
                  <option value="">Choose…</option>
                  {data.medications.filter((m) => !m.archived).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <Field
                label={med(e.medicationId)?.unit ?? 'Amount'}
                inputMode="decimal"
                value={e.amount}
                onChange={(ev) => setExtras((x) => x.map((y, j) => (j === idx ? { ...y, amount: ev.target.value } : y)))}
              />
              <Button variant="secondary" size="icon" aria-label="Remove extra dose" onClick={() => setExtras((x) => x.filter((_, j) => j !== idx))}>
                <X size={18} aria-hidden />
              </Button>
            </div>
          ))}
          {data.medications.some((m) => !m.archived) && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setExtras((x) => [...x, { medicationId: '', amount: '' }])}>
              <Plus size={16} aria-hidden /> Extra dose
            </Button>
          )}
        </Card>
      </div>

      <div className="no-print sticky bottom-0 flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--bg)]/90 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur-md">
        {message && <p role="alert" className="m-0 text-sm font-bold text-[var(--warn)]">{message}</p>}
        <Button size="lg" onClick={save}>{confirmOdd ? 'Save anyway' : `Save ${slot.name} log`}</Button>
      </div>
    </main>
  );
}
