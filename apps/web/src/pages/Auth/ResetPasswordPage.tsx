import { useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Heart, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { AuthService } from '@/services/auth.service';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import {
  PASSWORD_POLICY_DESCRIPTION,
  PASSWORD_RULES,
  passwordMeetsPolicy,
  passwordStrength, passwordRulesMet,
} from '@/lib/passwordPolicy';

/**
 * Self-service password reset — step 2.
 * The token arrives only through the emailed link (`?token=...`).
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const token = typeof search.token === 'string' ? search.token : '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  const strength = passwordStrength(newPassword);
  const meetsPolicy = passwordMeetsPolicy(newPassword);

  const strengthColor = () => {
    if (strength === 0) return 'bg-muted';
    if (strength <= 40) return 'bg-danger';
    if (strength <= 60) return 'bg-warning';
    if (strength <= 80) return 'bg-info';
    return 'bg-success';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!meetsPolicy) {
      setErrorMsg(PASSWORD_POLICY_DESCRIPTION);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('The two passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await AuthService.resetPassword({ token, newPassword });
      setDone(true);
    } catch (err) {
      setErrorMsg(
        getApiErrorMessage(err, 'This password reset link is invalid or has expired. Request a new one.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="w-full max-w-md"
      >
        <motion.div variants={staggerItem} className="flex flex-col items-center mb-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-pop-color mb-4">
            <Heart className="h-7 w-7 text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-extrabold font-heading text-foreground">Choose a new password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Set the password you will use to sign in to HRISense.
          </p>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="bg-surface border-2 border-border rounded-2xl p-6 shadow-card"
        >
          {done ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-success-light text-success-dark flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold font-heading text-foreground">Password updated</h2>
              <p className="text-sm text-muted-foreground">
                You can now sign in with your new password. Any other devices were signed out.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: '/login', replace: true })}>
                Go to sign in
              </Button>
            </div>
          ) : !token ? (
            <div className="text-center space-y-4 py-4">
              <h2 className="text-lg font-bold font-heading text-foreground">Reset link required</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Open the link from your password reset email to continue. Links expire 60 minutes
                after they are sent.
              </p>
              <Link to={'/forgot-password' as any}>
                <Button variant="outline" className="w-full">Request a new link</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div role="alert" className="rounded-xl border-2 border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger-dark">
                  {errorMsg}
                </div>
              )}

              <div>
                <label htmlFor="reset-new" className="block text-sm font-semibold text-foreground mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    id="reset-new"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
                    className={cn(
                      'w-full pl-11 pr-4 py-3 rounded-xl border-2 border-border bg-surface text-foreground text-sm',
                      'focus:outline-none focus:border-primary-500 transition-all duration-200 disabled:opacity-60'
                    )}
                  />
                </div>

                {newPassword && (
                  <div className="mt-3">
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={cn('h-1.5 rounded-full transition-all', strengthColor())}
                        style={{ width: `${strength}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                      {passwordRulesMet(newPassword).met} of {passwordRulesMet(newPassword).total} requirements met
                    </p>
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
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="reset-confirm" className="block text-sm font-semibold text-foreground mb-1.5">
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    id="reset-confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className={cn(
                      'w-full pl-11 pr-4 py-3 rounded-xl border-2 border-border bg-surface text-foreground text-sm',
                      'focus:outline-none focus:border-primary-500 transition-all duration-200 disabled:opacity-60'
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                pill
                isLoading={isSubmitting}
                disabled={isSubmitting || !meetsPolicy || newPassword !== confirmPassword}
                className="w-full"
              >
                {isSubmitting ? 'Updating...' : 'Set new password'}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-border text-center">
            <Link
              to={'/login' as any}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline dark:text-primary-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
