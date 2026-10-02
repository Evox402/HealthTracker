import { DRUG_LIBRARY } from '@/engine/drugLibrary';
import { cn } from '@/lib/cn';
import { fmtAmount } from '@/lib/format';
import type { Medication, RegimenVersion, SlotDef } from '@/lib/types';

export interface RegimenTableProps {
  regimen: RegimenVersion;
  medications: Medication[];
  slots: SlotDef[];
  print?: boolean;
}

const CLASS_LABEL: Record<string, string> = {
  beta_blocker: 'beta blocker', ace_inhibitor: 'ACE inhibitor', arb: 'ARB', antiarrhythmic: 'antiarrhythmic',
  rate_control_ccb: 'rate control', dhp_ccb: 'calcium channel blocker', diuretic: 'diuretic', if_inhibitor: 'If inhibitor',
  cardiac_glycoside: 'cardiac glycoside', other: '',
};

export function drugClassLabel(m: Medication): string {
  const lib = DRUG_LIBRARY.find((d) => d.id === m.libraryId);
  return lib ? CLASS_LABEL[lib.class] : 'custom';
}

/** Medication × slot grid of one regimen version. */
export function RegimenTable({ regimen, medications, slots, print }: RegimenTableProps) {
  const medIds = [...new Set(regimen.items.map((i) => i.medicationId))];
  return (
    <table className={cn('num w-full border-collapse text-sm', print && 'text-[12px]')}>
      <thead>
        <tr className={cn('text-left text-xs', print ? 'bg-[#f1f5f9] text-[#0f172a]' : 'text-[var(--text-muted)]')}>
          <th className="py-2 pr-2 font-extrabold">Medication</th>
          {slots.map((s) => <th key={s.id} className="px-1 py-2 font-extrabold">{s.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {medIds.map((id) => {
          const m = medications.find((x) => x.id === id);
          return (
            <tr key={id} className={cn('border-t', print ? 'border-[#cbd5e1]' : 'border-[var(--border)]')}>
              <td className="py-3 pr-2">
                <span className="block font-extrabold">{m?.name ?? 'Unknown'}</span>
                {m && !print && <span className="block text-xs text-[var(--text-muted)]">{drugClassLabel(m)}</span>}
              </td>
              {slots.map((s) => {
                const item = regimen.items.find((i) => i.medicationId === id && i.slotId === s.id);
                return (
                  <td key={s.id} className={cn('px-1 py-3', item ? 'font-bold' : print ? 'text-[#94a3b8]' : 'text-[var(--text-muted)]')}>
                    {item ? `${fmtAmount(item.amount)} ${m?.unit ?? ''}` : '–'}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
