import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { runEngine } from '@/engine';
import { currentRegimen } from '@/lib/actions';
import { db } from '@/lib/db';
import { slotFor } from '@/lib/slots';
import { loadSnapshotData, toSnapshot, type SnapshotData } from '@/lib/snapshot';
import type { AppSettings, EngineResult, RegimenVersion, SlotDef } from '@/lib/types';

/** Current time, refreshed every 30 s so slots, red flags and "x min ago" stay current. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface AppData extends SnapshotData {
  appSettings: AppSettings;
}

/** All app data, live: re-renders on every database change. undefined while loading. */
export function useAppData(): AppData | undefined {
  return useLiveQuery(async () => {
    const [data, appSettings] = await Promise.all([loadSnapshotData(db), db.settings.get('settings')]);
    return appSettings ? { ...data, appSettings } : undefined;
  }, []);
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => db.settings.get('settings'), []);
}

/** The only way UI code reaches the engine (CLAUDE.md). */
export function useEngine(data: AppData | undefined, now: Date): EngineResult | undefined {
  const minute = Math.floor(now.getTime() / 60_000);
  // Re-run on every data change or minute tick, with the real current time: a
  // reading saved seconds ago must not count as "in the future".
  return useMemo(() => (data ? runEngine(toSnapshot(data, new Date())) : undefined), [data, minute]);
}

export function useCurrent(data: AppData | undefined, now: Date): { regimen: RegimenVersion | undefined; slot: SlotDef | undefined } {
  return useMemo(() => ({
    regimen: data ? currentRegimen(data.regimens, now) : undefined,
    slot: data && data.slots.length > 0 ? slotFor(now, data.slots) : undefined,
  }), [data, now]);
}
