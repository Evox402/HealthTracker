import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loading } from '@/components/layout/Screen';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, parseNum } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useAppData } from '@/hooks/useAppData';
import { logReading, logSymptom, undoLog } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { componentTargetText, hasTarget, toLocalInput } from '@/lib/format';
import { autoAdvanceDigits, isPlausible } from '@/lib/plausibility';
import { allTrackers, BRISTOL, findTracker } from '@/lib/trackers';
import type { ParameterDef, SymptomDef } from '@/lib/types';

/** Logs one tracker: time, the value(s) for its type, an optional note (SPEC §7). */
export function LogSheet() {
  const data = useAppData();
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [time, setTime] = useState(() => new Date());
  const [values, setValues] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [confirmOdd, setConfirmOdd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Back to where the sheet was opened from (Today or Charts); Today when opened directly.
  const back = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true });
  if (!data) return <Loading />;

  const tracker = findTracker(allTrackers(data.parameters, data.symptoms, true), params.kind, params.id);
  if (!tracker) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-3 px-4 pt-8">
        <p className="m-0">This tracker doesn't exist.</p>
        <Link to="/" className={cn(buttonClass('secondary', 'md'), 'no-underline')}>Back to Today</Link>
      </main>
    );
  }

  const odd = tracker.kind === 'p'
    ? tracker.def.components.filter((c) => {
      const v = parseNum(values[c.key] ?? '');
      return Number.isFinite(v) && !isPlausible(tracker.def.id, c.key, v);
    })
    : [];

  async function save() {
    if (!tracker) return;
    const takenAt = time.toISOString();
    let saved;
    if (tracker.kind === 'p') {
      const vals: Record<string, number> = {};
      for (const c of tracker.def.components) {
        const v = parseNum(values[c.key] ?? '');
        if (Number.isFinite(v)) vals[c.key] = v;
      }
      if (Object.keys(vals).length === 0) {
        setMessage('Enter a value first.');
        return;
      }
      if (odd.length > 0 && !confirmOdd) {
        setConfirmOdd(true);
        setMessage('This value looks unusual. Check it, then tap Save again to keep it.');
        return;
      }
      saved = await logReading(db, { parameterId: tracker.id, values: vals, takenAt, note });
    } else {
      const s = tracker.def.type === 'event' ? 1 : score;
      if (s === null) {
        setMessage(tracker.def.type === 'stool' ? 'Choose a type first.' : 'Choose a score first.');
        return;
      }
      saved = await logSymptom(db, { symptomId: tracker.id, score: s, takenAt, note });
    }
    toast({ message: `${tracker.name} saved`, action: { label: 'Undo', onClick: () => void undoLog(db, saved) } });
    back();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 text-2xl font-extrabold">{tracker.name}</h1>
            {tracker.kind === 'p' && <div className="text-[13px] text-[var(--text-muted)]">{tracker.def.unit}</div>}
          </div>
          <Button variant="secondary" size="icon" aria-label="Close without saving" onClick={back}>
            <X size={20} aria-hidden />
          </Button>
        </header>

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
            <Button variant="secondary" size="sm" onClick={() => setTime((t) => new Date(t.getTime() - 15 * 60_000))}>−15 min</Button>
            <Button variant="secondary" size="sm" onClick={() => setTime(new Date())}>Now</Button>
            <Button variant="secondary" size="sm" onClick={() => setTime((t) => new Date(t.getTime() + 15 * 60_000))}>+15 min</Button>
          </div>
        </Card>

        <Card>
          {tracker.kind === 'p' ? (
            <NumberInputs def={tracker.def} values={values} onChange={(v) => { setValues(v); setConfirmOdd(false); setMessage(null); }} onDone={save} />
          ) : (
            <SymptomInput def={tracker.def} score={score} onChange={(s) => { setScore(s); setMessage(null); }} />
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[var(--text-secondary)]">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tracker.kind === 's' && tracker.def.type === 'event' ? 'What happened?' : 'e.g. after a walk'}
              className="min-h-12 rounded-[14px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-[15px] font-semibold text-[var(--text-primary)]"
            />
          </label>
        </Card>
      </div>

      <div className="no-print sticky bottom-0 flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--bg)]/90 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur-md">
        {message && <p role="alert" className="m-0 text-sm font-bold text-[var(--warn)]">{message}</p>}
        <Button size="lg" onClick={save}>{confirmOdd ? 'Save anyway' : `Save ${tracker.name}`}</Button>
      </div>
    </main>
  );
}

interface NumberInputsProps {
  def: ParameterDef;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onDone: () => void;
}

function NumberInputs({ def, values, onChange, onDone }: NumberInputsProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const wide = def.components.length > 1;
  return (
    <div className={cn('grid gap-2.5', wide ? 'grid-cols-2' : 'grid-cols-1')}>
      {def.components.map((c, index) => {
        const v = parseNum(values[c.key] ?? '');
        const unusual = Number.isFinite(v) && !isPlausible(def.id, c.key, v);
        const last = index === def.components.length - 1;
        return (
          <Field
            key={c.key}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            autoFocus={index === 0}
            big
            label={c.label}
            inputMode="decimal"
            enterKeyHint={last ? 'done' : 'next'}
            placeholder={def.unit}
            value={values[c.key] ?? ''}
            invalid={unusual}
            hint={unusual ? 'Check value' : hasTarget(c) ? `Target ${componentTargetText(c)}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') last ? onDone() : inputs.current[index + 1]?.focus();
            }}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^\d.,]/g, '');
              onChange({ ...values, [c.key]: clean });
              if (!last && autoAdvanceDigits(def.id, c.key, clean)) inputs.current[index + 1]?.focus();
            }}
          />
        );
      })}
    </div>
  );
}

interface SymptomInputProps {
  def: SymptomDef;
  score: number | null;
  onChange: (score: number) => void;
}

function SymptomInput({ def, score, onChange }: SymptomInputProps) {
  if (def.type === 'event') {
    return <p className="m-0 text-[15px] text-[var(--text-secondary)]">Saves that {def.name.toLowerCase()} happened at this time.</p>;
  }
  if (def.type === 'stool') {
    return (
      <div role="radiogroup" aria-label="Bristol stool type" className="flex flex-col gap-1.5">
        {BRISTOL.map((b) => (
          <button
            key={b.type}
            type="button"
            role="radio"
            aria-checked={score === b.type}
            aria-label={`Type ${b.type}: ${b.label}, ${b.hint.toLowerCase()}`}
            onClick={() => onChange(b.type)}
            className={cn(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border px-3 text-left',
              score === b.type ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' : 'border-[var(--border-strong)] bg-transparent',
            )}
          >
            <span className={cn('num w-7 text-lg font-extrabold', score === b.type ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]')}>{b.type}</span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold text-[var(--text-primary)]">{b.label}</span>
              <span className="text-xs text-[var(--text-muted)]">{b.hint}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }
  const above = score !== null && score > def.threshold;
  return (
    <div className="flex flex-col gap-2">
      <span className="flex justify-between text-sm font-bold">
        <span>Score 0–10</span>
        <span className={cn('num text-lg', score === null ? 'font-semibold text-[var(--text-muted)]' : above ? 'text-[var(--warn)]' : '')}>
          {score === null ? 'not set' : above ? `▲ ${score}` : score}
        </span>
      </span>
      <div role="radiogroup" aria-label={`${def.name} score`} className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={score === i}
            onClick={() => onChange(i)}
            className={cn(
              'num min-h-11 cursor-pointer rounded-lg border text-[15px] font-extrabold',
              score === i ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]' : 'border-[var(--border-strong)] bg-transparent text-[var(--text-primary)]',
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <span className="text-xs text-[var(--text-muted)]">0 = none · 10 = worst imaginable · threshold {def.threshold}</span>
    </div>
  );
}
