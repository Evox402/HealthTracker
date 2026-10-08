import { HeartPulse, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Loading, Screen } from '@/components/layout/Screen';
import { TargetsEditor } from '@/components/settings/TargetsEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppData } from '@/hooks/useAppData';
import { updateSettings } from '@/lib/actions';
import { db } from '@/lib/db';

/** First launch: what the app is, the safety disclaimer, then (optionally) the care team's targets. */
export function Welcome() {
  const [step, setStep] = useState<'intro' | 'targets'>('intro');
  const data = useAppData();

  async function finish() {
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Persistence is best-effort; Settings shows the result.
    }
    await updateSettings(db, { disclaimerAcceptedAt: new Date().toISOString() });
  }

  if (step === 'targets') {
    if (!data) return <Loading />;
    return (
      <Screen title="Your targets" subtitle="Step 2 of 2" withNav={false}>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          If your care team gave you target ranges, enter them here. The defaults are generic starting points only. You can
          change them, and add your own trackers, any time in Settings.
        </p>
        <TargetsEditor
          parameters={data.parameters.filter((p) => !p.archived && p.components.some((c) => c.targetMin !== undefined))}
          symptoms={data.symptoms.filter((s) => !s.archived && s.type === 'scale')}
          showRedFlags
          saveLabel="Save and start"
          onSaved={finish}
        />
        <Button variant="ghost" className="self-center" onClick={finish}>Skip, keep the defaults</Button>
      </Screen>
    );
  }

  return (
    <Screen title="Health Tracker" subtitle="Welcome" withNav={false}>
      <Card>
        <HeartPulse className="text-[var(--accent-text)]" size={32} aria-hidden />
        <p className="m-0 text-[16px] leading-relaxed">
          Tick off your medications, log blood pressure, pulse and weight, and track symptoms like pain or stool. Add your
          own trackers and see everything in charts, plus a one-page summary for your care team.
        </p>
        <p className="m-0 text-[15px] text-[var(--text-secondary)]">
          Everything stays on this phone. Nothing is sent anywhere.
        </p>
      </Card>
      <Card className="border-[var(--warn)]">
        <div className="flex items-center gap-2 font-extrabold text-[var(--warn)]">
          <ShieldAlert size={22} aria-hidden /> Not medical advice
        </div>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
          <li>Never change your medication without your care team.</li>
          <li>Charts and summaries show your own measurements; they are not a diagnosis.</li>
          <li>Red-flag warnings only compare values with the limits entered in Settings.</li>
          <li>If you feel unwell or a value is dangerous, contact your care team or emergency services immediately.</li>
        </ul>
      </Card>
      <Button size="lg" onClick={() => setStep('targets')}>I understand, continue</Button>
    </Screen>
  );
}
