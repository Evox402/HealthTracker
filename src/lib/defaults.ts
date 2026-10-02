import type { ParameterDef, SlotDef, SymptomDef } from './types';

// Defaults from meta/SPEC.md §4. Generic starting points only: onboarding asks
// the user to replace the ranges with the targets set by their care team.

export const DEFAULT_PARAMETERS: ParameterDef[] = [
  {
    id: 'bp', kind: 'bp', name: 'Blood pressure', unit: 'mmHg', decimals: 0, order: 0, archived: false,
    components: [
      { key: 'sys', label: 'Systolic', targetMin: 100, targetMax: 130, redFlagMin: 90, redFlagMax: 180 },
      { key: 'dia', label: 'Diastolic', targetMin: 60, targetMax: 80, redFlagMax: 110 },
    ],
  },
  {
    id: 'hr', kind: 'hr', name: 'Heart rate', unit: 'bpm', decimals: 0, order: 1, archived: false,
    components: [{ key: 'value', label: 'Heart rate', targetMin: 60, targetMax: 90, redFlagMin: 45, redFlagMax: 130 }],
  },
  {
    id: 'spo2', kind: 'spo2', name: 'SpO₂', unit: '%', decimals: 0, order: 2, archived: false,
    components: [{ key: 'value', label: 'SpO₂', targetMin: 94, targetMax: 100, redFlagMin: 90 }],
  },
  {
    id: 'rr', kind: 'rr', name: 'Respiratory rate', unit: '/min', decimals: 0, order: 3, archived: false,
    components: [{ key: 'value', label: 'Respiratory rate', targetMin: 12, targetMax: 20, redFlagMin: 8, redFlagMax: 25 }],
  },
];

export const DEFAULT_SYMPTOMS: SymptomDef[] = [
  { id: 'chest_pain', name: 'Chest pain', threshold: 2, redFlagAt: 7, order: 0, archived: false },
  { id: 'nausea', name: 'Nausea', threshold: 3, order: 1, archived: false },
  { id: 'exhaustion', name: 'Exhaustion', threshold: 4, order: 2, archived: false },
  { id: 'sluggishness', name: 'Sluggishness', threshold: 4, order: 3, archived: false },
  { id: 'back_pain', name: 'Back pain', threshold: 3, order: 4, archived: false },
];

export const DEFAULT_SLOTS: SlotDef[] = [
  { id: 'morning', name: 'Morning', startHour: 5, defaultTime: '08:00', order: 0 },
  { id: 'noon', name: 'Noon', startHour: 11, defaultTime: '12:00', order: 1 },
  { id: 'evening', name: 'Evening', startHour: 17, defaultTime: '18:00', order: 2 },
  { id: 'night', name: 'Night', startHour: 21, defaultTime: '22:00', order: 3 },
];
