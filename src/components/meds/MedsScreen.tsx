import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field, parseNum } from '@/components/ui/field';
import { useAppData, useCurrent, useNow, type AppData } from '@/hooks/useAppData';
import { addMedication, archiveMedication, setStackEntry, updateMedication } from '@/lib/actions';
import { db } from '@/lib/db';
import { fmtAmount } from '@/lib/format';
import type { DoseUnit, Medication, RegimenVersion } from '@/lib/types';

const UNITS: DoseUnit[] = ['mg', 'g', 'ml', 'pill', 'piece', 'drop', 'scoop'];

/** The med stack: which medication, how much, at which time of day. */
export function MedsScreen() {
  const data = useAppData();
  const now = useNow();
  const { regimen } = useCurrent(data, now);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  if (!data) return <Loading />;

  const active = data.medications.filter((m) => !m.archived);
  const archived = data.medications.filter((m) => m.archived);
  const itemsOf = (id: string) => (regimen?.items ?? []).filter((i) => i.medicationId === id);

  return (
    <Screen title="Med stack" description="Tick doses off on Today. Changes apply from now on; past doses keep their amounts.">
      {data.slots.map((s) => {
        const rows = (regimen?.items ?? []).filter((i) => i.slotId === s.id && active.some((m) => m.id === i.medicationId));
        if (rows.length === 0) return null;
        return (
          <Card key={s.id} className="gap-1.5 py-3">
            <h2 className="m-0 text-[15px] font-extrabold">{s.name}</h2>
            {rows.map((i) => {
              const m = active.find((x) => x.id === i.medicationId)!;
              return (
                <div key={i.medicationId} className="num flex justify-between text-[15px]">
                  <span className="font-bold">{m.name}</span>
                  <span className="text-[var(--text-secondary)]">{fmtAmount(i.amount)} {m.unit}</span>
                </div>
              );
            })}
          </Card>
        );
      })}

      <SectionTitle>Medications</SectionTitle>
      {active.map((m) =>
        editing === m.id ? (
          <MedEditor key={m.id} data={data} regimen={regimen} med={m} onDone={() => setEditing(null)} />
        ) : (
          <Card key={m.id} className="flex-row items-center justify-between gap-2 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="font-extrabold">{m.name}</span>
              <span className="num text-xs text-[var(--text-muted)]">
                {itemsOf(m.id).length === 0
                  ? 'Not in the stack'
                  : itemsOf(m.id).map((i) => `${data.slots.find((s) => s.id === i.slotId)?.name ?? i.slotId} ${fmtAmount(i.amount)} ${m.unit}`).join(' · ')}
              </span>
            </div>
            <Button variant="secondary" size="icon" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m.id)}>
              <Pencil size={18} aria-hidden />
            </Button>
          </Card>
        ),
      )}
      {active.length === 0 && editing !== 'new' && <p className="m-0 text-sm text-[var(--text-muted)]">No medications yet.</p>}
      {editing === 'new' ? (
        <MedEditor data={data} regimen={regimen} onDone={() => setEditing(null)} />
      ) : (
        <Button size="lg" onClick={() => setEditing('new')}><Plus size={18} aria-hidden /> Add medication</Button>
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
          <p className="m-0 text-xs text-[var(--text-muted)]">Archived medications keep their dose history. Restoring one doesn't put it back in the stack.</p>
        </>
      )}
    </Screen>
  );
}

interface MedEditorProps {
  data: AppData;
  regimen: RegimenVersion | undefined;
  med?: Medication;
  onDone: () => void;
}

function MedEditor({ data, regimen, med, onDone }: MedEditorProps) {
  const [name, setName] = useState(med?.name ?? '');
  const [unit, setUnit] = useState<DoseUnit>(med?.unit ?? 'mg');
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries((regimen?.items ?? []).filter((i) => i.medicationId === med?.id).map((i) => [i.slotId, fmtAmount(i.amount)])));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const slots: { slotId: string; amount: number }[] = [];
    for (const s of data.slots) {
      const raw = amounts[s.id]?.trim() ?? '';
      if (raw === '') continue;
      const amount = parseNum(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        setError('Amounts must be numbers.');
        return;
      }
      if (amount > 0) slots.push({ slotId: s.id, amount });
    }
    const id = med ? med.id : (await addMedication(db, { name, unit })).id;
    if (med && (med.name !== name.trim() || med.unit !== unit)) await updateMedication(db, med.id, { name: name.trim(), unit });
    const before = (regimen?.items ?? []).filter((i) => i.medicationId === id).map((i) => `${i.slotId}:${i.amount}`).sort().join();
    const after = slots.map((s) => `${s.slotId}:${s.amount}`).sort().join();
    if (before !== after) await setStackEntry(db, id, slots);
    onDone();
  }

  return (
    <Card>
      <h2 className="m-0 text-base font-extrabold">{med ? `Edit ${med.name}` : 'New medication'}</h2>
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bisoprolol" className="[&_input]:text-base" autoFocus={!med} />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-[var(--text-secondary)]">Unit</span>
        <div className="flex flex-wrap gap-2">{UNITS.map((u) => <Chip key={u} pressed={unit === u} onClick={() => setUnit(u)}>{u}</Chip>)}</div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-[var(--text-secondary)]">Amount per time of day (leave empty if not taken)</span>
        <div className="grid grid-cols-4 gap-2">
          {data.slots.map((s) => (
            <Field key={s.id} label={s.name} inputMode="decimal" placeholder="–" value={amounts[s.id] ?? ''}
              onChange={(e) => setAmounts({ ...amounts, [s.id]: e.target.value })} />
          ))}
        </div>
      </div>
      {error && <p role="alert" className="m-0 text-sm font-bold text-[var(--warn)]">{error}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={save} disabled={name.trim() === ''}>Save</Button>
      </div>
      {med && (
        <Button variant="danger" size="sm" className="self-start" onClick={async () => { await archiveMedication(db, med.id); onDone(); }}>
          Archive (remove from stack)
        </Button>
      )}
    </Card>
  );
}
