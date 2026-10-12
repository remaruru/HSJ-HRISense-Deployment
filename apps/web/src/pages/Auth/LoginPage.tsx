import { motion } from 'framer-motion';
import {
  Heart,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AiMascot } from '@/components/ai/AiMascot';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { useAuth } from '@/providers/AuthProvider';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { getApiErrorCode, getApiErrorMessage, getRetryAfterSeconds } from '@/utils/error-handler.util';
import { tokenStorage } from '@/lib/tokenStorage';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { AuthService } from '@/services/auth.service';
import { googleButtonWidth, renderGoogleButton } from '@/lib/googleIdentity';
import { RecaptchaCheckbox } from '@/components/common/RecaptchaCheckbox';
import { getCaptchaConfig } from '@/services/captcha.service';

/** A Google sign-in with an email that has no HRISense account. */
const GOOGLE_NO_ACCOUNT_ERROR = {
  title: 'No HRISense account uses this Google email.',
  details: [
    'Hospicio de San Jose employees: choose the Google account with the email HR registered for you, or sign in with your email and password. If it still does not work, contact HR.',
    'Not an employee? Please do not sign in. Repeated tries with unregistered emails will block Google sign-in on this network.',
  ],
};

/** "15s" under a minute, "14:59" from there. */
function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isLoggingIn } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  /** Extra lines under the error headline (only some errors have them). */
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  // Default to the previous choice so returning users keep their preference.
  const [rememberMe, setRememberMe] = useState(() => tokenStorage.isRemembered());

  const goOn = (user: { mustChangePassword: boolean }) => {
    if (user.mustChangePassword) {
      toast.info('Please set a new password before continuing.');
      navigate({ to: '/change-password', replace: true });
    } else {
      toast.success('Welcome back to HRISense!');
      navigate({ to: '/dashboard', replace: true });
    }
  };

  // ── Google Sign-In: shown only when the server says it is configured ──────
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleState, setGoogleState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);
  const anyBusy = isLoggingIn || googleBusy;
  const passwordBusy = isLoggingIn && !googleBusy;

  // Google calls back long after render; read the latest choices through refs.
  const latest = useRef({ rememberMe, loginWithGoogle, goOn });
  latest.current = { rememberMe, loginWithGoogle, goOn };

  useEffect(() => {
    let alive = true;
    AuthService.googleConfig()
      .then((c) => {
        if (alive && c.enabled && c.clientId) setGoogleClientId(c.clientId);
      })
      .catch(() => undefined); // no button; the password form reports a server problem
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const host = googleRef.current;
    if (!googleClientId || !host) return;
    let alive = true;
    let timer: number | undefined;

    const onCredential = async (credential: string) => {
      setErrorMsg('');
      setErrorDetails([]);
      setGoogleBusy(true);
      try {
        // The server verifies the token with Google, then applies every
        // HRISense account rule, including the forced password change.
        const { loginWithGoogle: signIn, rememberMe: remember, goOn: next } = latest.current;
        next(await signIn(credential, remember));
      } catch (err) {
        if (getApiErrorCode(err) === 'GOOGLE_NO_ACCOUNT') {
          // The server's message is one long paragraph; split it into a
          // headline and one line per audience so it can be read at a glance.
          setErrorMsg(GOOGLE_NO_ACCOUNT_ERROR.title);
          setErrorDetails(GOOGLE_NO_ACCOUNT_ERROR.details);
        } else {
          setErrorMsg(getApiErrorMessage(err, 'Google sign-in failed. Please try again.'));
        }
      } finally {
        setGoogleBusy(false);
      }
    };

    let drawnWidth = 0;
    const draw = () => {
      drawnWidth = host.clientWidth;
      const available = drawnWidth || 360;
      // Google stops at 400 px; scale it up a little so it is as wide as the form.
      const button = googleButtonWidth(available);
      host.style.transform = available > button ? `scale(${Math.min(1.15, available / button).toFixed(3)})` : '';
      return renderGoogleButton(host, googleClientId, onCredential, {
        width: available,
        dark: document.documentElement.classList.contains('dark'),
      })
        .then(() => alive && setGoogleState('ready'))
        .catch(() => alive && setGoogleState('unavailable'));
    };
    draw();

    // Redraw for a new width or theme (Google's button is a fixed-size frame).
    // Height changes are ignored: every draw changes the box's height (and
    // again when Google swaps in "Continue as …"), so redrawing on them would
    // redraw the button forever.
    const redraw = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 150);
    };
    const resize = new ResizeObserver(() => {
      if (host.clientWidth !== drawnWidth) redraw();
    });
    resize.observe(host);
    const theme = new MutationObserver(redraw);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      alive = false;
      window.clearTimeout(timer);
      resize.disconnect();
      theme.disconnect();
    };
  }, [googleClientId]);

  // "I'm not a robot" on every sign-in, whenever the server has reCAPTCHA keys.
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  useEffect(() => {
    let alive = true;
    getCaptchaConfig().then((c) => {
      if (alive && c.enabled && c.siteKey) setCaptchaSiteKey(c.siteKey);
    });
    return () => {
      alive = false;
    };
  }, []);
  const needCaptcha = !!captchaSiteKey;

  // After 3 wrong passwords, each further one locks this browser for a while
  // (15 s, 30 s, 1 min, then 15 min — the API decides and sends the wait);
  // the button counts it down.
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);
  const lockSecondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setErrorDetails([]);

    try {
      // login() stores the token and user in AuthProvider before resolving.
      // We receive the authenticated user so we can branch on mustChangePassword.
      const user = await login({ email, password, rememberMe, captchaToken: needCaptcha ? captchaToken ?? undefined : undefined });
      goOn(user);
    } catch (err: any) {
      const wait = getRetryAfterSeconds(err);
      if (wait) {
        const t = Date.now();
        setNow(t);
        setLockedUntil(t + wait * 1000);
      }
      // A checkbox result works once: clear it so the next attempt is ticked again.
      if (captchaToken) setCaptchaReset((n) => n + 1);
      setErrorMsg(getApiErrorMessage(err, 'Invalid email or password'));
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding (desktop). Plain wording, no implementation
          details; the HRISense mascot is the same one used across the app. */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-primary-500 via-primary-700 to-primary-900 flex-col justify-between p-12">
        <div className="absolute inset-0 dot-grid opacity-10" aria-hidden="true" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
            <Heart className="h-7 w-7 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xl font-bold text-white font-heading">HRISense</p>
            <p className="text-xs text-primary-100">Hospicio de San Jose</p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 xl:gap-12">
          <div className="min-w-0">
            <h1 className="text-4xl xl:text-5xl font-extrabold font-heading text-white leading-tight mb-4">
              HSJ HRISense
            </h1>
            <p className="text-lg xl:text-xl font-semibold text-primary-50 leading-snug max-w-md mb-3">
              An AI-Assisted Workforce Administration System with Compliance Decision
            </p>
            <p className="text-primary-100 text-base leading-relaxed max-w-md">
              For the staff of Hospicio de San Jose — your records, schedule, attendance, leave and more, in one place.
            </p>
          </div>
          <div className="relative shrink-0">
            <div className="absolute inset-0 m-auto h-56 w-56 xl:h-64 xl:w-64 rounded-full bg-white/10 border border-white/15" aria-hidden="true" />
            <span className="relative block xl:hidden"><AiMascot variant="full" size={260} /></span>
            <span className="relative hidden xl:block"><AiMascot variant="full" size={300} /></span>
          </div>
        </div>

        <p className="relative z-10 text-sm text-primary-100 max-w-md">
          Applying for a job at Hospicio de San Jose? You don&rsquo;t need an account —{' '}
          <Link to={'/careers' as any} className="font-semibold text-white underline underline-offset-2 hover:text-primary-50">
            view open positions
          </Link>
          .
        </p>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative">
        <Link
          to="/"
          className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <ThemeToggle className="absolute top-5 right-5" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="w-full max-w-md mt-12 md:mt-0"
        >
          {/* Phones and tablets: the brand and a smaller mascot above the form. */}
          <motion.div variants={staggerItem} className="flex items-center justify-between gap-4 mb-8 lg:hidden">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Heart className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="font-bold font-heading text-foreground">HSJ HRISense</p>
                <p className="text-xs text-muted-foreground">Hospicio de San Jose</p>
              </div>
            </div>
            <AiMascot variant="full" size={84} className="shrink-0" />
          </motion.div>

          <motion.div variants={staggerItem} className="mb-8">
            <h2 className="text-2xl font-extrabold font-heading text-foreground mb-2">
              Sign in to your account
            </h2>
            <p className="text-muted-foreground text-sm">
              Enter your HSJ credentials to access HRISense.
            </p>
          </motion.div>

          <motion.form variants={staggerContainer} onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <motion.div
                variants={staggerItem}
                role="alert"
                className={cn(
                  'p-4 rounded-xl bg-status-danger-surface border border-status-danger-border text-status-danger-foreground text-sm flex gap-3',
                  errorDetails.length > 0 ? 'items-start' : 'items-center'
                )}
              >
                <AlertCircle className={cn('h-5 w-5 shrink-0', errorDetails.length > 0 && 'mt-0.5')} />
                <div className="min-w-0 space-y-2">
                  <p className={errorDetails.length > 0 ? 'font-bold' : 'font-medium'}>{errorMsg}</p>
                  {errorDetails.map((line) => (
                    <p key={line} className="leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Email */}
            <motion.div variants={staggerItem}>
              <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                Personal email
              </label>
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your personal email"
                required
                disabled={anyBusy}
                autoComplete="username"
                className={cn(
                  'w-full px-4 py-3 rounded-xl border-2 border-border bg-surface text-foreground text-sm',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-primary-500',
                  'transition-all duration-200',
                  'focus:shadow-[4px_4px_0px_0px_#148281]',
                  'disabled:opacity-60 disabled:cursor-not-allowed'
                )}
              />
            </motion.div>

            {/* Password */}
            <motion.div variants={staggerItem}>
              <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={anyBusy}
                  autoComplete="current-password"
                  className={cn(
                    'w-full px-4 py-3 pr-12 rounded-xl border-2 border-border bg-surface text-foreground text-sm',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:border-primary-500',
                    'transition-all duration-200',
                    'focus:shadow-[4px_4px_0px_0px_#148281]',
                    'disabled:opacity-60 disabled:cursor-not-allowed'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </motion.div>

            {/* Remember me + forgot password */}
            <motion.div variants={staggerItem} className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="login-remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-2 border-border text-primary-600 focus:ring-primary-500 cursor-pointer dark:text-primary-300"
                />
                <span className="text-sm text-foreground font-medium">Keep me signed in</span>
              </label>
              <Link
                to={'/forgot-password' as any}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-300 dark:hover:text-primary-300"
              >
                Forgot password?
              </Link>
            </motion.div>

            {needCaptcha && (
              <motion.div variants={staggerItem}>
                <RecaptchaCheckbox align="center" siteKey={captchaSiteKey!} resetKey={captchaReset} onToken={setCaptchaToken} />
              </motion.div>
            )}

            {/* Submit — says what is missing instead of silently doing nothing. */}
            <motion.div variants={staggerItem}>
              <Button
                type="submit"
                size="lg"
                pill
                isLoading={passwordBusy}
                disabled={anyBusy || !email || !password || lockSecondsLeft > 0 || (needCaptcha && !captchaToken)}
                className="w-full"
                rightIcon={!passwordBusy && lockSecondsLeft === 0 && (!needCaptcha || captchaToken) ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {passwordBusy
                  ? 'Signing in...'
                  : lockSecondsLeft > 0
                    ? `Try again in ${formatCountdown(lockSecondsLeft)}`
                    : needCaptcha && !captchaToken
                      ? 'Please finish the CAPTCHA'
                      : 'Sign In to HRISense'}
              </Button>
            </motion.div>
          </motion.form>

          {googleClientId && (
            <motion.div variants={staggerItem} className="mt-5 space-y-5">
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="relative flex min-h-[52px] items-center">
                {/* Google renders its own "Continue with Google" button here. Its
                    frame is a light page: a light color scheme keeps Chrome from
                    painting a white box behind it in dark mode. */}
                <div ref={googleRef} className="flex w-full justify-center [color-scheme:light]" />
                {googleState === 'loading' && (
                  <div className="absolute inset-0 animate-pulse rounded-full border-2 border-border bg-surface" aria-hidden="true" />
                )}
                {anyBusy && googleState === 'ready' && (
                  <div
                    role="status"
                    className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-surface/85 text-sm font-semibold text-foreground"
                  >
                    {googleBusy && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Signing in with Google...
                      </>
                    )}
                  </div>
                )}
              </div>
              {googleState === 'unavailable' && (
                <p className="text-center text-xs text-muted-foreground">
                  Google sign-in could not load. Check your connection, or sign in with your email and password.
                </p>
              )}
            </motion.div>
          )}

          {/* Who may sign in — in plain words. */}
          <motion.div variants={staggerItem} className="mt-8 p-4 rounded-xl bg-muted border border-border">
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-primary-600 shrink-0 mt-0.5 dark:text-primary-300" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                For authorized Hospicio de San Jose personnel only. Sign in with the personal email registered
                with HR{googleClientId ? ', or continue with the Google account that uses that same email' : ''}. If you
                cannot sign in, contact HR.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
