import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Mail, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { AuthService } from '@/services/auth.service';
import { getApiErrorMessage } from '@/utils/error-handler.util';

/**
 * Self-service password reset — step 1.
 *
 * The API never returns the reset token; it emails a link. The confirmation
 * message is deliberately identical whether or not the address exists, so this
 * page cannot be used to discover which emails have HRISense accounts.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await AuthService.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'We could not start the password reset. Please try again.'));
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
          <h1 className="text-2xl font-extrabold font-heading text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Enter the email address you use to sign in to HRISense and we will send you a link to
            choose a new password.
          </p>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="bg-surface border-2 border-border rounded-2xl p-6 shadow-card"
        >
          {submitted ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-success-light text-success-dark flex items-center justify-center">
                <MailCheck className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold font-heading text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If an account exists for that email address, a password reset link has been sent to
                it. The link expires in 60 minutes.
              </p>
              <p className="text-xs text-muted-foreground">
                Did not receive it? Check your spam folder, or contact the HR Department.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div role="alert" className="rounded-xl border-2 border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger-dark">
                  {errorMsg}
                </div>
              )}

              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-semibold text-foreground mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@hospiciodesanjose.org"
                    disabled={isSubmitting}
                    className={cn(
                      'w-full pl-11 pr-4 py-3 rounded-xl border-2 border-border bg-surface text-foreground text-sm',
                      'placeholder:text-muted-foreground',
                      'focus:outline-none focus:border-primary-500',
                      'transition-all duration-200 disabled:opacity-60'
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                pill
                isLoading={isSubmitting}
                disabled={isSubmitting || !email.trim()}
                className="w-full"
              >
                {isSubmitting ? 'Sending...' : 'Send reset link'}
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
