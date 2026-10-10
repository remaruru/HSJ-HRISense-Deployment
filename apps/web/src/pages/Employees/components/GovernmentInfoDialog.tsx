import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import {
  filledGovernmentIds, governmentIdProblems, governmentIdsFromEmployee, parseLegacyGovernmentIds, type GovernmentIdRow,
} from "@/lib/employeeContacts";
import { GovernmentIdRowsEditor } from "./GovernmentIdRowsEditor";

/**
 * Edits the four statutory numbers stored on the employee record.
 *
 * Only these four fields are sent, so this dialog can never disturb the rest of
 * the 201 file. Authorization is the API's: `PUT /employees/:id` restricts
 * non-FULL callers to their own record and to a whitelist that does not include
 * any government ID, so a supervisor or an employee cannot change these even if
 * the button were somehow rendered for them.
 */

const FIELDS = [
  { name: "sssNumber", label: "SSS Number", placeholder: "e.g. 34-1234567-8" },
  { name: "philhealthNumber", label: "PhilHealth Number", placeholder: "e.g. 12-345678901-2" },
  { name: "pagibigNumber", label: "Pag-IBIG Number", placeholder: "e.g. 1234-5678-9012" },
  { name: "tinNumber", label: "TIN", placeholder: "e.g. 123-456-789-000" },
] as const;

type FieldName = (typeof FIELDS)[number]["name"];
type FormState = Record<FieldName, string>;

const EMPTY: FormState = {
  sssNumber: "",
  philhealthNumber: "",
  pagibigNumber: "",
  tinNumber: "",
};

/**
 * Deliberately permissive: HSJ records these numbers in several written
 * formats, so this rejects only what cannot be an ID number at all. It never
 * requires a field — a blank value clears it.
 */
function validate(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9][0-9\s-]*$/.test(trimmed)) {
    return `${label} may contain only digits, spaces and dashes.`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) {
    return `${label} should have between 9 and 15 digits.`;
  }
  return null;
}

export function GovernmentInfoDialog({
  isOpen,
  onClose,
  employee,
  onSaveSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  onSaveSuccess: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  // Other government IDs are rows (type + number). Text recorded before that is
  // kept as written until HR copies it into rows.
  const [otherIds, setOtherIds] = useState<GovernmentIdRow[]>([]);
  const [legacyConverted, setLegacyConverted] = useState(false);
  const [otherIdsError, setOtherIdsError] = useState<string | null>(null);
  const legacyText: string = employee?.otherGovernmentIds ?? "";
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && employee) {
      setForm({
        sssNumber: employee.sssNumber ?? "",
        philhealthNumber: employee.philhealthNumber ?? "",
        pagibigNumber: employee.pagibigNumber ?? "",
        tinNumber: employee.tinNumber ?? "",
      });
      setOtherIds(governmentIdsFromEmployee(employee));
      setLegacyConverted(false);
      setOtherIdsError(null);
      setErrors({});
    }
  }, [isOpen, employee]);

  const handleChange = (name: FieldName, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSave = async () => {
    const nextErrors: Partial<FormState> = {};
    for (const field of FIELDS) {
      const message = validate(form[field.name], field.label);
      if (message) nextErrors[field.name] = message;
    }
    const rowProblems = governmentIdProblems(otherIds);
    setOtherIdsError(rowProblems.length ? `${rowProblems.join("; ")}.` : null);
    if (Object.keys(nextErrors).length > 0 || rowProblems.length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Empty means "clear this number", which the API stores as null.
      await api.put(`/employees/${employee.id}`, {
        sssNumber: form.sssNumber.trim() || null,
        philhealthNumber: form.philhealthNumber.trim() || null,
        pagibigNumber: form.pagibigNumber.trim() || null,
        tinNumber: form.tinNumber.trim() || null,
        otherGovernmentIdRows: filledGovernmentIds(otherIds),
        // Only once HR has copied the old text into rows is the text retired.
        ...(legacyConverted ? { clearLegacyOtherGovernmentIds: true } : {}),
      });
      toast.success("Government information updated.");
      onSaveSuccess();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "The government information could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Government Information</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Leave a field blank to remove the number on file.
          </p>

          {FIELDS.map((field) => (
            <div key={field.name} className="space-y-1">
              <label htmlFor={field.name} className="text-xs font-semibold text-foreground">
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                value={form[field.name]}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={!!errors[field.name]}
                aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface text-foreground focus:outline-none focus:ring-1 ${
                  errors[field.name]
                    ? "border-danger focus:ring-danger"
                    : "border-border focus:ring-primary-500"
                }`}
              />
              {errors[field.name] && (
                <p id={`${field.name}-error`} className="text-xs text-danger-dark" role="alert">
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}

          {/* Anything the four numbers above do not cover — as many rows as needed. */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Other Government IDs</p>
            {legacyText && !legacyConverted && (
              <div className="rounded-lg border border-status-accent-border bg-status-accent-surface p-3 text-xs space-y-2">
                <p className="font-semibold text-status-accent-foreground">Recorded as free text before IDs became rows (kept as written):</p>
                <p className="whitespace-pre-line text-foreground">{legacyText}</p>
                <Button type="button" size="xs" variant="outline" onClick={() => { setOtherIds((prev) => [...prev, ...parseLegacyGovernmentIds(legacyText)]); setLegacyConverted(true); }}>
                  Copy into rows
                </Button>
              </div>
            )}
            <GovernmentIdRowsEditor value={otherIds} onChange={(rows) => { setOtherIds(rows); setOtherIdsError(null); }} controlClassName="w-full h-10 px-3 text-sm rounded-lg border border-input bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500" />
            {otherIdsError && <p className="text-xs text-danger-dark" role="alert">{otherIdsError}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
