import { TriangleAlert } from 'lucide-react';
import type { RedFlag } from '@/lib/types';
import { fmtTime } from '@/lib/format';

export interface RedFlagBannerProps {
  flag: RedFlag;
  onAcknowledge: () => void;
}

/** Always shown above everything else (CLAUDE.md medical safety). */
export function RedFlagBanner({ flag, onAcknowledge }: RedFlagBannerProps) {
  return (
    <section role="alert" className="flex flex-col gap-3 rounded-[20px] border-2 border-[var(--loss-strong)] bg-[var(--loss-surface)] p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert className="shrink-0 text-[var(--loss)]" size={24} aria-hidden />
        <div className="flex flex-col gap-1">
          <div className="text-[17px] font-extrabold">
            {flag.title} · {fmtTime(new Date(flag.at))}
          </div>
          <div className="text-[15px] leading-snug text-[var(--text-secondary)]">{flag.message}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onAcknowledge}
        className="min-h-11 cursor-pointer rounded-xl border border-[var(--loss)] bg-transparent font-bold text-[var(--text-primary)]"
      >
        I've informed the care team
      </button>
    </section>
  );
}
