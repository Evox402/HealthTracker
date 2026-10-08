import { Check, ChevronDown, CloudDownload, MoreHorizontal, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field, parseNum } from '@/components/ui/field';
import { StatusMark } from '@/components/ui/status';
import { useAckedFlags } from '@/hooks/useAckedFlags';
import { useAppData, useCurrent, useEngine, useNow, type AppData } from '@/hooks/useAppData';
import { deleteDoses, recordDose } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { daysAgo, fmtAmount, fmtDay, fmtReading, fmtTime, fmtWeekdayTime, greeting, readingStatus, targetText } from '@/lib/format';
import { dayKey } from '@/lib/slots';
import { allTrackers, fmtSymptom, fmtSymptomShort, trackerPath, type Tracker } from '@/lib/trackers';
import type { DoseEvent, RegimenItem, RegimenVersion, SlotDef } from '@/lib/types';
import { RedFlagBanner } from './RedFlagBanner';

export function TodayScreen() {
  const now = useNow();
  const data = useAppData();
  const result = useEngine(data, now);
  const { regimen, slot } = useCurrent(data, now);
  const [acked, ack] = useAckedFlags();
  if (!data || !result || !slot) return <Loading />;

  const flags = result.redFlags.filter((f) => !acked.has(f.key));
  const backupAge = daysAgo(data.appSettings.lastBackupAt, now);
  const hasData = data.readings.length + data.symptomEntries.length + data.doseEvents.length > 0;
  const needsBackup = hasData && (backupAge === null || backupAge > 3);

  return (
    <Screen
      title={greeting(now)}
      subtitle={`${fmtDay(now)} · ${slot.name}`}
      action={
        <Link to="/settings" aria-label="Settings" className={buttonClass('secondary', 'icon')}>
          <Settings size={20} aria-hidden />
        </Link>
      }
    >
      {flags.map((f) => (
        <RedFlagBanner key={f.key} flag={f} onAcknowledge={() => ack(f.key)} />
      ))}

      <MedsToday data={data} regimen={regimen} slot={slot} now={now} />

      <SectionTitle action={<Link to="/charts" className="text-sm font-bold text-[var(--accent-text)] no-underline">Charts</Link>}>
        Trackers
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {allTrackers(data.parameters, data.symptoms).map((t) => (
          <TrackerTile key={`${t.kind}:${t.id}`} tracker={t} data={data} now={now} />
        ))}
      </div>
      <Link to="/settings#trackers" className="self-start text-sm font-bold text-[var(--accent-text)] no-underline">+ New tracker</Link>

      {needsBackup && (
        <Link to="/settings#backup" className="glass flex items-center gap-3 rounded-[18px] p-3.5 text-[var(--text-primary)] no-underline">
          <CloudDownload size={22} className="shrink-0 text-[var(--accent-text)]" aria-hidden />
          <span className="text-sm">
            <span className="font-extrabold">Back up your data.</span>{' '}
            {backupAge === null ? 'No backup yet.' : `Last backup ${backupAge} days ago.`} Everything lives only on this phone.
          </span>
        </Link>
      )}
    </Screen>
  );
}

interface TrackerTileProps {
  tracker: Tracker;
  data: AppData;
  now: Date;
}

/** Last value of one tracker. The tile opens its chart; "+" opens the log sheet. */
function TrackerTile({ tracker, data, now }: TrackerTileProps) {
  const when = (iso: string) => {
    const d = new Date(iso);
    return dayKey(d, data.slots) === dayKey(now, data.slots) ? fmtTime(d) : fmtWeekdayTime(d);
  };
  let value = '–';
  let detail = 'Nothing logged yet';
  let status: ReturnType<typeof readingStatus> | null = null;
  let label = tracker.name;

  if (tracker.kind === 'p') {
    const r = [...data.readings].reverse().find((x) => x.parameterId === tracker.id);
    const target = targetText(tracker.def);
    if (r) {
      value = fmtReading(tracker.def, r);
      status = readingStatus(tracker.def, r);
      detail = `${tracker.def.unit} · ${when(r.takenAt)}`;
    }
    if (target) detail += ` · target ${target}`;
  } else {
    const e = [...data.symptomEntries].reverse().find((x) => x.symptomId === tracker.id);
    if (e) {
      value = fmtSymptomShort(tracker.def, e);
      detail = `${tracker.def.type === 'scale' ? '/10 · ' : tracker.def.type === 'stool' ? 'Bristol · ' : ''}${when(e.takenAt)}`;
      if (tracker.def.type === 'scale' && e.score > tracker.def.threshold) status = 'above';
      label = `${tracker.name}, last ${fmtSymptom(tracker.def, e)}`;
    }
  }

  return (
    <div className={cn('relative flex flex-col gap-1.5 rounded-[20px] p-3.5', status === 'redflag' ? 'border-2 border-[var(--loss-strong)] bg-[var(--loss-subtle)]' : 'glass')}>
      <Link to={`/charts/${trackerPath(tracker)}`} aria-label={`${label}: open chart`} className="absolute inset-0 rounded-[20px]" />
      <div className="flex items-start justify-between gap-1 pr-9 text-[13px] font-semibold text-[var(--text-muted)]">
        <span className="truncate">{tracker.name}</span>
      </div>
      <div className="num flex items-baseline gap-1.5 text-[28px] leading-tight font-extrabold tracking-[-0.5px]">
        {value}
        {status && <StatusMark status={status} short={status === 'in'} className="text-[12px] tracking-normal" />}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{detail}</div>
      <Link
        to={`/log/${trackerPath(tracker)}`}
        aria-label={`Log ${tracker.name}`}
        className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
      >
        <Plus size={20} strokeWidth={2.6} aria-hidden />
      </Link>
    </div>
  );
}

interface MedsTodayProps {
  data: AppData;
  regimen: RegimenVersion | undefined;
  slot: SlotDef;
  now: Date;
}

/** Checklist of the med stack: the current time of day first, the rest of today folded away. */
function MedsToday({ data, regimen, slot, now }: MedsTodayProps) {
  const [showAll, setShowAll] = useState(false);
  const items = regimen?.items ?? [];
  if (items.length === 0) {
    return (
      <Card>
        <div className="font-extrabold">No medications yet</div>
        <p className="m-0 text-sm text-[var(--text-secondary)]">Add your med stack to tick off doses as you take them.</p>
        <Link to="/meds" className={cn(buttonClass('secondary', 'sm'), 'self-start no-underline')}>Set up med stack</Link>
      </Card>
    );
  }

  const today = dayKey(now, data.slots);
  const recordsFor = (i: RegimenItem) =>
    data.doseEvents.filter((d) => d.medicationId === i.medicationId && d.slotId === i.slotId && d.status !== 'extra' && dayKey(new Date(d.takenAt), data.slots) === today);
  const slotItems = (s: SlotDef) => items.filter((i) => i.slotId === s.id && data.medications.some((m) => m.id === i.medicationId));
  const current = slotItems(slot);
  const others = data.slots.filter((s) => s.id !== slot.id && slotItems(s).length > 0);
  const open = (s: SlotDef) => slotItems(s).filter((i) => recordsFor(i).length === 0);
  const openOthers = others.reduce((n, s) => n + open(s).length, 0);

  async function allTaken(s: SlotDef) {
    for (const i of open(s)) {
      await recordDose(db, { medicationId: i.medicationId, slotId: s.id, status: 'taken', plannedAmount: i.amount, takenAt: new Date().toISOString(), regimenVersionId: regimen?.id ?? null });
    }
  }

  const slotBlock = (s: SlotDef) => (
    <div key={s.id} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[15px] font-extrabold">{s.name}</h3>
        {open(s).length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => void allTaken(s)}><Check size={16} aria-hidden /> All taken</Button>
        )}
      </div>
      {slotItems(s).map((i) => (
        <DoseRow key={i.medicationId} item={i} data={data} records={recordsFor(i)} regimenId={regimen?.id ?? null} />
      ))}
    </div>
  );

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-base font-extrabold">Medications</h2>
        <Link to="/meds" className="text-sm font-bold text-[var(--accent-text)] no-underline">Edit stack</Link>
      </div>
      {current.length > 0 ? slotBlock(slot) : <p className="m-0 text-sm text-[var(--text-muted)]">Nothing planned for {slot.name.toLowerCase()}.</p>}
      {others.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((x) => !x)}
            className="flex min-h-10 cursor-pointer items-center justify-between rounded-xl bg-transparent px-0 text-sm font-bold text-[var(--text-secondary)]"
          >
            <span>Other times today{openOthers > 0 ? ` · ${openOthers} open` : ' · all done'}</span>
            <ChevronDown size={18} className={cn('transition-transform', showAll && 'rotate-180')} aria-hidden />
          </button>
          {showAll && others.map(slotBlock)}
        </>
      )}
    </Card>
  );
}

interface DoseRowProps {
  item: RegimenItem;
  data: AppData;
  records: DoseEvent[];
  regimenId: string | null;
}

/** One planned dose: tap the check to mark it taken (tap again to undo); "…" for skipped or another amount. */
function DoseRow({ item, data, records, regimenId }: DoseRowProps) {
  const [more, setMore] = useState(false);
  const [amount, setAmount] = useState('');
  const med = data.medications.find((m) => m.id === item.medicationId);
  const record = records[records.length - 1];
  const ids = records.map((r) => r.id);
  const base = { medicationId: item.medicationId, slotId: item.slotId, plannedAmount: item.amount, regimenVersionId: regimenId };
  const status = record?.status;
  const taken = status === 'taken' || status === 'changed';

  async function toggle() {
    if (record) await deleteDoses(db, ids);
    else await recordDose(db, { ...base, status: 'taken', takenAt: new Date().toISOString() });
  }

  const state = !record ? '' : status === 'skipped' ? 'Skipped' : status === 'changed' ? `Took ${fmtAmount(record.actualAmount)} ${med?.unit ?? ''}` : `Taken ${fmtTime(new Date(record.takenAt))}`;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-[var(--surface-2)] p-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={taken}
          aria-label={`${med?.name ?? 'Medication'} ${fmtAmount(item.amount)} ${med?.unit ?? ''}: ${record ? `${state}, tap to undo` : 'mark as taken'}`}
          onClick={() => void toggle()}
          className={cn(
            'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2',
            taken ? 'border-[var(--gain)] bg-[var(--gain)] text-[#052e16]'
              : status === 'skipped' ? 'border-[var(--warn)] bg-transparent text-[var(--warn)]'
                : 'border-[var(--border-strong)] bg-transparent text-transparent',
          )}
        >
          {status === 'skipped' ? <span className="text-lg font-extrabold" aria-hidden>–</span> : <Check size={22} strokeWidth={3} aria-hidden />}
        </button>
        <div className="flex min-w-0 grow flex-col">
          <span className={cn('truncate text-[15px] font-extrabold', taken && 'text-[var(--text-secondary)]')}>{med?.name ?? 'Unknown medication'}</span>
          <span className="num text-[13px] text-[var(--text-muted)]">
            {fmtAmount(item.amount)} {med?.unit}{state ? ` · ${state}` : ''}
          </span>
        </div>
        <Button variant="ghost" size="icon" aria-label={`More options for ${med?.name ?? 'medication'}`} aria-expanded={more} onClick={() => setMore((x) => !x)}>
          <MoreHorizontal size={20} aria-hidden />
        </Button>
      </div>
      {more && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Chip pressed={status === 'skipped'} className="rounded-xl" onClick={async () => {
              await recordDose(db, { ...base, status: 'skipped', takenAt: new Date().toISOString() }, ids);
              setMore(false);
            }}>Skipped</Chip>
            <Chip pressed={status === 'changed'} className="rounded-xl" onClick={() => setAmount(amount || fmtAmount(item.amount))}>Other amount</Chip>
          </div>
          {amount !== '' && (
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Field label={`Amount taken (${med?.unit ?? ''})`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button disabled={!Number.isFinite(parseNum(amount))} onClick={async () => {
                await recordDose(db, { ...base, status: 'changed', actualAmount: parseNum(amount), takenAt: new Date().toISOString() }, ids);
                setAmount('');
                setMore(false);
              }}>Save</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
