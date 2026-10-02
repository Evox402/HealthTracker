// Typo guards for Quick Log (meta/SPEC.md §7). Values outside these bounds show
// "Check value" and need a confirmation, but are never blocked.

export const PLAUSIBLE: Record<string, [number, number]> = {
  'bp.sys': [50, 260],
  'bp.dia': [30, 160],
  'hr.value': [25, 250],
  'spo2.value': [50, 100],
  'rr.value': [4, 60],
};

export function isPlausible(parameterId: string, component: string, value: number): boolean {
  const range = PLAUSIBLE[`${parameterId}.${component}`];
  if (!range) return true;
  return value >= range[0] && value <= range[1];
}

/** Digits after which the cursor moves to the next field. */
export function autoAdvanceDigits(parameterId: string, component: string, raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const value = Number(digits);
  const key = `${parameterId}.${component}`;
  if (key === 'spo2.value' || key === 'rr.value') return digits.length >= 2;
  // BP and HR: 3 digits, or 2 digits that can't be the start of a 3-digit value
  // (e.g. "72" or "95" advance; "12" waits for "120").
  return digits.length >= 3 || (digits.length === 2 && value >= 30);
}
