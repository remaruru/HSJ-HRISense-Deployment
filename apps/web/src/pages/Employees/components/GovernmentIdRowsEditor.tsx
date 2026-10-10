import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emptyGovernmentId, type GovernmentIdRow } from "@/lib/employeeContacts";

/**
 * Other government IDs as rows — ID type and ID number, as many as needed. The
 * type is free text (Passport, UMID, PhilSys, ...): there is no fixed list.
 */
export function GovernmentIdRowsEditor({
  value,
  onChange,
  disabled,
  controlClassName = "hrisense-control w-full h-[42px] px-3",
  idPrefix = "govid",
}: {
  value: GovernmentIdRow[];
  onChange: (next: GovernmentIdRow[]) => void;
  disabled?: boolean;
  controlClassName?: string;
  idPrefix?: string;
}) {
  const set = (i: number, key: keyof GovernmentIdRow, v: string) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">No other government IDs recorded.</p>
      )}
      {value.length > 0 && (
        <div className="hidden grid-cols-[1fr_1fr_auto] gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <span>ID Type</span>
          <span>ID Number</span>
          <span className="w-[88px]" />
        </div>
      )}
      {value.map((row, i) => (
        <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-border-soft p-3 md:grid-cols-[1fr_1fr_auto] md:border-0 md:p-0">
          <div>
            <label htmlFor={`${idPrefix}-${i}-type`} className="mb-1 block text-xs font-medium text-foreground md:sr-only">ID Type</label>
            <input id={`${idPrefix}-${i}-type`} value={row.idType} disabled={disabled} onChange={(e) => set(i, "idType", e.target.value)} placeholder="e.g. Passport" className={controlClassName} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-${i}-number`} className="mb-1 block text-xs font-medium text-foreground md:sr-only">ID Number</label>
            <input id={`${idPrefix}-${i}-number`} value={row.idNumber} disabled={disabled} onChange={(e) => set(i, "idNumber", e.target.value)} className={controlClassName} />
          </div>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="h-[42px] gap-1 text-status-danger-foreground md:w-[88px]">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, emptyGovernmentId()])} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Government ID
        </Button>
      )}
    </div>
  );
}
