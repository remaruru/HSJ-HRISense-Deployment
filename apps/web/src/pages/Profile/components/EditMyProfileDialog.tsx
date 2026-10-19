import { confirmAction } from '@/components/shared/ConfirmProvider';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Phone, MapPin, User, Siren, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ReligionPicker } from '@/components/shared/ReligionPicker';
import { EmergencyContactsEditor } from '@/pages/Employees/components/EmergencyContactsEditor';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { contactProblems, contactsFromEmployee, filledContacts, type EmergencyContactRow } from '@/lib/employeeContacts';
import { fullNameOf } from '../profileFormat';

/**
 * Edit My Profile — ONLY the fields a person may change on their own record.
 *
 * The source of truth is the API's self-edit whitelist (`EmployeeService.update`,
 * `PUT /employees/:id` on your own record): mobile phone, home phone, present
 * and permanent address, emergency contacts (up to three) and religion. Nothing
 * else is shown here, not even disabled — the rest of the record is read on the
 * profile page and kept by HR.
 *
 * Not here, on purpose:
 *  • the personal email — it is the sign-in address, so only HR changes it;
 *  • the profile photo and banner — they have their own camera buttons on the
 *    profile card (ProfileHero), separate from this form.
 *
 * HR and Sister use this same form for their own My Profile. Their full
 * administrative edit stays in Employee Management.
 */

type Fields = {
  mobilePhone: string;
  homePhone: string;
  presentAddress: string;
  permanentAddress: string;
  religion: string;
};

const LABELS: Record<keyof Fields, string> = {
  mobilePhone: 'Mobile number',
  homePhone: 'Home phone',
  presentAddress: 'Present address',
  permanentAddress: 'Permanent address',
  religion: 'Religion',
};

/** Non-null columns in the Employee model — they cannot be saved blank. */
const REQUIRED: Array<keyof Fields> = ['mobilePhone', 'presentAddress'];

const fieldsOf = (e: any): Fields => ({
  mobilePhone: e?.mobilePhone ?? '',
  homePhone: e?.homePhone ?? '',
  presentAddress: e?.presentAddress ?? '',
  permanentAddress: e?.permanentAddress ?? '',
  religion: e?.religion ?? '',
});

const sameContacts = (a: EmergencyContactRow[], b: EmergencyContactRow[]) =>
  JSON.stringify(filledContacts(a).map((c) => [c.contactName.trim(), c.relationship.trim(), c.mobilePhone.trim()])) ===
  JSON.stringify(filledContacts(b).map((c) => [c.contactName.trim(), c.relationship.trim(), c.mobilePhone.trim()]));

function controlClass(invalid?: boolean) {
  return cn(
    'w-full h-11 px-3.5 text-sm rounded-xl border bg-surface text-foreground',
    'placeholder:text-muted-foreground transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500',
    invalid
      ? 'border-status-danger-foreground/60 bg-status-danger-surface/40'
      : 'border-input hover:border-primary-300 dark:hover:border-primary-900'
  );
}

function Field({ label, htmlFor, required, error, className, children }: {
  label: string; htmlFor: string; required?: boolean; error?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5 min-w-0', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-status-danger-foreground ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-status-danger-foreground" role="alert">{error}</p>}
    </div>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-border-soft bg-surface p-4 sm:p-5 min-w-0">
      <legend className="sr-only">{title}</legend>
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="text-primary-600 dark:text-primary-300 [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">{icon}</span>
        {title}
      </p>
      {children}
    </fieldset>
  );
}

export function EditMyProfileDialog({
  isOpen,
  onClose,
  employee,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Fields>(() => fieldsOf(employee));
  const [contacts, setContacts] = useState<EmergencyContactRow[]>(() => contactsFromEmployee(employee));
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [contactError, setContactError] = useState<string | null>(null);
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(fieldsOf(employee));
    setContacts(contactsFromEmployee(employee));
    setErrors({});
    setContactError(null);
    setStep('edit');
  }, [isOpen, employee]);

  const original = useMemo(() => fieldsOf(employee), [employee]);
  const originalContacts = useMemo(() => contactsFromEmployee(employee), [employee]);
  const changedKeys = (Object.keys(LABELS) as Array<keyof Fields>).filter((k) => form[k].trim() !== original[k].trim());
  const contactsChanged = !sameContacts(contacts, originalContacts);
  const dirty = changedKeys.length > 0 || contactsChanged;

  const set = (key: keyof Fields, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const close = async () => {
    if (saving) return;
    if (dirty && !(await confirmAction({ title: 'Discard your changes?', message: 'The changes you have not saved will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    onClose();
  };

  const validate = () => {
    const next: Partial<Record<keyof Fields, string>> = {};
    for (const key of REQUIRED) {
      if (!form[key].trim()) next[key] = `${LABELS[key]} is required.`;
    }
    const problems = contactProblems(contacts);
    setContactError(problems.length ? `${problems.join('; ')}.` : null);
    setErrors(next);
    return Object.keys(next).length === 0 && problems.length === 0;
  };

  const review = () => {
    if (!dirty) {
      toast.info('Nothing has changed yet.');
      return;
    }
    if (validate()) setStep('review');
    else toast.error('Please fix the highlighted fields.');
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const key of changedKeys) {
        const value = form[key].trim();
        // Optional values cleared by the person are stored as empty (null).
        payload[key] = value === '' && !REQUIRED.includes(key) ? null : value;
      }
      if (contactsChanged) payload.emergencyContacts = filledContacts(contacts);
      await api.put(`/employees/${employee.id}`, payload);
      toast.success('Your profile has been updated.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Your profile could not be updated.'));
    } finally {
      setSaving(false);
    }
  };

  const shown = (v: string) => (v.trim() ? v.trim() : 'Empty');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(100dvh-1.5rem)] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader className="shrink-0 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border-soft bg-surface space-y-0 text-left">
          <div className="flex items-center gap-3.5 pr-10">
            <Avatar name={fullNameOf(employee)} src={employee?.photoUrl || undefined} size="lg" className="shrink-0" />
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight">
                {step === 'edit' ? 'Edit My Profile' : 'Review your changes'}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {step === 'edit'
                  ? 'Your contact details, addresses, emergency contacts and religion.'
                  : 'Check these before saving. Only what changed is listed.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4 bg-background">
          {step === 'edit' ? (
            <>
              <Group icon={<Phone />} title="Contact">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={LABELS.mobilePhone} htmlFor="me-mobilePhone" required error={errors.mobilePhone}>
                    <input id="me-mobilePhone" type="tel" inputMode="tel" autoComplete="tel" value={form.mobilePhone}
                      onChange={(e) => set('mobilePhone', e.target.value)} aria-invalid={!!errors.mobilePhone || undefined}
                      className={controlClass(!!errors.mobilePhone)} />
                  </Field>
                  <Field label={LABELS.homePhone} htmlFor="me-homePhone">
                    <input id="me-homePhone" type="tel" inputMode="tel" value={form.homePhone}
                      onChange={(e) => set('homePhone', e.target.value)} className={controlClass()} />
                  </Field>
                </div>
              </Group>

              <Group icon={<MapPin />} title="Address">
                <div className="grid grid-cols-1 gap-4">
                  <Field label={LABELS.presentAddress} htmlFor="me-presentAddress" required error={errors.presentAddress}>
                    <input id="me-presentAddress" autoComplete="street-address" value={form.presentAddress}
                      onChange={(e) => set('presentAddress', e.target.value)} aria-invalid={!!errors.presentAddress || undefined}
                      className={controlClass(!!errors.presentAddress)} />
                  </Field>
                  <Field label={LABELS.permanentAddress} htmlFor="me-permanentAddress">
                    <input id="me-permanentAddress" value={form.permanentAddress}
                      onChange={(e) => set('permanentAddress', e.target.value)} className={controlClass()} />
                  </Field>
                </div>
              </Group>

              <Group icon={<User />} title="Personal">
                <Field label={LABELS.religion} htmlFor="me-religion">
                  <ReligionPicker
                    id="me-religion"
                    value={form.religion}
                    onChange={(religion) => set('religion', religion)}
                    controlClass={controlClass()}
                    optional
                  />
                </Field>
              </Group>

              <Group icon={<Siren />} title="Emergency contacts">
                <EmergencyContactsEditor value={contacts} onChange={setContacts} idPrefix="me-emergency" controlClassName={controlClass()} />
                {contactError && <p className="mt-2 text-xs font-medium text-status-danger-foreground" role="alert">{contactError}</p>}
              </Group>

              <p className="text-xs text-muted-foreground">
                Your name, personal email (your sign-in), employment details, job role, unit, supervisor and government
                IDs are kept by HR. Ask HR if any of them needs correcting. To change your photo or banner, use the camera
                button on your profile card.
              </p>
            </>
          ) : (
            <dl className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
              {changedKeys.map((key) => (
                <div key={key} className="grid grid-cols-1 sm:grid-cols-[160px_minmax(0,1fr)] gap-1 sm:gap-3 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{LABELS[key]}</dt>
                  <dd className="text-sm min-w-0 break-words">
                    <span className="text-muted-foreground line-through">{shown(original[key])}</span>
                    <span className="mx-1.5 text-muted-foreground" aria-hidden="true">→</span>
                    <span className="font-semibold text-foreground">{shown(form[key])}</span>
                  </dd>
                </div>
              ))}
              {contactsChanged && (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_minmax(0,1fr)] gap-1 sm:gap-3 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency contacts</dt>
                  <dd className="text-sm space-y-0.5 min-w-0 break-words">
                    {filledContacts(contacts).map((c, i) => (
                      <p key={i} className="text-foreground">{i + 1}. {c.contactName} ({c.relationship}) · {c.mobilePhone}</p>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 sm:px-6 py-4 border-t border-border-soft bg-surface">
          {step === 'edit' ? (
            <>
              <Button type="button" variant="ghost" onClick={close} className="w-full sm:w-auto">Cancel</Button>
              <Button type="button" onClick={review} disabled={!dirty} className="w-full sm:w-auto">Review changes</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep('edit')} disabled={saving} leftIcon={<ArrowLeft className="h-4 w-4" />} className="w-full sm:w-auto">
                Back to editing
              </Button>
              <Button type="button" onClick={save} disabled={saving} className="w-full sm:w-auto">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
