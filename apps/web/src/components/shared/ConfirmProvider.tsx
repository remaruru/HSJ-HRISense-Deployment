import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Deleting, archiving, discarding: a red button and a warning icon. */
  danger?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let open: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Asks the person to confirm in a themed window instead of the browser's own
 * pop-up. Resolves true when they confirm, false when they cancel or close it.
 * Usable from any event handler: `if (!(await confirmAction({...}))) return;`
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!open) return Promise.resolve(false);
  return open(options);
}

/** Renders the one confirmation window the whole app shares. Mount once, near the root. */
export function ConfirmProvider() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    open = (options) =>
      new Promise<boolean>((resolve) =>
        setPending((previous) => {
          previous?.resolve(false); // a newer question replaces an unanswered one
          return { ...options, resolve };
        })
      );
    return () => {
      open = null;
    };
  }, []);

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const Icon = pending?.danger ? AlertTriangle : HelpCircle;

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && answer(false)}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="items-center text-center sm:items-start sm:text-left">
          <span
            className={cn(
              "mb-1 flex h-11 w-11 items-center justify-center rounded-full border",
              pending?.danger
                ? "border-status-danger-border bg-status-danger-surface text-status-danger-foreground"
                : "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-900/40 dark:text-primary-200"
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <DialogTitle className="pr-6">{pending?.title}</DialogTitle>
          {pending?.message && <DialogDescription className="whitespace-pre-line">{pending.message}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          {/* Enter never deletes by accident: a dangerous question starts on Cancel. */}
          <Button variant="outline" onClick={() => answer(false)} autoFocus={!!pending?.danger}>{pending?.cancelLabel ?? "Cancel"}</Button>
          <Button variant={pending?.danger ? "delete" : "primary"} onClick={() => answer(true)} autoFocus={!pending?.danger}>
            {pending?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
