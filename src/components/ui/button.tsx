import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'md' | 'lg' | 'sm' | 'icon';
}

export const buttonClass = (variant: ButtonProps['variant'] = 'primary', size: ButtonProps['size'] = 'md') =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition-[transform,opacity] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none',
    size === 'lg' && 'min-h-14 px-5 text-[17px]',
    size === 'md' && 'min-h-12 px-4 text-[15px]',
    size === 'sm' && 'min-h-10 px-3 text-[13px] rounded-xl',
    size === 'icon' && 'size-11 rounded-[14px]',
    variant === 'primary' && 'bg-[var(--accent)] text-[var(--on-accent)]',
    variant === 'secondary' && 'glass text-[var(--text-primary)]',
    variant === 'ghost' && 'bg-transparent text-[var(--accent-text)] px-1',
    variant === 'danger' && 'border border-[var(--loss)] bg-transparent text-[var(--loss)]',
    variant === 'success' && 'bg-[var(--gain)] text-[#052e16]',
  );

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...props} />;
}
