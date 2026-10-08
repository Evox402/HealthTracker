import type { RangeStatus } from '@/lib/format';
import { cn } from '@/lib/cn';

const STATUS: Record<RangeStatus, { mark: string; label: string; cls: string }> = {
  none: { mark: '', label: '', cls: 'text-[var(--text-secondary)]' },
  in: { mark: '✓', label: 'In range', cls: 'text-[var(--gain)]' },
  above: { mark: '▲', label: 'Above', cls: 'text-[var(--warn)]' },
  below: { mark: '▼', label: 'Below', cls: 'text-[var(--warn)]' },
  redflag: { mark: '!', label: 'Red flag', cls: 'text-[var(--loss)]' },
};

export interface StatusMarkProps {
  status: RangeStatus;
  short?: boolean;
  className?: string;
}

/** Range status as symbol + text, never colour alone. */
export function StatusMark({ status, short, className }: StatusMarkProps) {
  const s = STATUS[status];
  if (status === 'none') return null;
  return (
    <span className={cn('font-bold', s.cls, className)}>
      {s.mark}
      {short ? <span className="sr-only"> {s.label}</span> : ` ${s.label}`}
    </span>
  );
}

export const statusTextClass = (status: RangeStatus) => STATUS[status].cls;
