import { DEFAULT_PARAMETERS, DEFAULT_SLOTS, DEFAULT_SYMPTOMS } from '@/lib/defaults';
import { slotFor } from '@/lib/slots';
import type {
  ContextTag, DoseEvent, DoseStatus, DoseUnit, EngineSnapshot, Medication, ParameterDef, Reading, RegimenItem, RegimenVersion,
  SlotDef, SymptomDef, SymptomEntry,
} from '@/lib/types';

// Data builder for engine tests and the e2e demo backup. Days are numbered from
// 1; times are local 'HH:mm'. Medication ids are readable names ('bisoprolol').

type Item = [medicationId: string, slotId: string, amount: number];

export class Scenario {
  private readonly base: Date;
  private nowIso: string;
  private readonly medications: Medication[] = [];
  private readonly regimens: RegimenVersion[] = [];
  private readonly readings: Reading[] = [];
  private readonly symptomEntries: SymptomEntry[] = [];
  private readonly doseEvents: DoseEvent[] = [];
  private seq = 0;
  readonly parameters: ParameterDef[] = structuredClone(DEFAULT_PARAMETERS);
  readonly symptoms: SymptomDef[] = structuredClone(DEFAULT_SYMPTOMS);

  constructor(firstDay = '2026-09-28') {
    const [y, m, d] = firstDay.split('-').map(Number);
    this.base = new Date(y, m - 1, d);
    this.nowIso = this.iso(1, '00:00');
  }

  iso(day: number, time: string): string {
    const [h, mi] = time.split(':').map(Number);
    const t = new Date(this.base);
    t.setDate(t.getDate() + day - 1);
    t.setHours(h, mi, 0, 0);
    return t.toISOString();
  }

  private id(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  now(day: number, time: string): this {
    this.nowIso = this.iso(day, time);
    return this;
  }

  med(id: string, unit: DoseUnit = 'mg'): this {
    this.medications.push({ id, name: id.charAt(0).toUpperCase() + id.slice(1), unit, archived: false });
    return this;
  }

  regimen(day: number, time: string, items: Item[], note = ''): this {
    const regimenItems: RegimenItem[] = items.map(([medicationId, slotId, amount]) => ({ medicationId, slotId, amount }));
    const at = this.iso(day, time);
    this.regimens.push({ id: `v${this.regimens.length + 1}`, effectiveFrom: at, items: regimenItems, note, createdAt: at });
    return this;
  }

  private regimenAt(iso: string): RegimenVersion | undefined {
    return [...this.regimens].reverse().find((r) => r.effectiveFrom <= iso);
  }

  reading(day: number, time: string, parameterId: string, values: Record<string, number>, tags: ContextTag[] = []): string {
    const id = this.id(`r-${parameterId}`);
    this.readings.push({ id, parameterId, values, takenAt: this.iso(day, time), tags });
    return id;
  }

  bp(day: number, time: string, sys: number, dia: number, tags: ContextTag[] = []): string {
    return this.reading(day, time, 'bp', { sys, dia }, tags);
  }

  hr(day: number, time: string, value: number, tags: ContextTag[] = []): string {
    return this.reading(day, time, 'hr', { value }, tags);
  }

  symptom(day: number, time: string, symptomId: string, score: number, note?: string): string {
    const id = this.id(`s-${symptomId}`);
    this.symptomEntries.push({ id, symptomId, score, takenAt: this.iso(day, time), ...(note ? { note } : {}) });
    return id;
  }

  /** Logs a dose. Planned amount comes from the regimen active at that time. */
  dose(day: number, time: string, medicationId: string, opts: { status?: DoseStatus; amount?: number } = {}): string {
    const takenAt = this.iso(day, time);
    const slotId = slotFor(new Date(takenAt), DEFAULT_SLOTS).id;
    const status = opts.status ?? 'taken';
    const regimen = this.regimenAt(takenAt);
    const planned = regimen?.items.find((i) => i.medicationId === medicationId && i.slotId === slotId)?.amount ?? null;
    const actualAmount = status === 'skipped' ? 0 : (opts.amount ?? planned ?? 0);
    const id = this.id(`d-${medicationId}`);
    this.doseEvents.push({
      id, medicationId, slotId, status, takenAt, actualAmount,
      regimenVersionId: status === 'extra' ? null : (regimen?.id ?? null),
      plannedAmount: status === 'extra' ? null : planned,
    });
    return id;
  }

  /** Logs every regimen item of `slotId` on `day` at `time` as taken. */
  dosesFor(day: number, slotId: string, time: string): this {
    const regimen = this.regimenAt(this.iso(day, time));
    for (const item of regimen?.items ?? []) if (item.slotId === slotId) this.dose(day, time, item.medicationId);
    return this;
  }

  build(): EngineSnapshot {
    return {
      now: this.nowIso,
      parameters: this.parameters,
      symptoms: this.symptoms,
      readings: this.readings,
      symptomEntries: this.symptomEntries,
    };
  }

  /** Every table except settings, as stored in the database. */
  data(): {
    parameters: ParameterDef[]; symptoms: SymptomDef[]; slots: SlotDef[]; medications: Medication[]; regimens: RegimenVersion[];
    readings: Reading[]; symptomEntries: SymptomEntry[]; doseEvents: DoseEvent[];
  } {
    return {
      parameters: this.parameters, symptoms: this.symptoms, slots: structuredClone(DEFAULT_SLOTS), medications: this.medications,
      regimens: [...this.regimens].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
      readings: this.readings, symptomEntries: this.symptomEntries, doseEvents: this.doseEvents,
    };
  }
}

export const scenario = (firstDay?: string) => new Scenario(firstDay);
