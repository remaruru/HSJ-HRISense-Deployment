import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_EMERGENCY_CONTACTS, emptyContact, type EmergencyContactRow } from "@/lib/employeeContacts";

/**
 * Up to three emergency contacts. The first is required; the others can be
 * added and removed. Used by onboarding (and its drafts) and Edit Profile.
 */
export function EmergencyContactsEditor({
  value,
  onChange,
  disabled,
  controlClassName = "hrisense-control w-full h-[42px] px-3",
  idPrefix = "emergency",
}: {
  value: EmergencyContactRow[];
  onChange: (next: EmergencyContactRow[]) => void;
  disabled?: boolean;
  controlClassName?: string;
  idPrefix?: string;
}) {
  const rows = value.length ? value : [emptyContact()];
  const set = (i: number, key: keyof EmergencyContactRow, v: string) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const atMax = rows.length >= MAX_EMERGENCY_CONTACTS;

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <fieldset key={i} className="rounded-xl border border-border-soft bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <legend className="text-sm font-bold text-foreground">
              Emergency Contact {i + 1}
              {i === 0 && <span className="ml-1 text-status-danger-foreground" aria-hidden="true">*</span>}
              {i === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">Required</span>}
            </legend>
            {i > 0 && !disabled && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="h-8 gap-1 text-status-danger-foreground">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor={`${idPrefix}-${i}-name`} className="mb-1 block text-sm font-medium text-foreground">Contact Person{i === 0 ? " *" : ""}</label>
              <input id={`${idPrefix}-${i}-name`} value={row.contactName} disabled={disabled} onChange={(e) => set(i, "contactName", e.target.value)} className={controlClassName} />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-${i}-rel`} className="mb-1 block text-sm font-medium text-foreground">Relationship{i === 0 ? " *" : ""}</label>
              <input id={`${idPrefix}-${i}-rel`} value={row.relationship} disabled={disabled} onChange={(e) => set(i, "relationship", e.target.value)} className={controlClassName} />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-${i}-phone`} className="mb-1 block text-sm font-medium text-foreground">Mobile Number{i === 0 ? " *" : ""}</label>
              <input id={`${idPrefix}-${i}-phone`} type="tel" inputMode="tel" value={row.mobilePhone} disabled={disabled} onChange={(e) => set(i, "mobilePhone", e.target.value)} className={controlClassName} />
            </div>
          </div>
        </fieldset>
      ))}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atMax}
            onClick={() => onChange([...rows, emptyContact()])}
            className={cn("gap-1.5", atMax && "opacity-60")}
          >
            <Plus className="h-4 w-4" /> Add Emergency Contact
          </Button>
          <span className="text-xs text-muted-foreground">
            {rows.length} of {MAX_EMERGENCY_CONTACTS}{atMax ? " — the maximum" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
