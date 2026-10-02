import type { DrugLibraryEntry } from '@/lib/types';

// Approximate PK/PD values for PATTERN REASONING ONLY (meta/SPEC.md §5.6).
// Shown in the UI as "approx. — verify with your pharmacist".
// For drugs with timingSensitive: false, onset/peak/duration are 0 and ignored:
// intraday timing does not matter for them, only the build-up over days.

export const DRUG_LIBRARY: DrugLibraryEntry[] = [
  // Beta blockers
  { id: 'metoprolol_tartrate', name: 'Metoprolol tartrate (IR)', class: 'beta_blocker', affects: ['hr', 'bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 1.5, durationH: 12, halfLifeH: 3.5, timingSensitive: true, steadyStateDays: 1,
    notes: 'Immediate release, usually taken twice daily.' },
  { id: 'metoprolol_succinate', name: 'Metoprolol succinate (ER)', class: 'beta_blocker', affects: ['hr', 'bp'], typicalUnit: 'mg',
    onsetH: 2, peakH: 7, durationH: 24, halfLifeH: 5, timingSensitive: true, steadyStateDays: 2,
    notes: 'Extended release, usually once daily.' },
  { id: 'bisoprolol', name: 'Bisoprolol', class: 'beta_blocker', affects: ['hr', 'bp'], typicalUnit: 'mg',
    onsetH: 2, peakH: 3, durationH: 24, halfLifeH: 11, timingSensitive: true, steadyStateDays: 3,
    notes: 'Once daily.' },
  { id: 'carvedilol', name: 'Carvedilol', class: 'beta_blocker', affects: ['hr', 'bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 1.5, durationH: 12, halfLifeH: 8, timingSensitive: true, steadyStateDays: 2,
    notes: 'Usually twice daily, with food.' },
  { id: 'nebivolol', name: 'Nebivolol', class: 'beta_blocker', affects: ['hr', 'bp'], typicalUnit: 'mg',
    onsetH: 1.5, peakH: 3, durationH: 24, halfLifeH: 12, timingSensitive: true, steadyStateDays: 3,
    notes: 'Once daily.' },

  // ACE inhibitors
  { id: 'ramipril', name: 'Ramipril', class: 'ace_inhibitor', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 1.5, peakH: 4.5, durationH: 24, halfLifeH: 13, timingSensitive: true, steadyStateDays: 3,
    notes: 'Once or twice daily.' },
  { id: 'lisinopril', name: 'Lisinopril', class: 'ace_inhibitor', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 6.5, durationH: 24, halfLifeH: 12, timingSensitive: true, steadyStateDays: 3,
    notes: 'Once daily.' },
  { id: 'enalapril', name: 'Enalapril', class: 'ace_inhibitor', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 5, durationH: 18, halfLifeH: 11, timingSensitive: true, steadyStateDays: 3,
    notes: 'Once or twice daily.' },

  // Angiotensin receptor blockers
  { id: 'candesartan', name: 'Candesartan', class: 'arb', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 2, peakH: 7, durationH: 24, halfLifeH: 9, timingSensitive: true, steadyStateDays: 3,
    notes: 'Once daily.' },
  { id: 'valsartan', name: 'Valsartan', class: 'arb', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 2, peakH: 5, durationH: 24, halfLifeH: 6, timingSensitive: true, steadyStateDays: 2,
    notes: 'Once or twice daily.' },
  { id: 'losartan', name: 'Losartan', class: 'arb', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 6, durationH: 24, halfLifeH: 7, timingSensitive: true, steadyStateDays: 3,
    notes: 'Once daily; active metabolite is longer-acting than the parent drug.' },

  // Heart-rate control
  { id: 'ivabradine', name: 'Ivabradine', class: 'if_inhibitor', affects: ['hr'], typicalUnit: 'mg',
    onsetH: 1, peakH: 1, durationH: 12, halfLifeH: 11, timingSensitive: true, steadyStateDays: 2,
    notes: 'Twice daily with meals; half-life is the effective value.' },
  { id: 'diltiazem_ir', name: 'Diltiazem (IR)', class: 'rate_control_ccb', affects: ['hr', 'bp'], typicalUnit: 'mg',
    onsetH: 0.5, peakH: 3, durationH: 7, halfLifeH: 4, timingSensitive: true, steadyStateDays: 1,
    notes: 'Immediate release, usually three to four times daily.' },
  { id: 'verapamil_ir', name: 'Verapamil (IR)', class: 'rate_control_ccb', affects: ['hr', 'bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 2, durationH: 7, halfLifeH: 6, timingSensitive: true, steadyStateDays: 2,
    notes: 'Immediate release, usually three times daily.' },
  { id: 'amiodarone', name: 'Amiodarone', class: 'antiarrhythmic', affects: ['hr'], typicalUnit: 'mg',
    onsetH: 0, peakH: 0, durationH: 0, halfLifeH: 1200, timingSensitive: false, steadyStateDays: 21,
    notes: 'Builds up over weeks (half-life around 50 days); time of day does not matter.' },
  { id: 'digoxin', name: 'Digoxin', class: 'cardiac_glycoside', affects: ['hr'], typicalUnit: 'mg',
    onsetH: 0, peakH: 0, durationH: 0, halfLifeH: 40, timingSensitive: false, steadyStateDays: 7,
    notes: 'Builds up over about a week; time of day does not matter.' },

  // Other BP drugs
  { id: 'amlodipine', name: 'Amlodipine', class: 'dhp_ccb', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 0, peakH: 0, durationH: 0, halfLifeH: 40, timingSensitive: false, steadyStateDays: 8,
    notes: 'Very long-acting; time of day does not matter.' },
  { id: 'furosemide', name: 'Furosemide', class: 'diuretic', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 1.5, durationH: 6, halfLifeH: 1.5, timingSensitive: true, steadyStateDays: 1,
    notes: 'Short-acting diuretic, usually taken in the morning.' },
  { id: 'torasemide', name: 'Torasemide', class: 'diuretic', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 1, peakH: 2, durationH: 12, halfLifeH: 3.5, timingSensitive: true, steadyStateDays: 1,
    notes: 'Diuretic, usually taken in the morning.' },
  { id: 'spironolactone', name: 'Spironolactone', class: 'diuretic', affects: ['bp'], typicalUnit: 'mg',
    onsetH: 0, peakH: 0, durationH: 0, halfLifeH: 20, timingSensitive: false, steadyStateDays: 7,
    notes: 'Effect builds over days (active metabolites).' },
];
