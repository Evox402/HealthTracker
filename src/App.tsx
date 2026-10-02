import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DoctorView } from '@/components/doctor/DoctorView';
import { InsightsScreen } from '@/components/insights/InsightsScreen';
import { BottomNav } from '@/components/layout/BottomNav';
import { Loading } from '@/components/layout/Screen';
import { QuickLogScreen } from '@/components/log/QuickLogScreen';
import { MedicationsScreen } from '@/components/medications/MedicationsScreen';
import { Welcome } from '@/components/onboarding/Welcome';
import { RegimenScreen } from '@/components/regimen/RegimenScreen';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { TodayScreen } from '@/components/today/TodayScreen';
import { TrendsScreen } from '@/components/trends/TrendsScreen';
import { ToastProvider } from '@/components/ui/toast';
import { useSettings } from '@/hooks/useAppData';
import { db } from '@/lib/db';
import { ensureSeeded } from '@/lib/seed';
import type { AppSettings } from '@/lib/types';

function useTheme(theme: AppSettings['theme'] | undefined) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : (theme ?? 'dark');
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#F4F7FB' : '#0B1220');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

function Shell() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith('/log') || pathname.startsWith('/doctor');
  return (
    <>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/log/:slotId?" element={<QuickLogScreen />} />
        <Route path="/trends/:parameterId?" element={<TrendsScreen />} />
        <Route path="/insights" element={<InsightsScreen />} />
        <Route path="/regimen" element={<RegimenScreen />} />
        <Route path="/medications" element={<MedicationsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/doctor" element={<DoctorView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </>
  );
}

export default function App() {
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = useSettings();
  useTheme(settings?.theme);

  useEffect(() => {
    ensureSeeded(db).then(() => setSeeded(true), (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <main role="alert" className="mx-auto flex max-w-md flex-col gap-3 px-4 pt-16">
        <h1 className="text-2xl font-extrabold">Storage unavailable</h1>
        <p className="text-[var(--text-secondary)]">
          The app could not open its local database ({error}). Private browsing or blocked site data can cause this. Open the
          installed app or allow site data, then reload.
        </p>
      </main>
    );
  }
  if (!seeded || !settings) return <Loading />;

  return (
    <ToastProvider>
      <HashRouter>{settings.disclaimerAcceptedAt ? <Shell /> : <Welcome />}</HashRouter>
    </ToastProvider>
  );
}
