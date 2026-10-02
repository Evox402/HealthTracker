import { HeartPulse, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Loading, Screen } from '@/components/layout/Screen';
import { TargetsEditor } from '@/components/settings/TargetsEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppData } from '@/hooks/useAppData';
import { updateSettings } from '@/lib/actions';
import { db } from '@/lib/db';

/** First launch: what the app is, the safety disclaimer, then the care team's targets. */
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
          Enter the target ranges your care team gave you. The defaults are generic starting points only. You can change
          them any time in Settings.
        </p>
        <TargetsEditor parameters={data.parameters} symptoms={data.symptoms} saveLabel="Save and start" onSaved={finish} />
      </Screen>
    );
  }

  return (
    <Screen title="MedicineAdjuster" subtitle="Welcome" withNav={false}>
      <Card>
        <HeartPulse className="text-[var(--accent-text)]" size={32} aria-hidden />
        <p className="m-0 text-[16px] leading-relaxed">
          Log your blood pressure, heart rate, oxygen, breathing rate, symptoms and medication doses through the day. The
          app looks for patterns, like values that are high at the same time each day or wear off before the next dose,
          and turns them into points to discuss with your care team.
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
          <li>The patterns are rule-based summaries of your own measurements, not a diagnosis.</li>
          <li>Drug timing values are approximate.</li>
          <li>If you feel unwell or a value is dangerous, contact your care team or emergency services immediately.</li>
        </ul>
      </Card>
      <Button size="lg" onClick={() => setStep('targets')}>I understand, continue</Button>
    </Screen>
  );
}
