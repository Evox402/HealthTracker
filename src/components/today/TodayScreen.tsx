import { Check, CloudDownload, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChangeCard } from '@/components/insights/ChangeCard';
import { InsightCard } from '@/components/insights/InsightCard';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusMark } from '@/components/ui/status';
import { useAckedFlags } from '@/hooks/useAckedFlags';
import { useAppData, useCurrent, useEngine, useNow } from '@/hooks/useAppData';
import { dismissInsight, isDismissed } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { daysAgo, fmtAmount, fmtDay, fmtReading, fmtTime, fmtWeekdayTime, greeting, readingStatus, targetText } from '@/lib/format';
import { dayKey, slotFor } from '@/lib/slots';
import { RedFlagBanner } from './RedFlagBanner';

export function TodayScreen() {
  const now = useNow();
  const data = useAppData();
  const result = useEngine(data, now);
  const { regimen, slot } = useCurrent(data, now);
  const [acked, ack] = useAckedFlags();
  if (!data || !result || !slot) return <Loading />;

  const today = dayKey(now, data.slots);
  const inSlot = (iso: string) => {
    const d = new Date(iso);
    return dayKey(d, data.slots) === today && slotFor(d, data.slots).id === slot.id;
  };
  const loggedTimes = [...data.readings, ...data.doseEvents].filter((x) => inSlot(x.takenAt)).map((x) => x.takenAt).sort();
  const logged = loggedTimes.length > 0;
  const nextSlot = data.slots[(data.slots.findIndex((s) => s.id === slot.id) + 1) % data.slots.length];
  const target = logged ? nextSlot : slot;
  const targetDoses = (regimen?.items ?? []).filter((i) => i.slotId === target.id);
  const medName = (id: string) => data.medications.find((m) => m.id === id);

  const flags = result.redFlags.filter((f) => !acked.has(f.key));
  const insights = result.insights.filter((i) => !isDismissed(data.appSettings, i.key, i.confidence));
  const latestChange = [...result.changeEvaluations].reverse().find((c) => c.status !== 'insufficient_data');
  const backupAge = daysAgo(data.appSettings.lastBackupAt, now);
  const needsBackup = data.readings.length > 0 && (backupAge === null || backupAge > 3);

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

      <Card className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {logged && (
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--gain)]">
              <Check size={16} strokeWidth={2.6} aria-hidden /> {slot.name} logged at {fmtTime(new Date(loggedTimes[loggedTimes.length - 1]))}
            </div>
          )}
          <div className="text-lg font-extrabold">{logged ? `Next: ${target.name} · ${target.defaultTime}` : `Now: ${slot.name}`}</div>
          <div className="text-[13px] text-[var(--text-muted)]">
            {targetDoses.length > 0
              ? `${targetDoses.map((i) => `${medName(i.medicationId)?.name ?? '?'} ${fmtAmount(i.amount)} ${medName(i.medicationId)?.unit ?? ''}`).join(', ')} + vitals`
              : 'Vitals and symptoms'}
          </div>
        </div>
        <Link to={`/log/${target.id}`} className={cn(buttonClass('primary', 'md'), 'shrink-0 whitespace-nowrap no-underline')}>
          Log now
        </Link>
      </Card>

      {!regimen && (
        <Card>
          <div className="font-extrabold">No medication plan yet</div>
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            Add your medications and when you take them, so the app can relate your readings to your doses.
          </p>
          <Link to="/regimen" className={cn(buttonClass('secondary', 'sm'), 'self-start no-underline')}>Set up regimen</Link>
        </Card>
      )}

      <SectionTitle action={<Link to="/trends" className="text-sm font-bold text-[var(--accent-text)] no-underline">Trends</Link>}>
        Latest values
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {data.parameters.filter((p) => !p.archived).map((p) => {
          const r = [...data.readings].reverse().find((x) => x.parameterId === p.id);
          const status = r ? readingStatus(p, r) : null;
          return (
            <Link
              key={p.id}
              to={`/trends/${p.id}`}
              className={cn(
                'flex flex-col gap-1.5 rounded-[20px] p-3.5 text-[var(--text-primary)] no-underline',
                status === 'redflag' ? 'border-2 border-[var(--loss-strong)] bg-[var(--loss-subtle)]' : 'glass',
              )}
            >
              <div className="flex justify-between gap-1 text-[13px] font-semibold text-[var(--text-muted)]">
                <span className="truncate">{p.name}</span>
                {status && <StatusMark status={status} short={status === 'in'} className="text-[12px]" />}
              </div>
              <div className="num text-[30px] leading-tight font-extrabold tracking-[-0.5px]">{r ? fmtReading(p, r) : '–'}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {r ? `${p.unit} · ${dayKey(new Date(r.takenAt), data.slots) === today ? fmtTime(new Date(r.takenAt)) : fmtWeekdayTime(new Date(r.takenAt))}` : 'No reading yet'} · target {targetText(p)}
              </div>
            </Link>
          );
        })}
      </div>

      {(insights.length > 0 || latestChange) && (
        <SectionTitle action={<Link to="/insights" className="text-sm font-bold text-[var(--accent-text)] no-underline">See all {insights.length}</Link>}>
          Top insights
        </SectionTitle>
      )}
      {insights.slice(0, 2).map((i) => (
        <InsightCard key={i.key} insight={i} data={data} onDismiss={() => dismissInsight(db, i.key, i.confidence)} />
      ))}
      {latestChange && insights.length < 2 && <ChangeCard evaluation={latestChange} data={data} compact />}
      {insights.length === 0 && !latestChange && data.readings.length > 0 && (
        <p className="m-0 text-sm text-[var(--text-muted)]">No patterns yet. Keep logging: insights appear after a few readings per time of day.</p>
      )}

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
