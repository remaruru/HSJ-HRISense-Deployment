import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useAuth } from '@/providers/AuthProvider';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from 'sonner';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Key,
  Lock,
  Mail,
  RefreshCcw,
  Unlock,
} from 'lucide-react';

/**
 * HR Account Management.
 *
 * Every control here calls a real endpoint under `/employees/:id/account/*`.
 * Actions that cannot be performed are not offered:
 *  • HRISense never stores plaintext passwords, so there is no "resend the same
 *    password" action. The honest equivalent is "Reset & Send New Credentials".
 *  • Employees with no linked login account get an explanatory state rather than
 *    buttons that would fail.
 */

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

export function AccountManagementPanel({
  employee,
  onUpdate,
}: {
  employee: any;
  onUpdate: () => void;
}) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordNote, setTempPasswordNote] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [reason, setReason] = useState('');

  if (user?.permissionTier !== 'FULL') {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-muted">
        <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to view account management settings.</p>
      </div>
    );
  }

  const isArchived = !!employee.deletedAt;
  const account = employee.user;
  const isLocked = account?.lockedUntil && new Date(account.lockedUntil) > new Date();
  const isSelf = user?.employee?.id === employee.id;

  const runAccountAction = async (
    endpoint: string,
    successMessage: string,
    body?: Record<string, unknown>
  ) => {
    setIsLoading(true);
    try {
      const res = await api.post(`/employees/${employee.id}/account/${endpoint}`, body ?? {});
      toast.success(res.data?.message || successMessage);
      onUpdate();
      return res.data;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'The account action could not be completed.'));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setIsLoading(true);
    setTempPassword(null);
    setTempPasswordNote(null);
    try {
      const res = await api.post(`/employees/${employee.id}/account/reset-password`, {
        sendEmail: true,
      });
      const data = res.data?.data;
      setTempPassword(data?.temporaryPassword ?? null);
      setTempPasswordNote(
        data?.emailMessage ??
          (data?.emailSent
            ? 'The new credentials were emailed to the employee.'
            : 'The email was not sent. Give the password to the employee directly.')
      );
      toast.success(res.data?.message || 'A new temporary password was issued.');
      onUpdate();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'The password could not be reset.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = () => {
    setReason('');
    setConfirmState({
      title: 'Archive this employee?',
      body: 'The employee will be hidden from active directories and can no longer sign in. All historical records are preserved and the employee can be restored later.',
      confirmLabel: 'Archive employee',
      destructive: true,
      requireReason: true,
      onConfirm: async (enteredReason) => {
        setIsLoading(true);
        try {
          await api.patch(`/employees/${employee.id}/archive`, { reason: enteredReason });
          toast.success('Employee archived.');
          onUpdate();
        } catch (error) {
          toast.error(getApiErrorMessage(error, 'The employee could not be archived.'));
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleRestore = (restoreAccountAccess: boolean) => {
    setIsLoading(true);
    api
      .patch(`/employees/${employee.id}/restore`, { restoreAccountAccess })
      .then(() => {
        toast.success(
          restoreAccountAccess
            ? 'Employee restored and their login account reactivated.'
            : 'Employee restored. Their login account was left as it was.'
        );
        onUpdate();
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, 'The employee could not be restored.'));
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="space-y-8">
      {/* ── Account status ─────────────────────────────────────────────── */}
      <div className="bg-surface border rounded-xl p-6 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">System Account</h3>
          {account ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Login ID:</span> {account.email}
              </p>
              {/* The personal email is the login. Accounts from before that rule
                  may still use another address; HR switches them explicitly. */}
              {employee.personalEmail && account.email.toLowerCase() !== String(employee.personalEmail).toLowerCase() && (
                <div className="mt-2 max-w-md rounded-lg border border-status-warning-border bg-status-warning-surface p-3 text-xs text-status-warning-foreground space-y-2">
                  <p>
                    This account signs in with an older address. The personal email on file is{' '}
                    <strong>{employee.personalEmail}</strong>, which is now the login email.
                  </p>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={isLoading || isArchived}
                    onClick={() => {
                      if (!confirm(`Change this employee's login to ${employee.personalEmail}? They will sign in with that address from now on.`)) return;
                      void runAccountAction('use-personal-email', 'Login email updated.');
                    }}
                  >
                    Use personal email as login
                  </Button>
                </div>
              )}
              <p>
                <span className="font-semibold text-foreground">Created:</span>{' '}
                {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}
              </p>
              <p>
                <span className="font-semibold text-foreground">Last sign-in:</span>{' '}
                {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : 'Never'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground max-w-md">
              This employee has no HRISense login account. Accounts are created automatically during
              onboarding; contact your system administrator if one is missing.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {account &&
            (account.isActive ? (
              <Badge className="bg-success-light text-success-dark border-success/30 py-1 px-3">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Active
              </Badge>
            ) : (
              <Badge className="bg-muted text-foreground border-border py-1 px-3">
                <Lock className="w-4 h-4 mr-1" /> Inactive
              </Badge>
            ))}
          {isLocked && (
            <Badge className="bg-danger-light text-danger-dark border-danger/30 py-1 px-3">
              <Lock className="w-4 h-4 mr-1" /> Locked
            </Badge>
          )}
          {account?.mustChangePassword && (
            <Badge className="bg-warning-light text-warning-dark border-warning/30 py-1 px-3">
              <Key className="w-4 h-4 mr-1" /> Password change pending
            </Badge>
          )}
          {isArchived && (
            <Badge className="bg-foreground text-background py-1 px-3">
              <Archive className="w-4 h-4 mr-1" /> Archived
            </Badge>
          )}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {account && !isArchived && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Access control */}
          <div className="bg-surface border rounded-xl p-6">
            <h4 className="font-semibold text-foreground mb-4 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-primary-600 dark:text-primary-300" /> Access Control
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4 pb-4 border-b border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Account activation</p>
                  <p className="text-xs text-muted-foreground">
                    {account.isActive
                      ? 'Deactivating signs the employee out everywhere and blocks sign-in.'
                      : 'Reactivate sign-in access for this employee.'}
                  </p>
                </div>
                {account.isActive ? (
                  <Button
                    variant="delete"
                    size="sm"
                    disabled={isLoading || isSelf}
                    title={isSelf ? 'You cannot deactivate your own account.' : undefined}
                    onClick={() =>
                      setConfirmState({
                        title: 'Deactivate this account?',
                        body: 'The employee will be signed out of every device and will not be able to sign in until the account is reactivated.',
                        confirmLabel: 'Deactivate account',
                        destructive: true,
                        onConfirm: async () => {
                          await runAccountAction('deactivate', 'Account deactivated.');
                        },
                      })
                    }
                    className="shrink-0">
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="create"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => runAccountAction('activate', 'Account activated.')}
                    className="shrink-0">
                    Activate
                  </Button>
                )}
              </div>

              <div className="flex justify-between items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Account lock</p>
                  <p className="text-xs text-muted-foreground">
                    {isLocked
                      ? `Locked until ${new Date(account.lockedUntil).toLocaleString()}.`
                      : 'Temporarily block sign-in for one hour.'}
                  </p>
                </div>
                {isLocked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => runAccountAction('unlock', 'Account unlocked.')}
                    className="shrink-0"
                  >
                    <Unlock className="w-4 h-4" /> Unlock
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || isSelf}
                    title={isSelf ? 'You cannot lock your own account.' : undefined}
                    onClick={() =>
                      setConfirmState({
                        title: 'Lock this account?',
                        body: 'The employee will be signed out and unable to sign in for one hour. You can unlock the account at any time.',
                        confirmLabel: 'Lock account',
                        destructive: true,
                        onConfirm: async () => {
                          await runAccountAction('lock', 'Account locked.');
                        },
                      })
                    }
                    className="shrink-0 text-danger-dark border-danger/30 hover:bg-danger-light"
                  >
                    <Lock className="w-4 h-4" /> Lock
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-surface border rounded-xl p-6">
            <h4 className="font-semibold text-foreground mb-4 flex items-center">
              <Key className="w-5 h-5 mr-2 text-primary-600 dark:text-primary-300" /> Credentials
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4 pb-4 border-b border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Reset &amp; send new credentials</p>
                  <p className="text-xs text-muted-foreground">
                    Issues a new temporary password, signs the employee out everywhere, and emails
                    the credentials. HRISense cannot resend an existing password — it is never
                    stored in readable form.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="shrink-0"
                  onClick={() =>
                    setConfirmState({
                      title: 'Reset this password?',
                      body: 'A new temporary password will be generated and emailed to the employee. Their current password stops working immediately and every active session is signed out.',
                      confirmLabel: 'Reset & send',
                      onConfirm: async () => {
                        await handleResetPassword();
                      },
                    })
                  }
                >
                  <RefreshCcw className="w-4 h-4" /> Reset
                </Button>
              </div>

              <div className="flex justify-between items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Force password change</p>
                  <p className="text-xs text-muted-foreground">
                    {account.mustChangePassword
                      ? 'The employee is already required to change their password.'
                      : 'Require a new password at next sign-in, keeping the current one until then.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={isLoading || account.mustChangePassword}
                  onClick={() =>
                    runAccountAction('force-password-change', 'Password change required at next sign-in.')
                  }
                >
                  Require change
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Temporary password reveal ──────────────────────────────────── */}
      {tempPassword && (
        <div className="bg-warning-light border border-warning/40 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="text-warning-dark w-6 h-6 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-warning-dark font-bold mb-1">New temporary password</h4>
            <p className="text-warning-dark text-sm mb-4">
              This password is shown once and is never stored in readable form. Copy it now if you
              need to give it to the employee directly.
            </p>
            <div className="bg-surface border border-warning/40 rounded p-4 flex items-center justify-between gap-4">
              <code className="text-lg font-mono text-foreground tracking-wider font-bold break-all">
                {tempPassword}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  toast.success('Password copied to clipboard');
                }}
              >
                Copy
              </Button>
            </div>
            {tempPasswordNote && (
              <p className="text-xs text-warning-dark mt-3 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {tempPasswordNote}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Archive / restore ──────────────────────────────────────────── */}
      <div className="bg-danger-light border border-danger/30 rounded-xl p-6">
        <h4 className="font-semibold text-danger-dark mb-2 flex items-center">
          <Archive className="w-5 h-5 mr-2" /> Danger Zone
        </h4>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-sm text-danger-dark max-w-xl">
            {isArchived
              ? 'This employee is archived. They cannot sign in and do not appear in active directories. Their records are preserved.'
              : 'Archiving hides this employee from active directories and revokes access. Historical records are preserved and the employee can be restored later.'}
          </p>
          {isArchived ? (
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button
                variant="create"
                
                disabled={isLoading}
                onClick={() => handleRestore(true)}>
                Restore &amp; reactivate account
              </Button>
              <Button
                variant="create"
                
                disabled={isLoading}
                onClick={() => handleRestore(false)}>
                Restore only
              </Button>
            </div>
          ) : (
            <Button variant="delete" className="shrink-0" onClick={handleArchive} disabled={isLoading}>
              Archive Employee
            </Button>
          )}
        </div>
      </div>

      {/* ── Confirmation dialog ────────────────────────────────────────── */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border-2 border-border rounded-2xl shadow-card-hover w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold font-heading text-foreground">{confirmState.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{confirmState.body}</p>

            {confirmState.requireReason && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Reason <span className="text-danger">*</span>
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="For example: resigned, end of contract"
                  className="w-full h-10 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmState(null);
                  setReason('');
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant={confirmState.destructive ? 'destructive' : 'primary'}
                disabled={isLoading || (confirmState.requireReason && !reason.trim())}
                onClick={async () => {
                  const action = confirmState;
                  const enteredReason = reason.trim();
                  setConfirmState(null);
                  setReason('');
                  await action.onConfirm(enteredReason);
                }}
              >
                {confirmState.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
