import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div';
  solid?: boolean;
}

export function Card({ as: Tag = 'section', solid, className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'flex flex-col gap-3 rounded-[22px] p-4',
        solid ? 'border border-[var(--border)] bg-[var(--surface-solid)]' : 'glass',
        className,
      )}
      {...props}
    />
  );
}
