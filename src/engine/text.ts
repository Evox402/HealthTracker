import type { Direction, ParameterComponent, ParameterDef } from '@/lib/types';

// All user-facing engine wording (CLAUDE.md "Medical safety"). Red flags state
// the value and the limit, and point to the care team. Never dose amounts or
// instructions to change medication.

export const fmtNum = (v: number, decimals = 0) => String(Number(v.toFixed(decimals)));
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Systolic BP", "Heart rate". */
export function componentLabel(p: ParameterDef, c: ParameterComponent): string {
  if (p.components.length === 1) return c.label;
  return `${c.label} ${p.kind === 'bp' ? 'BP' : lower(p.name)}`;
}

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
