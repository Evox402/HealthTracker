import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

/** Toggle chip (context tags, filters). */
export function Chip({ pressed, onClick, children, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-10 cursor-pointer rounded-full border px-3.5 text-[13px] font-bold',
        pressed
          ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent-text)]'
          : 'border-[var(--border-strong)] text-[var(--text-secondary)]',
        className,
      )}
    >
      {children}
    </button>
  );
}
