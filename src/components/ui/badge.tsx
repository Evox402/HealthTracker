import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'accent' | 'gain' | 'warn' | 'loss' | 'change';

const TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--surface)] text-[var(--text-secondary)]',
  accent: 'bg-[var(--accent-subtle)] text-[var(--accent-text)]',
  gain: 'bg-[var(--gain-subtle)] text-[var(--gain)]',
  warn: 'bg-[var(--warn-subtle)] text-[var(--warn)]',
  loss: 'bg-[var(--loss-subtle)] text-[var(--loss)]',
  change: 'bg-[var(--change-subtle)] text-[var(--change)]',
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold', TONES[tone], className)}>
      {children}
    </span>
  );
}
