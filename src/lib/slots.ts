import type { SlotDef } from './types';

// Slot and day assignment in LOCAL time (meta/SPEC.md §4, "Slot assignment").
// A slot runs from its startHour until the next slot's startHour, wrapping past
// midnight. Times before the first slot of the day (e.g. 03:00) belong to the
// last slot (Night) of the previous calendar day.

function sortedSlots(slots: SlotDef[]): SlotDef[] {
  if (slots.length === 0) throw new Error('No slots configured');
  return [...slots].sort((a, b) => a.startHour - b.startHour);
}

function localHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

export function slotFor(date: Date, slots: SlotDef[]): SlotDef {
  const sorted = sortedSlots(slots);
  const hour = localHour(date);
  let match: SlotDef | undefined;
  for (const slot of sorted) if (slot.startHour <= hour) match = slot;
  return match ?? sorted[sorted.length - 1];
}

/** Local calendar day ('YYYY-MM-DD') the time belongs to, shifting early-hours Night to the previous day. */
export function dayKey(date: Date, slots: SlotDef[]): string {
  const sorted = sortedSlots(slots);
  const d = new Date(date.getTime());
  if (localHour(d) < sorted[0].startHour) d.setDate(d.getDate() - 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Slots in daily order, starting with the earliest. */
export function orderedSlots(slots: SlotDef[]): SlotDef[] {
  return sortedSlots(slots);
}
