import { WEIGHT_PARAMETER } from './defaults';
import type { ParameterDef, SymptomDef } from './types';

// v1 → v2 (meta/SPEC.md §4): the tracker pivot. Shared by the Dexie upgrade and
// the import of v1 backup files. Never drops data: readings of archived
// parameters stay in the database.

export function upgradeParameters(parameters: ParameterDef[]): ParameterDef[] {
  const next = parameters.map((p) => ({ ...p, archived: p.archived || p.id === 'spo2' || p.id === 'rr' }));
  if (!next.some((p) => p.id === WEIGHT_PARAMETER.id)) {
    const order = WEIGHT_PARAMETER.order;
    for (const p of next) if (p.order >= order) p.order += 1;
    next.push(structuredClone(WEIGHT_PARAMETER));
  }
  return next;
}

export function upgradeSymptoms(symptoms: SymptomDef[]): SymptomDef[] {
  return symptoms.map((s) => (s.type ? s : { ...s, type: 'scale' }));
}
