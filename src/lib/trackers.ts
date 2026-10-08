import type { ParameterDef, SymptomDef, SymptomEntry, SymptomType } from './types';

// One list over both kinds of tracker: numeric ones (ParameterDef: vitals and
// "number with unit") and score/event ones (SymptomDef: scale, stool, event).

export type Tracker =
  | { kind: 'p'; id: string; name: string; def: ParameterDef }
  | { kind: 's'; id: string; name: string; def: SymptomDef };

export const trackerPath = (t: Pick<Tracker, 'kind' | 'id'>) => `${t.kind}/${encodeURIComponent(t.id)}`;

export function allTrackers(parameters: ParameterDef[], symptoms: SymptomDef[], includeArchived = false): Tracker[] {
  return [
    ...parameters.filter((p) => includeArchived || !p.archived).map((def) => ({ kind: 'p' as const, id: def.id, name: def.name, def })),
    ...symptoms.filter((s) => includeArchived || !s.archived).map((def) => ({ kind: 's' as const, id: def.id, name: def.name, def })),
  ];
}

export function findTracker(trackers: Tracker[], kind: string | undefined, id: string | undefined): Tracker | undefined {
  return trackers.find((t) => t.kind === kind && t.id === id);
}

export const SYMPTOM_TYPE_LABEL: Record<SymptomType, string> = {
  scale: 'Scale 0–10',
  stool: 'Stool (Bristol)',
  event: 'Yes/No + note',
};

/** Bristol stool scale, short wording for buttons and charts. */
export const BRISTOL: { type: number; label: string; hint: string }[] = [
  { type: 1, label: 'Hard lumps', hint: 'Separate hard lumps' },
  { type: 2, label: 'Lumpy', hint: 'Sausage-shaped, lumpy' },
  { type: 3, label: 'Cracked', hint: 'Sausage with cracks' },
  { type: 4, label: 'Smooth', hint: 'Smooth, soft sausage' },
  { type: 5, label: 'Soft blobs', hint: 'Soft blobs, clear edges' },
  { type: 6, label: 'Mushy', hint: 'Fluffy, mushy pieces' },
  { type: 7, label: 'Liquid', hint: 'Watery, no solid pieces' },
];

export const bristolLabel = (type: number) => BRISTOL.find((b) => b.type === type)?.label ?? '';

/** "5/10", "Type 4 · Smooth", "Logged". */
export function fmtSymptom(def: SymptomDef, e: SymptomEntry): string {
  if (def.type === 'stool') return `Type ${e.score} · ${bristolLabel(e.score)}`;
  if (def.type === 'event') return 'Logged';
  return `${e.score}/10`;
}

/** Big tile value: "5", "4", "✓". */
export function fmtSymptomShort(def: SymptomDef, e: SymptomEntry): string {
  if (def.type === 'event') return '✓';
  return String(e.score);
}
