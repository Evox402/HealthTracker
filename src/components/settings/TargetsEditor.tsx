import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, parseNum } from '@/components/ui/field';
import { componentLabel } from '@/engine/text';
import { db } from '@/lib/db';
import type { ParameterDef, SymptomDef } from '@/lib/types';

export interface TargetsEditorProps {
  parameters: ParameterDef[];
  symptoms: SymptomDef[];
  showRedFlags?: boolean;
  saveLabel?: string;
  onSaved?: () => void;
}

type Draft = Record<string, string>;

const key = (...parts: string[]) => parts.join('.');

function initial(parameters: ParameterDef[], symptoms: SymptomDef[]): Draft {
  const d: Draft = {};
  const s = (v: number | undefined) => (v === undefined ? '' : String(v));
  for (const p of parameters) {
    for (const c of p.components) {
      d[key(p.id, c.key, 'min')] = s(c.targetMin);
      d[key(p.id, c.key, 'max')] = s(c.targetMax);
      d[key(p.id, c.key, 'rfMin')] = s(c.redFlagMin);
      d[key(p.id, c.key, 'rfMax')] = s(c.redFlagMax);
    }
  }
  for (const sy of symptoms) {
    d[key('sym', sy.id, 'threshold')] = s(sy.threshold);
    d[key('sym', sy.id, 'rf')] = s(sy.redFlagAt);
  }
  return d;
}

/** Target ranges (and optionally red-flag limits) per parameter, thresholds per symptom. */
export function TargetsEditor({ parameters, symptoms, showRedFlags, saveLabel = 'Save targets', onSaved }: TargetsEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => initial(parameters, symptoms));
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const opt = (k: string) => (Number.isFinite(parseNum(draft[k])) ? parseNum(draft[k]) : undefined);

  async function save() {
    const nextParams = parameters.map((p) => ({
      ...p,
      components: p.components.map((c) => ({
        ...c,
        targetMin: parseNum(draft[key(p.id, c.key, 'min')]),
        targetMax: parseNum(draft[key(p.id, c.key, 'max')]),
        redFlagMin: opt(key(p.id, c.key, 'rfMin')),
        redFlagMax: opt(key(p.id, c.key, 'rfMax')),
      })),
    }));
    for (const p of nextParams) {
      for (const c of p.components) {
        if (!Number.isFinite(c.targetMin) || !Number.isFinite(c.targetMax) || c.targetMin >= c.targetMax) {
          setError(`${componentLabel(p, c)}: enter a minimum below the maximum.`);
          return;
        }
      }
    }
    const nextSymptoms = symptoms.map((s) => {
      const t = parseNum(draft[key('sym', s.id, 'threshold')]);
      return { ...s, threshold: Number.isFinite(t) ? Math.min(10, Math.max(0, Math.round(t))) : s.threshold, redFlagAt: opt(key('sym', s.id, 'rf')) };
    });
    setError(null);
    await db.transaction('rw', db.parameters, db.symptoms, async () => {
      await db.parameters.bulkPut(nextParams);
      await db.symptoms.bulkPut(nextSymptoms);
    });
    onSaved?.();
  }

  return (
    <div className="flex flex-col gap-3">
      {parameters.map((p) => (
        <Card key={p.id}>
          <h3 className="m-0 text-base font-extrabold">
            {p.name} <span className="font-semibold text-[var(--text-muted)]">· {p.unit}</span>
          </h3>
          {p.components.map((c) => (
            <div key={c.key} className="flex flex-col gap-2">
              {p.components.length > 1 && <div className="text-sm font-bold text-[var(--text-secondary)]">{c.label}</div>}
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Target min" inputMode="decimal" value={draft[key(p.id, c.key, 'min')]} onChange={(e) => set(key(p.id, c.key, 'min'), e.target.value)} />
                <Field label="Target max" inputMode="decimal" value={draft[key(p.id, c.key, 'max')]} onChange={(e) => set(key(p.id, c.key, 'max'), e.target.value)} />
                {showRedFlags && (
                  <>
                    <Field label="Red flag at or below" inputMode="decimal" placeholder="none" value={draft[key(p.id, c.key, 'rfMin')]} onChange={(e) => set(key(p.id, c.key, 'rfMin'), e.target.value)} />
                    <Field label="Red flag at or above" inputMode="decimal" placeholder="none" value={draft[key(p.id, c.key, 'rfMax')]} onChange={(e) => set(key(p.id, c.key, 'rfMax'), e.target.value)} />
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
      ))}
      <Card>
        <h3 className="m-0 text-base font-extrabold">Symptoms <span className="font-semibold text-[var(--text-muted)]">· 0–10</span></h3>
        <p className="m-0 text-[13px] text-[var(--text-muted)]">A score above the threshold counts as a symptom worth noting.</p>
        {symptoms.map((s) => (
          <div key={s.id} className="grid grid-cols-[1fr_88px_88px] items-end gap-2.5">
            <span className="pb-3 text-[15px] font-bold">{s.name}</span>
            <Field label="Threshold" inputMode="numeric" value={draft[key('sym', s.id, 'threshold')]} onChange={(e) => set(key('sym', s.id, 'threshold'), e.target.value)} />
            {showRedFlags ? (
              <Field label="Red flag" inputMode="numeric" placeholder="none" value={draft[key('sym', s.id, 'rf')]} onChange={(e) => set(key('sym', s.id, 'rf'), e.target.value)} />
            ) : <span />}
          </div>
        ))}
      </Card>
      {error && <p role="alert" className="m-0 font-bold text-[var(--warn)]">{error}</p>}
      <Button size="lg" onClick={save}>{saveLabel}</Button>
    </div>
  );
}
