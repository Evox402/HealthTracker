import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SectionTitle } from '@/components/layout/Screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, parseNum } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { addNumberTracker, addSymptomTracker, deleteTracker, restoreTracker, setTrackerArchived } from '@/lib/actions';
import { db } from '@/lib/db';
import { allTrackers, SYMPTOM_TYPE_LABEL, type Tracker } from '@/lib/trackers';
import type { ParameterDef, Reading, SymptomDef, SymptomEntry, SymptomType } from '@/lib/types';
import { TargetsEditor } from './TargetsEditor';

export interface TrackersSectionProps {
  parameters: ParameterDef[];
  symptoms: SymptomDef[];
  readings: Reading[];
  symptomEntries: SymptomEntry[];
}

const typeLabel = (t: Tracker) => (t.kind === 'p' ? `Number · ${t.def.unit}` : SYMPTOM_TYPE_LABEL[t.def.type]);

/** Which trackers are shown, new custom trackers, deleting trackers, and targets/red flags. */
export function TrackersSection({ parameters, symptoms, readings, symptomEntries }: TrackersSectionProps) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const kindOf = (t: Tracker): 'parameter' | 'symptom' => (t.kind === 'p' ? 'parameter' : 'symptom');
  const countOf = (t: Tracker) =>
    t.kind === 'p' ? readings.filter((r) => r.parameterId === t.id).length : symptomEntries.filter((e) => e.symptomId === t.id).length;

  async function remove(t: Tracker) {
    setConfirming(null);
    const deleted = await deleteTracker(db, kindOf(t), t.id);
    toast({ message: `${t.name} deleted`, durationMs: 8000, action: { label: 'Undo', onClick: () => void restoreTracker(db, deleted) } });
  }
  const trackers = allTrackers(parameters, symptoms, true);
  const activeParams = parameters.filter((p) => !p.archived);
  const activeScales = symptoms.filter((s) => !s.archived && s.type === 'scale');

  return (
    <>
      <SectionTitle>Your trackers</SectionTitle>
      <Card id="trackers" className="gap-0 py-1">
        <ul className="m-0 flex list-none flex-col p-0">
          {trackers.map((t) => {
            const key = `${t.kind}:${t.id}`;
            const count = countOf(t);
            return (
              <li key={key} className="flex flex-col border-b border-[var(--border)] last:border-b-0">
                <div className="flex min-h-14 items-center gap-2 py-2">
                  <label className="flex grow items-center justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-bold">{t.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {typeLabel(t)} · {count} {count === 1 ? 'entry' : 'entries'}{t.def.archived ? ' · hidden' : ''}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      aria-label={`Show ${t.name}`}
                      className="size-6 accent-[var(--accent)]"
                      checked={!t.def.archived}
                      onChange={(e) => void setTrackerArchived(db, kindOf(t), t.id, !e.target.checked)}
                    />
                  </label>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} aria-expanded={confirming === key}
                    onClick={() => setConfirming(confirming === key ? null : key)}>
                    <Trash2 size={18} aria-hidden />
                  </Button>
                </div>
                {confirming === key && (
                  <div role="alertdialog" aria-label={`Delete ${t.name}?`} className="mb-2 flex flex-col gap-2 rounded-2xl border border-[var(--loss)] p-3">
                    <p className="m-0 text-sm">
                      Delete <strong>{t.name}</strong>
                      {count > 0 ? <> and its <strong>{count} {count === 1 ? 'entry' : 'entries'}</strong></> : ''}? To keep the data, hide it instead.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>Cancel</Button>
                      <Button variant="danger" size="sm" onClick={() => void remove(t)}>Delete</Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="m-0 text-xs text-[var(--text-muted)]">Hidden trackers keep their data and can be shown again at any time. Deleting removes the tracker and all its entries.</p>
      {adding ? (
        <NewTracker onDone={(name) => { setAdding(false); if (name) toast({ message: `${name} added` }); }} />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={18} aria-hidden /> New tracker</Button>
      )}

      <SectionTitle>Targets &amp; red flags</SectionTitle>
      <p className="m-0 text-[13px] text-[var(--text-muted)]">Leave a field empty for no target or no red flag.</p>
      <TargetsEditor
        key={[...activeParams, ...activeScales].map((x) => x.id).join()}
        parameters={activeParams}
        symptoms={activeScales}
        showRedFlags
        onSaved={() => toast({ message: 'Targets saved' })}
      />
    </>
  );
}

type NewType = 'number' | SymptomType;

interface NewTrackerProps {
  onDone: (name?: string) => void;
}

function NewTracker({ onDone }: NewTrackerProps) {
  const [type, setType] = useState<NewType>('scale');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [decimals, setDecimals] = useState('1');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [threshold, setThreshold] = useState('3');
  const [error, setError] = useState<string | null>(null);
  const opt = (raw: string) => (Number.isFinite(parseNum(raw)) ? parseNum(raw) : undefined);

  async function save() {
    const n = name.trim();
    if (!n) return;
    if (type === 'number') {
      const targetMin = opt(min);
      const targetMax = opt(max);
      if (targetMin !== undefined && targetMax !== undefined && targetMin >= targetMax) {
        setError('Enter a minimum below the maximum, or leave one empty.');
        return;
      }
      const d = Math.min(3, Math.max(0, Math.round(opt(decimals) ?? 0)));
      await addNumberTracker(db, { name: n, unit: unit.trim(), decimals: d, targetMin, targetMax });
    } else {
      const t = Math.min(10, Math.max(0, Math.round(opt(threshold) ?? 3)));
      await addSymptomTracker(db, { name: n, type, threshold: type === 'scale' ? t : 0 });
    }
    onDone(n);
  }

  return (
    <Card>
      <h3 className="m-0 text-base font-extrabold">New tracker</h3>
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Headache" className="[&_input]:text-base" autoFocus />
      <Segmented<NewType>
        label="Type"
        value={type}
        onChange={setType}
        options={[{ value: 'scale', label: '0–10' }, { value: 'stool', label: 'Stool' }, { value: 'number', label: 'Number' }, { value: 'event', label: 'Yes/No' }]}
      />
      <p className="m-0 text-[13px] text-[var(--text-muted)]">
        {type === 'scale' && 'A score from 0 (none) to 10 (worst), e.g. pain, nausea, fatigue.'}
        {type === 'stool' && 'Each bowel movement with its Bristol type (1 hard … 7 liquid).'}
        {type === 'number' && 'Any measured value with a unit, e.g. temperature, blood sugar, fluid intake.'}
        {type === 'event' && 'Something that happened, with an optional note, e.g. dizziness, a fall.'}
      </p>
      {type === 'number' && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. °C" className="[&_input]:text-base" />
          <Field label="Decimals" inputMode="numeric" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
          <Field label="Target min" inputMode="decimal" placeholder="none" value={min} onChange={(e) => setMin(e.target.value)} />
          <Field label="Target max" inputMode="decimal" placeholder="none" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
      )}
      {type === 'scale' && (
        <Field label="Threshold (scores above are highlighted)" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      )}
      {error && <p role="alert" className="m-0 text-sm font-bold text-[var(--warn)]">{error}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={() => onDone()}>Cancel</Button>
        <Button onClick={save} disabled={name.trim() === ''}>Add tracker</Button>
      </div>
    </Card>
  );
}
