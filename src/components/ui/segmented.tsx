import { cn } from '@/lib/cn';

const COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' };

export interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}

/** A row of mutually exclusive buttons (slot picker, parameter switcher). */
export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-1.5 rounded-2xl bg-[var(--surface)] p-1', COLS[options.length] ?? 'grid-cols-4', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-11 cursor-pointer rounded-xl px-1 text-sm font-bold',
            o.value === value ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
