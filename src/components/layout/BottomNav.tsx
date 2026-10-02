import { CalendarDays, ClipboardList, Home, Lightbulb, TrendingUp } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

const ITEMS = [
  { to: '/', label: 'Today', Icon: Home, end: true },
  { to: '/trends', label: 'Trends', Icon: TrendingUp, end: false },
  { to: '/insights', label: 'Insights', Icon: Lightbulb, end: false },
  { to: '/regimen', label: 'Regimen', Icon: CalendarDays, end: false },
  { to: '/doctor', label: 'Doctor', Icon: ClipboardList, end: false },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="glass no-print fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-md grid-cols-5 rounded-t-3xl border-b-0 px-2 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]"
    >
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px]',
              isActive ? 'font-extrabold text-[var(--accent-text)]' : 'font-semibold text-[var(--text-muted)]',
            )
          }
        >
          <Icon size={22} strokeWidth={2} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
