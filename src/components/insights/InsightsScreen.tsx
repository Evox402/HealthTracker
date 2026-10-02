import { useState } from 'react';
import { Loading, Screen, SectionTitle } from '@/components/layout/Screen';
import { Chip } from '@/components/ui/chip';
import { useAppData, useEngine, useNow } from '@/hooks/useAppData';
import { dismissInsight, isDismissed } from '@/lib/actions';
import { db } from '@/lib/db';
import type { Insight } from '@/lib/types';
import { ChangeCard } from './ChangeCard';
import { InsightCard } from './InsightCard';

type Filter = 'all' | 'symptoms' | 'doses' | string;

function matches(i: Insight, f: Filter): boolean {
  if (f === 'all') return true;
  if (f === 'symptoms') return i.type === 'symptom_link';
  if (f === 'doses') return i.type === 'missed_dose';
  return i.parameterId === f && i.type !== 'missed_dose';
}

export function InsightsScreen() {
  const data = useAppData();
  const now = useNow();
  const result = useEngine(data, now);
  const [filter, setFilter] = useState<Filter>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  if (!data || !result) return <Loading />;

  const visible = result.insights.filter((i) => showDismissed || !isDismissed(data.appSettings, i.key, i.confidence));
  const dismissedCount = result.insights.length - result.insights.filter((i) => !isDismissed(data.appSettings, i.key, i.confidence)).length;
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `All · ${visible.length}` },
    ...data.parameters.filter((p) => visible.some((i) => matches(i, p.id))).map((p) => ({ value: p.id, label: p.name })),
    ...(visible.some((i) => matches(i, 'symptoms')) ? [{ value: 'symptoms', label: 'Symptoms' }] : []),
    ...(visible.some((i) => matches(i, 'doses')) ? [{ value: 'doses', label: 'Doses' }] : []),
  ];
  const shown = visible.filter((i) => matches(i, filter));
  const changes = [...result.changeEvaluations].reverse();

  return (
    <Screen title="Insights" description="Patterns in your data to discuss with your care team. Not medical advice.">
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Chip key={f.value} pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>
          ))}
        </div>
      )}

      {shown.map((i, idx) => (
        <InsightCard
          key={i.key}
          insight={i}
          data={data}
          defaultOpen={idx === 0}
          onDismiss={isDismissed(data.appSettings, i.key, i.confidence) ? undefined : () => dismissInsight(db, i.key, i.confidence)}
        />
      ))}
      {visible.length === 0 && (
        <p className="m-0 rounded-[22px] border border-dashed border-[var(--border-strong)] p-5 text-center text-sm leading-relaxed text-[var(--text-muted)]">
          No patterns found in the last {data.appSettings.analysisWindowDays} days. Keep logging: insights appear once a time of day has at
          least two readings outside the target range.
        </p>
      )}
      {dismissedCount > 0 && (
        <button type="button" onClick={() => setShowDismissed(!showDismissed)} className="min-h-10 cursor-pointer self-start text-sm font-bold text-[var(--accent-text)]">
          {showDismissed ? 'Hide dismissed' : `Show ${dismissedCount} dismissed`}
        </button>
      )}

      <SectionTitle>Regimen changes</SectionTitle>
      {changes.length === 0 ? (
        <p className="m-0 text-sm text-[var(--text-muted)]">When your regimen changes, the app compares your readings before and after here.</p>
      ) : (
        changes.map((c) => <ChangeCard key={c.regimenVersionId} evaluation={c} data={data} />)
      )}
    </Screen>
  );
}
