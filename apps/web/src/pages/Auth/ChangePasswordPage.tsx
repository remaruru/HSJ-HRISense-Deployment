import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { KeyRound, ShieldCheck, Lock, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { tokenStorage } from '@/lib/tokenStorage';
import {
 PASSWORD_POLICY_DESCRIPTION,
 PASSWORD_RULES,
 passwordMeetsPolicy,
 passwordStrength, passwordRulesMet,
} from '@/lib/passwordPolicy';

/** m***@example.com — enough to recognise, not enough to read. */
function maskEmail(email?: string | null): string {
 if (!email || !email.includes('@')) return '';
 const [local, domain] = email.split('@');
 return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * First sign-in with a temporary password. The API refuses every other
 * request until this succeeds (`PASSWORD_CHANGE_REQUIRED`), so this page is
 * the only way forward — or Sign out.
 */
export default function ChangePasswordPage() {
 const navigate = useNavigate();
 const { user, fetchCurrentUser, logout } = useAuth();

 const [currentPassword, setCurrentPassword] = useState('');
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);

 // ─── Password strength (mirrors the server policy) ───────────────────────────
 const strength = passwordStrength(newPassword);
 const meetsPolicy = passwordMeetsPolicy(newPassword);

 const getStrengthColor = () => {
 if (strength === 0) return 'bg-gray-200 dark:bg-border-soft';
 if (strength <= 40) return 'bg-danger';
 if (strength <= 60) return 'bg-warning';
 if (strength <= 80) return 'bg-slate-500';
 return 'bg-success';
 };

 // ─── Submit ──────────────────────────────────────────────────────────────────
 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (newPassword !== confirmPassword) {
 toast.error('New passwords do not match');
 return;
 }
 if (!passwordMeetsPolicy(newPassword)) {
 toast.error(PASSWORD_POLICY_DESCRIPTION);
 return;
 }
 if (newPassword === currentPassword) {
 toast.error('Your new password must be different from your current password.');
 return;
 }

 setIsSubmitting(true);
 try {
 // `currentPassword` is the canonical field name on both sides of the API.
 // The refresh token keeps THIS session signed in; every other session of the
 // account is signed out by the server.
 await api.post('/auth/change-password', {
 currentPassword,
 newPassword,
 confirmPassword,
 refreshToken: tokenStorage.getRefreshToken() ?? undefined,
 });

 // Refresh the authenticated user so mustChangePassword reflects false
 const updatedUser = await fetchCurrentUser();

 if (!updatedUser) {
 // Refresh failed — the session was lost; go to login
 toast.error('Session could not be refreshed. Please log in again.');
 navigate({ to: '/login', replace: true });
 return;
 }

 toast.success('Password changed successfully. Welcome to HRISense!');

 // Navigate using TanStack Router — no page reload
 navigate({ to: '/dashboard', replace: true });
 } catch (error: any) {
 toast.error(getApiErrorMessage(error, 'Failed to change password'));
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="sm:mx-auto sm:w-full sm:max-w-md"
 >
 <div className="flex justify-center">
 <div className="h-14 w-14 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shadow-sm">
 <ShieldCheck className="h-7 w-7 text-primary" />
 </div>
 </div>
 <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
 Change Your Temporary Password
 </h2>
 <p className="mt-2 px-4 text-center text-sm text-gray-600 dark:text-secondary-foreground">
 Welcome, {user?.employee?.firstName ?? 'there'}! For your security, you need to create a new
 password before accessing HRISense.
 </p>
 {user?.email && (
 <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
 <Mail className="h-4 w-4" aria-hidden="true" />
 Registered email: <span className="font-semibold text-foreground">{maskEmail(user.email)}</span>
 </p>
 )}
 </motion.div>

 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.1 }}
 className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
 >
 <div className="bg-white py-8 px-4 shadow-xl shadow-black/5 sm:rounded-2xl sm:px-10 border border-gray-100 dark:bg-surface dark:border-border-soft">
 <form className="space-y-6" onSubmit={handleSubmit}>
 {/* Current password */}
 <div>
 <label className="block text-sm font-medium text-secondary-foreground">
 Current Temporary Password
 </label>
 <div className="mt-2 relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <KeyRound className="h-5 w-5 text-muted-foreground" />
 </div>
 <Input
 id="current-password"
 type="password"
 required
 value={currentPassword}
 onChange={(e) => setCurrentPassword(e.target.value)}
 className="pl-10 block w-full bg-gray-50/50 dark:bg-surface-2/50"
 placeholder="Enter current password"
 autoComplete="current-password"
 />
 </div>
 </div>

 {/* New password */}
 <div className="pt-2 border-t border-gray-100 dark:border-border-soft">
 <label className="block text-sm font-medium text-secondary-foreground">New Password</label>
 <div className="mt-2 relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Lock className="h-5 w-5 text-muted-foreground" />
 </div>
 <Input
 id="new-password"
 type="password"
 required
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 className="pl-10 block w-full bg-gray-50/50 dark:bg-surface-2/50"
 placeholder="At least 8 characters"
 autoComplete="new-password"
 />
 </div>
 {newPassword && (
 <div className="mt-2">
 <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-border-soft">
 <div
 className={`h-1.5 rounded-full transition-all ${getStrengthColor()}`}
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
 <li key={rule.id} className={ok ? 'text-status-success-foreground' : 'text-muted-foreground'}>
 {ok ? '✓' : '•'} {rule.label}
 </li>
 );
 })}
 </ul>
 </div>
 )}
 </div>

 {/* Confirm password */}
 <div>
 <label className="block text-sm font-medium text-secondary-foreground">
 Confirm New Password
 </label>
 <div className="mt-2 relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <Lock className="h-5 w-5 text-muted-foreground" />
 </div>
 <Input
 id="confirm-password"
 type="password"
 required
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 className="pl-10 block w-full bg-gray-50/50 dark:bg-surface-2/50"
 placeholder="Retype new password"
 autoComplete="new-password"
 />
 </div>
 </div>

 <Button
 id="change-password-submit"
 type="submit"
 className="w-full shadow-md"
 disabled={
 isSubmitting || !currentPassword || !meetsPolicy || newPassword !== confirmPassword
 }
 >
 {isSubmitting ? 'Updating...' : 'Set New Password & Continue'}
 </Button>
 </form>
 <button
 type="button"
 onClick={async () => {
 await logout();
 navigate({ to: '/login', replace: true });
 }}
 className="mt-5 mx-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
 >
 <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
 </button>
 </div>
 </motion.div>
 </div>
 );
}
