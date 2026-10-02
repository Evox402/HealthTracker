import type { ParameterComponent, ParameterDef, Reading } from './types';

// Display helpers for the UI (the engine has its own wording in engine/text.ts).

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const fmtDay = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const fmtDayTime = (d: Date) => `${fmtDay(d)}, ${fmtTime(d)}`;
export const fmtWeekdayTime = (d: Date) => `${WEEKDAYS[d.getDay()]} ${fmtTime(d)}`;

export function fmtAmount(n: number): string {
  return String(Number(n.toFixed(2)));
}

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
}

/** "126/78" for BP, "72" otherwise. */
export function fmtReading(p: ParameterDef, r: Reading): string {
  return p.components.map((c) => (r.values[c.key] === undefined ? '–' : String(r.values[c.key]))).join('/');
}

export function targetText(p: ParameterDef): string {
  return p.components.map((c) => `${c.targetMin}–${c.targetMax}`).join(' / ');
}

export type RangeStatus = 'in' | 'above' | 'below' | 'redflag';

export function componentStatus(c: ParameterComponent, v: number): RangeStatus {
  if ((c.redFlagMin !== undefined && v <= c.redFlagMin) || (c.redFlagMax !== undefined && v >= c.redFlagMax)) return 'redflag';
  if (v < c.targetMin) return 'below';
  if (v > c.targetMax) return 'above';
  return 'in';
}

/** Worst status over all components of a reading. */
export function readingStatus(p: ParameterDef, r: Reading): RangeStatus {
  const order: RangeStatus[] = ['in', 'below', 'above', 'redflag'];
  let worst: RangeStatus = 'in';
  for (const c of p.components) {
    const v = r.values[c.key];
    if (v === undefined) continue;
    const s = componentStatus(c, v);
    if (order.indexOf(s) > order.indexOf(worst)) worst = s;
  }
  return worst;
}

/** "Fri 07:05" relative label used in evidence lists. */
export function shortWhen(iso: string): string {
  return fmtWeekdayTime(new Date(iso));
}

/** "2026-10-02T08:30" for <input type="datetime-local">. */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${fmtTime(d)}`;
}
