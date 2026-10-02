import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
  big?: boolean;
}

/** Labelled input; numeric fields use inputMode so Android shows the number pad. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, invalid, big, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 text-[13px] font-bold text-[var(--text-secondary)]', className)}>
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          'num w-full min-w-0 rounded-[14px] border bg-[var(--surface-2)] px-3 font-extrabold text-[var(--text-primary)] outline-none',
          big ? 'min-h-14 text-[26px]' : 'min-h-12 text-[18px]',
          invalid ? 'border-[var(--warn)]' : 'border-[var(--border-strong)] focus:border-[var(--accent)]',
        )}
        {...props}
      />
      {hint && (
        <span id={`${inputId}-hint`} className={cn('text-xs font-medium', invalid ? 'text-[var(--warn)]' : 'text-[var(--text-muted)]')}>
          {hint}
        </span>
      )}
    </div>
  );
});

/** Parses a user-typed number ("7,5" → 7.5); NaN when empty or invalid. */
export function parseNum(raw: string): number {
  if (raw.trim() === '') return NaN;
  return Number(raw.replace(',', '.'));
}
