import { ArrowLeft, Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, parseNum } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { useAppData, useNow } from '@/hooks/useAppData';
import { updateSettings } from '@/lib/actions';
import { backupCounts, createBackup, downloadBackup, parseBackup, restoreBackup, type Backup, BackupError } from '@/lib/backup';
import { db } from '@/lib/db';
import { daysAgo } from '@/lib/format';
import type { AppSettings, SlotDef } from '@/lib/types';
import { TrackersSection } from './TrackersSection';

export function SettingsScreen() {
  const data = useAppData();
  const { hash } = useLocation();
  const [section, setSection] = useState<'trackers' | 'general'>(hash === '#trackers' ? 'trackers' : 'general');
  if (!data) return <Loading />;
  const s = data.appSettings;

  return (
    <Screen
      title="Settings"
      action={<Link to="/" aria-label="Back to Today" className={buttonClass('secondary', 'icon')}><ArrowLeft size={20} aria-hidden /></Link>}
    >
      <Segmented label="Section" value={section} onChange={setSection}
        options={[{ value: 'general', label: 'General' }, { value: 'trackers', label: 'Trackers' }]} />

      {section === 'trackers' ? (
        <TrackersSection parameters={data.parameters} symptoms={data.symptoms} />
      ) : (
        <>
          <BackupSection settings={s} />
          <SlotsEditor slots={data.slots} />

          <SectionTitle>Appearance</SectionTitle>
          <Segmented<AppSettings['theme']> label="Theme" value={s.theme} onChange={(theme) => updateSettings(db, { theme })}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />

          <SectionTitle>About</SectionTitle>
          <Card>
            <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
              Not medical advice. Never change your medication without your care team. Red flags only compare values with the limits
              you entered. All data stays on this device.
            </p>
            <Link to="/doctor" className="text-sm font-bold text-[var(--accent-text)] no-underline">Open doctor view / print summary</Link>
            <StorageStatus />
          </Card>
        </>
      )}
    </Screen>
  );
}

interface BackupSectionProps {
  settings: AppSettings;
}

function BackupSection({ settings }: BackupSectionProps) {
  const now = useNow();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const age = daysAgo(settings.lastBackupAt, now);

  async function exportNow() {
    downloadBackup(await createBackup(db));
    await updateSettings(db, { lastBackupAt: new Date().toISOString() });
    toast({ message: 'Backup downloaded' });
  }

  async function onFile(f: File | undefined) {
    setError(null);
    setPending(null);
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Could not read the file.');
    } finally {
      if (file.current) file.current.value = '';
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    downloadBackup(await createBackup(db), `health-tracker-before-restore-${Date.now()}.json`);
    await restoreBackup(db, pending);
    setPending(null);
    toast({ message: 'Backup restored' });
  }

  const counts = pending ? backupCounts(pending) : null;
  return (
    <>
      <SectionTitle>Backup</SectionTitle>
      <Card id="backup">
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          {age === null ? 'No backup yet.' : `Last backup: ${age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}.`} Your data
          lives only on this phone. Keep a backup file somewhere safe.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button onClick={exportNow}><Download size={18} aria-hidden /> Export</Button>
          <Button variant="secondary" onClick={() => file.current?.click()}><Upload size={18} aria-hidden /> Restore</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Backup file"
          onChange={(e) => void onFile(e.target.files?.[0])} />
        {error && <p role="alert" className="m-0 text-sm font-bold text-[var(--warn)]">{error}</p>}
        {pending && counts && (
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--warn)] p-3">
            <p className="m-0 text-sm">
              Backup from {new Date(pending.exportedAt).toLocaleString()}: {counts.readings} readings, {counts.symptomEntries} symptom entries,{' '}
              {counts.doseEvents} doses, {counts.medications} medications.
            </p>
            <p className="m-0 text-sm font-bold text-[var(--warn)]">This replaces everything on this phone. A copy of the current data is downloaded first.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmRestore}>Replace data</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

interface SlotsEditorProps {
  slots: SlotDef[];
}

function SlotsEditor({ slots }: SlotsEditorProps) {
  const toast = useToast();
  const [hours, setHours] = useState<Record<string, string>>(() => Object.fromEntries(slots.map((s) => [s.id, String(s.startHour)])));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = slots.map((s) => ({ ...s, startHour: parseNum(hours[s.id]) }));
    const ok = next.every((s, i) => Number.isInteger(s.startHour) && s.startHour >= 0 && s.startHour <= 23 && (i === 0 || s.startHour > next[i - 1].startHour));
    if (!ok) {
      setError('Use whole hours from 0 to 23, each later than the one before.');
      return;
    }
    setError(null);
    await db.slots.bulkPut(next);
    toast({ message: 'Times of day saved' });
  }

  return (
    <>
      <SectionTitle>Times of day</SectionTitle>
      <Card>
        <p className="m-0 text-[13px] text-[var(--text-muted)]">Each time of day starts at this hour and runs until the next one starts.</p>
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => (
            <Field key={s.id} label={s.name} inputMode="numeric" value={hours[s.id] ?? ''} onChange={(e) => setHours({ ...hours, [s.id]: e.target.value })} hint=":00" />
          ))}
        </div>
        {error && <p role="alert" className="m-0 text-sm font-bold text-[var(--warn)]">{error}</p>}
        <Button variant="secondary" size="sm" className="self-start" onClick={save}>Save times</Button>
      </Card>
    </>
  );
}

function StorageStatus() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);
  if (persisted === null) return null;
  return (
    <p className="m-0 text-xs text-[var(--text-muted)]">
      Storage: {persisted ? 'persistent (the browser will not clear it automatically)' : 'not marked persistent. Install the app to the home screen and keep backups.'}
    </p>
  );
}
