import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, type Tone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { AppData } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import type { Confidence, Insight, InsightType } from '@/lib/types';
import { describeEvidence } from './evidence';

export interface InsightCardProps {
  insight: Insight;
  data: AppData;
  defaultOpen?: boolean;
  onDismiss?: () => void;
}

export const KIND_LABEL: Record<InsightType, string> = {
  slot_out_of_range: 'Pattern',
  end_of_dose: 'Wearing off',
  uncovered_slot: 'Coverage gap',
  peak_low: 'Peak effect',
  symptom_link: 'Symptom',
  missed_dose: 'Missed dose',
};

const CONFIDENCE: Record<Confidence, { label: string; tone: Tone }> = {
  low: { label: 'Low confidence', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'warn' },
  high: { label: 'High', tone: 'loss' },
};

export function InsightCard({ insight, data, defaultOpen = false, onDismiss }: InsightCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const conf = CONFIDENCE[insight.confidence];
  const rows = open ? describeEvidence(data, insight) : [];
  return (
    <Card as="article" className="gap-2.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer flex-col gap-2 border-0 bg-transparent p-0 text-left text-[var(--text-primary)]"
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="text-xs font-extrabold tracking-[0.6px] text-[var(--text-muted)] uppercase">{KIND_LABEL[insight.type]}</span>
          <Badge tone={conf.tone}>{conf.label}</Badge>
        </span>
        <span className="text-[17px] leading-snug font-extrabold">{insight.title}</span>
        <span className="text-sm leading-relaxed text-[var(--text-secondary)]">{insight.explanation}</span>
        <span className="flex items-center gap-1 text-[13px] font-bold text-[var(--accent-text)]">
          {open ? 'Hide details' : 'Discussion point & data'}
          <ChevronDown size={16} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-2.5">
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--accent)]/40 bg-[var(--accent-subtle)] p-3">
            <span className="text-xs font-extrabold text-[var(--accent-text)]">Discuss with your care team</span>
            <span className="text-sm leading-relaxed">{insight.discussionPoint}</span>
          </div>
          {rows.length > 0 && <span className="text-xs font-extrabold text-[var(--text-muted)]">Based on</span>}
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((r) => (
              <li key={r.key}>
                {r.parameterId ? (
                  <Link to={`/trends/${r.parameterId}`} className="num flex justify-between py-1.5 text-sm text-[var(--text-primary)] no-underline">
                    <span>{r.when}</span>
                    <span className="font-bold">{r.value}</span>
                  </Link>
                ) : (
                  <span className="num flex justify-between py-1.5 text-sm">
                    <span>{r.when}</span>
                    <span className="font-bold">{r.value}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 self-start text-[13px] font-bold text-[var(--text-muted)]"
            >
              <X size={16} aria-hidden /> Dismiss (shows again if the pattern gets stronger)
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
