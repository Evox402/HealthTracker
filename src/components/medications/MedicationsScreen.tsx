import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { drugClassLabel } from '@/components/regimen/RegimenTable';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field, parseNum } from '@/components/ui/field';
import { DRUG_LIBRARY } from '@/engine/drugLibrary';
import { useAppData } from '@/hooks/useAppData';
import { addMedication, updateMedication } from '@/lib/actions';
import { db } from '@/lib/db';
import type { DoseUnit, DrugLibraryEntry, ParameterKind } from '@/lib/types';

const UNITS: DoseUnit[] = ['mg', 'g', 'ml', 'pill', 'piece', 'drop', 'scoop'];

export function MedicationsScreen() {
  const data = useAppData();
  const [adding, setAdding] = useState(false);
  if (!data) return <Loading />;
  const active = data.medications.filter((m) => !m.archived);
  const archived = data.medications.filter((m) => m.archived);

  return (
    <Screen
      title="Medications"
      action={<Link to="/regimen" aria-label="Back to regimen" className={buttonClass('secondary', 'icon')}><ArrowLeft size={20} aria-hidden /></Link>}
    >
      {active.map((m) => (
        <Card key={m.id} className="flex-row items-center justify-between py-3.5">
          <div className="flex flex-col">
            <span className="font-extrabold">{m.name}</span>
            <span className="text-xs text-[var(--text-muted)]">{drugClassLabel(m)} · {m.unit}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => updateMedication(db, m.id, { archived: true })}>Archive</Button>
        </Card>
      ))}
      {active.length === 0 && !adding && <p className="m-0 text-sm text-[var(--text-muted)]">No medications yet.</p>}
      {adding ? <AddMedication onDone={() => setAdding(false)} /> : (
        <Button size="lg" onClick={() => setAdding(true)}><Plus size={18} aria-hidden /> Add medication</Button>
      )}
      {archived.length > 0 && (
        <>
          <SectionTitle>Archived</SectionTitle>
          {archived.map((m) => (
            <Card key={m.id} className="flex-row items-center justify-between py-3">
              <span className="font-bold text-[var(--text-secondary)]">{m.name}</span>
              <Button variant="ghost" size="sm" onClick={() => updateMedication(db, m.id, { archived: false })}>Restore</Button>
            </Card>
          ))}
        </>
      )}
      <p className="m-0 text-xs text-[var(--text-muted)]">Archived medications keep their history. Remove them from the regimen with “Change regimen”.</p>
    </Screen>
  );
}

interface AddMedicationProps {
  onDone: () => void;
}

function AddMedication({ onDone }: AddMedicationProps) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<DrugLibraryEntry | null>(null);
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<DoseUnit>('mg');
  const [onset, setOnset] = useState('');
  const [duration, setDuration] = useState('');
  const [affects, setAffects] = useState<ParameterKind[]>([]);

  const q = query.trim().toLowerCase();
  const matches = q ? DRUG_LIBRARY.filter((d) => d.name.toLowerCase().includes(q) || d.id.includes(q)) : DRUG_LIBRARY;

  async function save() {
    if (picked) {
      await addMedication(db, { name: picked.name, libraryId: picked.id, unit });
    } else {
      const d = parseNum(duration);
      const o = parseNum(onset);
      await addMedication(db, {
        name: name.trim(), libraryId: null, unit, affectsOverride: affects,
        pkOverride: Number.isFinite(d) ? { durationH: d, onsetH: Number.isFinite(o) ? o : 0, peakH: Number.isFinite(o) ? o + 1 : 1 } : undefined,
      });
    }
    onDone();
  }

  const unitPicker = (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-[var(--text-secondary)]">Unit</span>
      <div className="flex flex-wrap gap-2">{UNITS.map((u) => <Chip key={u} pressed={unit === u} onClick={() => setUnit(u)}>{u}</Chip>)}</div>
    </div>
  );

  if (picked) {
    return (
      <Card>
        <h2 className="m-0 text-base font-extrabold">{picked.name}</h2>
        <p className="m-0 text-sm text-[var(--text-secondary)]">{picked.notes}</p>
        <p className="m-0 text-xs text-[var(--text-muted)]">Approx. timing values, verify with your pharmacist.</p>
        {unitPicker}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={() => setPicked(null)}>Back</Button>
          <Button onClick={save}>Add</Button>
        </div>
      </Card>
    );
  }

  if (custom) {
    return (
      <Card>
        <h2 className="m-0 text-base font-extrabold">Custom medication</h2>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} className="[&_input]:text-base" />
        {unitPicker}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-[var(--text-secondary)]">Lowers</span>
          <div className="flex gap-2">
            {(['bp', 'hr'] as const).map((k) => (
              <Chip key={k} pressed={affects.includes(k)} onClick={() => setAffects((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))}>
                {k === 'bp' ? 'Blood pressure' : 'Heart rate'}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Starts working after (h)" inputMode="decimal" placeholder="optional" value={onset} onChange={(e) => setOnset(e.target.value)} />
          <Field label="Effect lasts (h)" inputMode="decimal" placeholder="optional" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <p className="m-0 text-xs text-[var(--text-muted)]">Without timing, the drug is left out of timing patterns.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={() => setCustom(false)}>Back</Button>
          <Button onClick={save} disabled={name.trim() === ''}>Add</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Field label="Search the library" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. bisoprolol" className="[&_input]:text-base" />
      <ul className="m-0 flex max-h-80 list-none flex-col overflow-y-auto p-0">
        {matches.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => { setPicked(d); setUnit(d.typicalUnit); }}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between border-b border-[var(--border)] bg-transparent px-1 text-left text-[var(--text-primary)]">
              <span className="font-bold">{d.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{d.class.replace(/_/g, ' ')}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button variant="secondary" onClick={() => { setCustom(true); setName(query); }}>Not listed</Button>
      </div>
    </Card>
  );
}
