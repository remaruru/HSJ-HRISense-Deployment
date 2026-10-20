import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadProtectedFile } from "@/lib/downloadProtectedFile";
import { getApiErrorMessage } from "@/utils/error-handler.util";

/**
 * Downloads an employee's profile as a PDF (photo, 201 record, compliance status,
 * training history). HR can export anyone; everyone else only themselves — the
 * API enforces that and records each export in the audit log.
 *
 * It sits in the page header, outside the profile card, styled like the
 * Employee Directory's "Export Reports" button.
 */
export function ExportProfileButton({
  employee,
}: {
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
}) {
  const [busy, setBusy] = useState(false);
  const fileName = `HRISense_Profile_${`${employee.firstName} ${employee.lastName}`.trim().replace(/[^A-Za-z0-9]+/g, "_")}_${employee.employeeNumber}.pdf`;

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-[42px] px-4 text-[14px] font-medium"
      disabled={busy}
      leftIcon={busy ? <Loader2 className="animate-spin" /> : <Download />}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadProtectedFile(`/employees/${employee.id}/export/pdf`, fileName);
          toast.success("Profile PDF downloaded.");
        } catch (err) {
          toast.error(getApiErrorMessage(err, "The profile could not be exported."));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Preparing…" : "Export PDF"}
    </Button>
  );
}
