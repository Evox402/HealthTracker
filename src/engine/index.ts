import type { EngineResult, EngineSnapshot } from '@/lib/types';
import { redFlags } from './redFlags';

// Engine (meta/SPEC.md §5): red flags only. Pure and deterministic: no I/O, no
// clock, no randomness. `snapshot.now` is the only notion of time.

export function runEngine(snapshot: EngineSnapshot): EngineResult {
  return { redFlags: redFlags(snapshot) };
}
