import type { Direction, ParameterComponent, ParameterDef, ParameterKind } from '@/lib/types';

// All user-facing engine wording (CLAUDE.md "Medical safety").
// Explanations state facts with numbers. Discussion points describe OPTIONS TO
// DISCUSS with the care team and never contain dose amounts or instructions.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtDay = (t: number) => {
  const d = new Date(t);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const fmtWeekday = (t: number) => WEEKDAYS[new Date(t).getDay()];
export const fmtTime = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const fmtNum = (v: number, decimals = 0) => String(Number(v.toFixed(decimals)));
export const fmtHours = (h: number) => `${fmtNum(h, h < 10 ? 1 : 0)} h`;
export const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((100 * n) / d));
export const fmtDuration = (days: number) =>
  days >= 14 ? `${Math.round(days / 7)} weeks` : days === 1 ? '1 day' : `${fmtNum(days)} days`;
/** "in the Morning", "at Noon", "at Night". */
export const inSlot = (slot: string) => (/^(noon|night|midnight)$/i.test(slot) ? `at ${slot}` : `in the ${slot}`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Systolic BP", "Heart rate". */
export function componentLabel(p: ParameterDef, c: ParameterComponent): string {
  if (p.components.length === 1) return c.label;
  return `${c.label} ${p.kind === 'bp' ? 'BP' : lower(p.name)}`;
}
const labelLower = (p: ParameterDef, c: ParameterComponent) => (p.kind === 'bp' ? lower(c.label) + ' BP' : lower(componentLabel(p, c)));
const lowering = (kind: ParameterKind) => (kind === 'bp' ? 'BP-lowering' : kind === 'hr' ? 'heart-rate-lowering' : 'relevant');
const bound = (c: ParameterComponent, dir: Direction) => (dir === 'above' ? c.targetMax : c.targetMin);

export interface Wording {
  title: string;
  explanation: string;
  discussionPoint: string;
}

interface PatternFacts {
  p: ParameterDef;
  c: ParameterComponent;
  slot: string;
  dir: Direction;
  nOut: number;
  nTotal: number;
  meanOut: number;
}

function patternFact(f: PatternFacts): string {
  return `${f.nOut} of ${f.nTotal} ${f.slot.toLowerCase()} readings (${pct(f.nOut, f.nTotal)} %) were ${f.dir} ` +
    `${bound(f.c, f.dir)} ${f.p.unit} (mean ${fmtNum(f.meanOut, f.p.decimals)}).`;
}

// R0
export function redFlagReading(p: ParameterDef, c: ParameterComponent, value: number, dir: Direction, limit: number) {
  const v = `${fmtNum(value, p.decimals)} ${p.unit}`;
  return {
    title: `${componentLabel(p, c)} ${v}`,
    message: `${v} is ${dir === 'below' ? 'at or below' : 'at or above'} the red-flag limit of ${limit} ${p.unit}. Contact your care team now.`,
  };
}

export function redFlagSymptom(name: string, score: number, limit: number) {
  return {
    title: `${name} ${score}/10`,
    message: `${name} at ${score}/10 reaches the red-flag level of ${limit}. Contact your care team now.`,
  };
}

// R1
export function slotOutOfRange(f: PatternFacts, preOnset?: { med: string; onsetH: number }): Wording {
  const note = preOnset
    ? ` At most of these readings the last ${preOnset.med} dose had been taken less than ${fmtHours(preOnset.onsetH)} earlier and had likely not reached its effect yet.`
    : '';
  const discussionPoint = f.dir === 'above'
    ? `${f.slot} ${labelLower(f.p, f.c)} is consistently high. Worth asking whether the current medication timing covers the ${f.slot.toLowerCase()} hours well.`
    : `${f.slot} ${labelLower(f.p, f.c)} is consistently low. Worth asking whether the combined medication effect ${inSlot(f.slot).toLowerCase()} is stronger than intended.`;
  return {
    title: `${componentLabel(f.p, f.c)} ${f.dir} range ${inSlot(f.slot)}`,
    explanation: patternFact(f) + note,
    discussionPoint,
  };
}

// R2
export function endOfDose(f: PatternFacts, med: string, avgHours: number, durationH: number, activeIn: number, activeTotal: number): Wording {
  return {
    title: `${componentLabel(f.p, f.c)} above range ${inSlot(f.slot)}: ${med} may be wearing off`,
    explanation: `${patternFact(f)} These readings were taken on average ${fmtHours(avgHours)} after the last ${med} dose, ` +
      `beyond its approx. ${fmtHours(durationH)} duration. Readings within ${fmtHours(durationH)} of a dose were in range in ${activeIn} of ${activeTotal} cases.`,
    discussionPoint: `The pattern fits the effect of ${med} wearing off before the next dose. Options to discuss: an earlier dose, ` +
      'splitting the daily amount into more doses, or a longer-acting formulation.',
  };
}

// R3
export function uncoveredSlot(
  f: PatternFacts, med: string, avgHours: number, durationH: number, lastSlot: string, suggestSlot: string | null,
): Wording {
  const option = suggestSlot
    ? `a dose ${inSlot(suggestSlot)} (for example by splitting the ${lastSlot} dose)`
    : `an additional dose ${inSlot(f.slot)}`;
  return {
    title: `${componentLabel(f.p, f.c)} above range ${inSlot(f.slot)}: no medication covers this time`,
    explanation: `${patternFact(f)} They were taken on average ${fmtHours(avgHours)} after the last ${med} dose (${lastSlot}), ` +
      `longer than its approx. ${fmtHours(durationH)} effect, and no ${lowering(f.p.kind)} medication is scheduled ${inSlot(f.slot)}` +
      `${suggestSlot ? ` or ${inSlot(suggestSlot)}` : ''}.`,
    discussionPoint: `${f.slot} coverage may be insufficient. Options to discuss: ${option}, or a longer-acting drug.`,
  };
}

// R4
export function peakLow(
  p: ParameterDef, c: ParameterComponent, med: string, nPeak: number, nBelow: number, peakH: number,
  symptom: { name: string; count: number } | null,
): Wording {
  return {
    title: `Low ${labelLower(p, c)} around the peak effect of ${med}`,
    explanation: `${nPeak} of ${nBelow} readings below ${c.targetMin} ${p.unit} were taken around the expected peak of ${med} ` +
      `(approx. ${fmtHours(peakH)} after a dose).` +
      (symptom ? ` ${symptom.name} was above its threshold ${plural(symptom.count, 'time')} in the same period.` : ''),
    discussionPoint: `Lows cluster around the expected peak of ${med}. Options to discuss: splitting the dose into smaller, more frequent doses, ` +
      'or separating it in time from other BP- or heart-rate-lowering drugs taken in the same slot.',
  };
}

// R6
export function symptomLink(name: string, threshold: number, n: number, linked: number, what: string): Wording {
  return {
    title: `${name} often coincides with ${what}`,
    explanation: `${name} was above ${threshold} on ${plural(n, 'occasion')}; ${linked} of them coincided with ${what}.`,
    discussionPoint: `Mention the ${name.toLowerCase()} to the care team together with the readings at those times.`,
  };
}

export function chestPain(name: string, threshold: number, n: number, days: number): Wording {
  return {
    title: `${name} above threshold ${plural(n, 'time')}`,
    explanation: `${name} was above ${threshold} on ${plural(n, 'occasion')} in the last ${fmtDuration(days)}.`,
    discussionPoint: `Mention the ${name.toLowerCase()} episodes to the care team.`,
  };
}

/** Appended when the other component of the same parameter shows the same pattern. */
export function alsoComponent(label: string, dir: Direction, nOut: number, nTotal: number): string {
  return ` ${label} was also ${dir} range in ${nOut} of ${nTotal} readings.`;
}

// R7
export function missedDose(
  med: string, slot: string, at: number, reduced: boolean, p: ParameterDef, c: ParameterComponent,
  readings: { at: number; value: number; dir: Direction }[],
): Wording {
  const what = reduced ? 'taken at a lower amount' : 'skipped';
  const list = readings.map((r) => `${fmtNum(r.value, p.decimals)} ${p.unit} at ${fmtTime(r.at)}`).join(', ');
  return {
    title: `${med} ${slot.toLowerCase()} dose ${reduced ? 'reduced' : 'skipped'} on ${fmtWeekday(at)}`,
    explanation: `The ${slot.toLowerCase()} ${med} dose on ${fmtDay(at)} was ${what}. Afterwards ${labelLower(p, c)} was ` +
      `${readings[0].dir} range: ${list}.`,
    discussionPoint: `These readings are likely explained by the ${reduced ? 'reduced' : 'skipped'} dose and are left out of the other patterns. ` +
      'Mention it if doses are missed regularly.',
  };
}

// R5
export function changeLabel(med: string, from: number | null, to: number | null, unit: string, slot: string): string {
  if (from === null) return `${med} added, ${slot}`;
  if (to === null) return `${med} stopped, ${slot}`;
  return `${med} ${fmtNum(from, 2)} → ${fmtNum(to, 2)} ${unit}, ${slot}`;
}

export function changeTooEarly(daysAgo: number, slowest: string, steadyDays: number): string {
  return `Changed ${daysAgo === 0 ? 'today' : `${fmtDuration(daysAgo)} ago`}; ${slowest} needs about ${fmtDuration(steadyDays)} ` +
    'before its effect can be judged.';
}

export function changeInsufficient(): string {
  return 'Not enough readings before and after this change to compare yet.';
}

export function changeEvaluated(at: number, diff: string, parts: string[], unchangedRest: boolean): string {
  const body = parts.length > 0 ? parts.join('; ') : 'no clear difference in any slot';
  return `Since ${fmtDay(at)} (${diff}): ${body}${parts.length > 0 && unchangedRest ? '; other slots unchanged' : ''}.`;
}

export function changePart(slot: string, label: string, before: number, after: number, verdict: string): string {
  return verdict === 'unchanged'
    ? `${slot.toLowerCase()} ${label} unchanged`
    : `${slot.toLowerCase()} ${label} in range ${before} % → ${after} %`;
}

export { labelLower };
