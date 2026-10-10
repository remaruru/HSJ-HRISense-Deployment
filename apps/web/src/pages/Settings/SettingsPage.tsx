import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sun,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/providers/ThemeProvider';
import { useBuddyEnabled } from '@/hooks/useBuddyEnabled';
import { AiMascot } from '@/components/ai/AiMascot';
import { api } from '@/services/api';
import { tokenStorage } from '@/lib/tokenStorage';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from 'sonner';
import {
  PASSWORD_POLICY_DESCRIPTION,
  PASSWORD_RULES,
  passwordMeetsPolicy,
} from '@/lib/passwordPolicy';

/**
 * Settings.
 *
 * Only options that genuinely work are shown. There are no placeholder cards:
 * Profile and Notifications navigate to real pages, Appearance drives the real
 * theme, and Security changes the password through the live endpoint.
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [buddyEnabled, setBuddyEnabled] = useBuddyEnabled();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const meetsPolicy = passwordMeetsPolicy(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!meetsPolicy) {
      toast.error(PASSWORD_POLICY_DESCRIPTION);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('The two new passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      // The refresh token keeps this session signed in; the server signs out every other one.
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        refreshToken: tokenStorage.getRefreshToken() ?? undefined,
      });
      toast.success('Your password has been updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Your password could not be changed.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-3xl mx-auto"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<SettingsIcon className="h-5 w-5" />}
          title="Settings"
          subtitle="Your account and display preferences."
        />
      </motion.div>

      {/* Profile */}
      <motion.div variants={staggerItem}>
        <SettingsCard
          icon={<User className="h-5 w-5" />}
          title="My Profile"
          description="View your employee record, schedule, documents and training history."
          action={
            <Button
              variant="review"
              size="sm"
              disabled={!user?.employee?.id}
              onClick={() => navigate({ to: '/profile' })}>
              Open <ChevronRight className="h-4 w-4" />
            </Button>
          }
        >
          {user && (
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-semibold text-foreground">{user.email}</span>
              {user.employee?.jobRole?.title ? ` · ${user.employee.jobRole.title}` : ''}
            </p>
          )}
        </SettingsCard>
      </motion.div>

      {/* Security */}
      <motion.div variants={staggerItem}>
        <SettingsCard
          icon={<KeyRound className="h-5 w-5" />}
          title="Security"
          description="Change the password you use to sign in to HRISense."
          action={
            <Button variant="outline" size="sm" onClick={() => setShowPasswordForm((v) => !v)}>
              {showPasswordForm ? 'Cancel' : 'Change password'}
            </Button>
          }
        >
          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="mt-4 space-y-4 border-t border-border pt-4">
              <Field
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={isSaving}
              />
              <div>
                <Field
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  disabled={isSaving}
                />
                {newPassword && (
                  <ul className="text-xs mt-2 space-y-1">
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(newPassword);
                      return (
                        <li key={rule.id} className={ok ? 'text-success-dark' : 'text-muted-foreground'}>
                          {ok ? '✓' : '•'} {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <Field
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                disabled={isSaving}
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !currentPassword || !meetsPolicy || newPassword !== confirmPassword}
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</>
                ) : (
                  'Update password'
                )}
              </Button>
            </form>
          )}
        </SettingsCard>
      </motion.div>

      {/* Appearance */}
      <motion.div variants={staggerItem}>
        <SettingsCard
          icon={<Monitor className="h-5 w-5" />}
          title="Appearance"
          description="Choose how HRISense looks on this device. Your choice is remembered here."
        >
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => { if (isDark) toggleTheme(); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-colors',
                !isDark ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'border-border bg-surface text-foreground hover:border-primary-300 dark:hover:border-primary-900'
              )}
            >
              <Sun className="h-4 w-4" /> Light
            </button>
            <button
              type="button"
              onClick={() => { if (!isDark) toggleTheme(); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-colors',
                isDark ? 'border-primary-500 bg-primary-950/40 text-primary-300' : 'border-border bg-surface text-foreground hover:border-primary-300 dark:hover:border-primary-900'
              )}
            >
              <Moon className="h-4 w-4" /> Dark
            </button>
          </div>
        </SettingsCard>
      </motion.div>

      {/* HRISense buddy */}
      <motion.div variants={staggerItem}>
        <SettingsCard
          icon={<AiMascot size={30} animated={false} />}
          title="HRISense buddy"
          description="The little AI helper that peeks in from the edge of the screen. Press him to say hi, or drag him out of the way. Your choice is remembered on this device."
        >
          <div className="flex gap-2 mt-3" role="group" aria-label="HRISense buddy">
            {[
              { on: true, label: 'Show buddy' },
              { on: false, label: 'Hide buddy' },
            ].map((opt) => {
              const active = buddyEnabled === opt.on;
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBuddyEnabled(opt.on)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-colors',
                    active
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                      : 'border-border bg-surface text-foreground hover:border-primary-300 dark:hover:border-primary-900'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </SettingsCard>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={staggerItem}>
        <SettingsCard
          icon={<Bell className="h-5 w-5" />}
          title="Notifications"
          description="Review updates about your leave requests, evaluations and training."
          action={
            <Button variant="review" size="sm" onClick={() => navigate({ to: '/notifications' })}>
              Open <ChevronRight className="h-4 w-4" />
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            HRISense notifies you in the app. There are no email notification preferences to
            configure yet.
          </p>
        </SettingsCard>
      </motion.div>
    </motion.div>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl border-2 border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 dark:bg-primary-900/40 dark:text-primary-300">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="font-bold font-heading text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="mt-3 pl-0 sm:pl-13">{children}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
      <input
        type="password"
        required
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:border-primary-500 disabled:opacity-60"
      />
    </div>
  );
}
