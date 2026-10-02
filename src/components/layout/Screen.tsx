import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ScreenProps {
  title: string;
  subtitle?: ReactNode;
  /** Shown below the title. */
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Leaves room for the bottom navigation. */
  withNav?: boolean;
  className?: string;
}

export function Screen({ title, subtitle, description, action, children, withNav = true, className }: ScreenProps) {
  return (
    <main className={cn('mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-6', withNav ? 'pb-32' : 'pb-8', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {subtitle && <div className="text-sm font-semibold text-[var(--text-muted)]">{subtitle}</div>}
          <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.5px]">{title}</h1>
          {description && <p className="m-0 text-[13px] leading-snug text-[var(--text-muted)]">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}

export interface SectionTitleProps {
  children: ReactNode;
  action?: ReactNode;
}

export function SectionTitle({ children, action }: SectionTitleProps) {
  return (
    <div className="flex items-baseline justify-between pt-1">
      <h2 className="m-0 text-[17px] font-extrabold">{children}</h2>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div role="status" className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center text-[var(--text-muted)]">
      Loading…
    </div>
  );
}
