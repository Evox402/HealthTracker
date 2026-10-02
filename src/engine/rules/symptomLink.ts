import { confidenceFor, scoreOf } from '../confidence';
import { coverageAt } from '../coverage';
import { PRIORITY, latest, readingEvidence, symptomEvidence, type Draft } from '../draft';
import { distinctDays, type Ctx, type MedInfo, type Point, type SymptomPoint } from '../preprocess';
import { chestPain, labelLower, symptomLink as wording } from '../text';
import { MAJORITY, MIN_OUT } from './slotOutOfRange';

// R6 (meta/SPEC.md §5.4): a symptom above its threshold repeatedly coincides with
// out-of-range readings in the same slot, or with a medication's peak effect.
// Chest pain is never "explained": it only gets a neutral insight.

const isChestPain = (s: SymptomPoint) => s.symptom.id === 'chest_pain' || /chest/i.test(s.symptom.name);

function mostCommon<T>(items: T[], key: (t: T) => string): { item: T; count: number } | null {
  const counts = new Map<string, { item: T; count: number }>();
  for (const it of items) {
    const k = key(it);
    const c = counts.get(k) ?? { item: it, count: 0 };
    c.count += 1;
    counts.set(k, c);
  }
  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0]?.[1] ?? null;
}

export function symptomLink(ctx: Ctx, points: Point[], usedSymptoms: Set<string>): Draft[] {
  const bySymptom = new Map<string, SymptomPoint[]>();
  for (const s of ctx.windowSymptoms) {
    if (!s.above || usedSymptoms.has(s.entry.id)) continue;
    bySymptom.set(s.symptom.id, [...(bySymptom.get(s.symptom.id) ?? []), s]);
  }
  const meds = [...new Map(
    (ctx.current?.items ?? []).map((i) => [i.medicationId, ctx.meds.get(i.medicationId)] as const),
  ).values()].filter((m): m is MedInfo => !!m?.pk?.timingSensitive);
  const outOfRange = points.filter((p) => p.status !== 'in');

  const drafts: Draft[] = [];
  for (const [symptomId, entries] of bySymptom) {
    if (entries.length < MIN_OUT) continue;
    const s0 = entries[0];
    const confidence = confidenceFor(entries.length, distinctDays(entries));
    const common = {
      type: 'symptom_link' as const, priority: PRIORITY.symptom_link, confidence, latestAt: latest(entries),
      key: `symptom_link:${symptomId}`, base: `symptom_link:${symptomId}`,
    };

    if (isChestPain(s0)) {
      const days = Math.max(1, Math.round((ctx.now - ctx.windowStart) / 86_400_000));
      drafts.push({ ...common, ...chestPain(s0.symptom.name, s0.symptom.threshold, entries.length, days),
        evidence: symptomEvidence(entries), score: scoreOf(confidence, 2) });
      continue;
    }

    // Link each entry to an out-of-range reading in the same slot and day, else to a medication peak.
    const readingLinks = entries.flatMap((s) => outOfRange
      .filter((p) => p.day === s.day && p.slotId === s.slotId)
      .map((p) => ({ s, p })));
    const peakLinks = entries.flatMap((s) => meds
      .filter((m) => coverageAt(s.at, m.med.id, m.pk!, ctx.doses).state === 'peak')
      .map((m) => ({ s, m })));
    const linked = new Set([...readingLinks.map((l) => l.s.entry.id), ...peakLinks.map((l) => l.s.entry.id)]);
    if (linked.size / entries.length < MAJORITY) continue;

    const topReading = mostCommon(readingLinks, (l) => `${l.p.parameter.id}:${l.p.component.key}:${l.p.status}`);
    const topPeak = mostCommon(peakLinks, (l) => l.m.med.id);
    const what = topReading && (!topPeak || topReading.count >= topPeak.count)
      ? `${labelLower(topReading.item.p.parameter, topReading.item.p.component)} ${topReading.item.p.status} range`
      : `the expected peak of ${topPeak!.item.m.name}`;
    const linkedReadings = readingLinks.map((l) => l.p);
    drafts.push({
      ...common,
      ...wording(s0.symptom.name, s0.symptom.threshold, entries.length, linked.size, what),
      evidence: [...symptomEvidence(entries), ...readingEvidence(linkedReadings)],
      score: scoreOf(confidence, 1),
    });
  }
  return drafts;
}
