import { dayKey, orderedSlots, slotFor } from '@/lib/slots';
import type {
  DoseEvent, DrugPK, EngineSnapshot, ID, Medication, ParameterComponent, ParameterDef, ParameterKind,
  RegimenVersion, SlotDef, SymptomDef, SymptomEntry,
} from '@/lib/types';

// Preprocessing (meta/SPEC.md §5.2): flattens readings into per-component points
// with slot, day and range status, resolves effective drug PK and the analysis window.

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export type Status = 'in' | 'above' | 'below';

export interface Point {
  readingId: ID;
  parameter: ParameterDef;
  component: ParameterComponent;
  value: number;
  at: number;
  slotId: ID;
  day: string;
  status: Status;
  /** Carries a tag from settings.excludeTags: left out of pattern rules and stats. */
  excluded: boolean;
}

export interface SymptomPoint {
  entry: SymptomEntry;
  symptom: SymptomDef;
  at: number;
  slotId: ID;
  day: string;
  above: boolean;
}

export interface MedInfo {
  med: Medication;
  name: string;
  /** null when no timing data is known (custom medication without values). */
  pk: DrugPK | null;
  affects: ParameterKind[];
}

export interface Ctx {
  snap: EngineSnapshot;
  now: number;
  slots: SlotDef[];
  current: RegimenVersion | undefined;
  /** Start of the pattern window: last analysisWindowDays, within the current regimen. */
  windowStart: number;
  points: Point[];
  windowPoints: Point[];
  symptomPoints: SymptomPoint[];
  windowSymptoms: SymptomPoint[];
  meds: Map<ID, MedInfo>;
  /** Dose events sorted by time. */
  doses: DoseEvent[];
}

export function statusOf(value: number, c: ParameterComponent): Status {
  if (value < c.targetMin) return 'below';
  if (value > c.targetMax) return 'above';
  return 'in';
}

export function effectiveMed(med: Medication, snap: EngineSnapshot): MedInfo {
  const lib = med.libraryId ? snap.drugLibrary.find((d) => d.id === med.libraryId) : undefined;
  const o = med.pkOverride ?? {};
  let pk: DrugPK | null = null;
  if (lib) {
    pk = {
      onsetH: lib.onsetH, peakH: lib.peakH, durationH: lib.durationH, halfLifeH: lib.halfLifeH,
      timingSensitive: lib.timingSensitive, steadyStateDays: lib.steadyStateDays, ...o,
    };
  } else if (o.durationH !== undefined) {
    pk = {
      onsetH: o.onsetH ?? 0, peakH: o.peakH ?? 0, durationH: o.durationH, halfLifeH: o.halfLifeH ?? 0,
      timingSensitive: o.timingSensitive ?? true, steadyStateDays: o.steadyStateDays ?? 1,
    };
  }
  return { med, name: med.name, pk, affects: med.affectsOverride ?? lib?.affects ?? [] };
}

export function regimenAt(regimens: RegimenVersion[], t: number): RegimenVersion | undefined {
  let found: RegimenVersion | undefined;
  for (const r of regimens) if (Date.parse(r.effectiveFrom) <= t) found = r;
  return found;
}

export function buildContext(snap: EngineSnapshot): Ctx {
  const now = Date.parse(snap.now);
  const slots = orderedSlots(snap.slots);
  const regimens = [...snap.regimens].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const current = regimenAt(regimens, now);
  const windowStart = Math.max(now - snap.settings.analysisWindowDays * DAY, current ? Date.parse(current.effectiveFrom) : -Infinity);
  const exclude = new Set(snap.settings.excludeTags);
  const params = new Map(snap.parameters.filter((p) => !p.archived).map((p) => [p.id, p]));

  const points: Point[] = [];
  for (const r of snap.readings) {
    const parameter = params.get(r.parameterId);
    const at = Date.parse(r.takenAt);
    if (!parameter || at > now) continue;
    const date = new Date(at);
    const slotId = slotFor(date, slots).id;
    const day = dayKey(date, slots);
    const excluded = r.tags.some((t) => exclude.has(t));
    for (const component of parameter.components) {
      const value = r.values[component.key];
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      points.push({ readingId: r.id, parameter, component, value, at, slotId, day, status: statusOf(value, component), excluded });
    }
  }
  points.sort((a, b) => a.at - b.at || a.readingId.localeCompare(b.readingId));

  const symptoms = new Map(snap.symptoms.filter((s) => !s.archived).map((s) => [s.id, s]));
  const symptomPoints: SymptomPoint[] = [];
  for (const entry of snap.symptomEntries) {
    const symptom = symptoms.get(entry.symptomId);
    const at = Date.parse(entry.takenAt);
    if (!symptom || at > now) continue;
    const date = new Date(at);
    symptomPoints.push({
      entry, symptom, at, slotId: slotFor(date, slots).id, day: dayKey(date, slots), above: entry.score > symptom.threshold,
    });
  }
  symptomPoints.sort((a, b) => a.at - b.at || a.entry.id.localeCompare(b.entry.id));

  const inWindow = (at: number) => at >= windowStart && at <= now;
  return {
    snap, now, slots, current, windowStart, points, symptomPoints,
    windowPoints: points.filter((p) => inWindow(p.at)),
    windowSymptoms: symptomPoints.filter((s) => inWindow(s.at)),
    meds: new Map(snap.medications.map((m) => [m.id, effectiveMed(m, snap)])),
    doses: [...snap.doseEvents].filter((d) => Date.parse(d.takenAt) <= now)
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt) || a.id.localeCompare(b.id)),
  };
}

/** Timing-sensitive medications in the current regimen that act on this parameter kind. */
export function relevantMeds(ctx: Ctx, kind: ParameterKind): MedInfo[] {
  const ids = [...new Set((ctx.current?.items ?? []).map((i) => i.medicationId))].sort();
  return ids
    .map((id) => ctx.meds.get(id))
    .filter((m): m is MedInfo => !!m && !!m.pk?.timingSensitive && m.affects.includes(kind));
}

export function slotName(ctx: Ctx, slotId: ID): string {
  return ctx.slots.find((s) => s.id === slotId)?.name ?? slotId;
}

/** The slot before `slotId` in daily order, wrapping from the first to the last. */
export function previousSlot(ctx: Ctx, slotId: ID): SlotDef {
  const i = ctx.slots.findIndex((s) => s.id === slotId);
  return ctx.slots[(i - 1 + ctx.slots.length) % ctx.slots.length];
}

export function distinctDays(items: { day: string }[]): number {
  return new Set(items.map((i) => i.day)).size;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
