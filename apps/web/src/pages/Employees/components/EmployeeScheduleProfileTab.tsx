import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, FileClock, RefreshCw, AlertCircle, CalendarPlus, Plus, Trash2, RotateCcw, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scheduleApi, EmployeeScheduleData, ScheduleHistoryLog } from '@/services/api/schedule';
import { weeklyScheduleApi, EmployeeWeeklySchedule, ShiftDefinition, EmployeeWeeklyScheduleDay, EmployeeWeeklyScheduleShift } from '@/services/api/weekly-schedule';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { isAxiosError } from 'axios';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const WEEKDAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun'
};

function formatTime12h(timeStr: string | null | undefined) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let hour = parseInt(parts[0], 10);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

function prettyDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

/**
 * A shift written the way HR reads it — the name plus the actual hours — so no
 * one has to recognise a shift by an internal id.
 */
function describeShift(shift?: ShiftDefinition | null): string {
  if (!shift) return 'No shift chosen';
  const crossesMidnight = shift.endTime < shift.startTime;
  return `${shift.name} — ${formatTime12h(shift.startTime)} – ${formatTime12h(shift.endTime)}${crossesMidnight ? ' (next day)' : ''}`;
}

/**
 * Shared overlap rule used both by the inline problem list and by save, so the
 * modal never reports "ready to save" and then rejects the same configuration.
 */
function findOverlap(
  chosen: { shiftId: string }[],
  allShifts: ShiftDefinition[]
): string | null {
  const selected = chosen
    .map(s => allShifts.find(sh => sh.id === s.shiftId))
    .filter(Boolean) as ShiftDefinition[];

  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      if (selected[i].id === selected[j].id) return 'This shift has already been added.';
      const getMins = (t: string) => { const [h, m] = t.split(':'); return parseInt(h) * 60 + parseInt(m); };
      let s1Start = getMins(selected[i].startTime); let s1End = getMins(selected[i].endTime); if (s1End <= s1Start) s1End += 24 * 60;
      let s2Start = getMins(selected[j].startTime); let s2End = getMins(selected[j].endTime); if (s2End <= s2Start) s2End += 24 * 60;

      if (s1Start < s2End && s2Start < s1End) {
        return `These work shifts overlap.\n\n${formatTime12h(selected[i].startTime)} – ${formatTime12h(selected[i].endTime)}\nand\n${formatTime12h(selected[j].startTime)} – ${formatTime12h(selected[j].endTime)}\n\nPlease choose work shifts that do not overlap.`;
      }
    }
  }
  return null;
}

// ─── Types for the simplified editor ──────────────────────────────────────────

interface DayCustomization {
  type: 'working' | 'dayOff' | 'unconfigured';
  shifts: { shiftId: string; sequence: number }[];
}

// ─── Hydration: infer usual shift from existing schedule ──────────────────────

function getShiftSetKey(shifts: EmployeeWeeklyScheduleShift[]) {
  return (shifts || [])
    .map(s => s.shiftId || s.shift?.id || '')
    .filter(Boolean)
    .join(',');
}

function inferUsualShifts(days: EmployeeWeeklyScheduleDay[]): { usualShiftIds: string[]; isMixed: boolean } {
  const shiftCounts: Record<string, number> = {};
  let workingDayCount = 0;

  for (const d of days) {
    if (d.status === 'WORKING' && d.shifts && d.shifts.length > 0) {
      const key = getShiftSetKey(d.shifts);
      if (key) {
        shiftCounts[key] = (shiftCounts[key] || 0) + 1;
        workingDayCount++;
      }
    } else if (d.status === 'WORKING') {
      workingDayCount++;
    }
  }

  if (workingDayCount === 0) {
    return { usualShiftIds: [], isMixed: false };
  }

  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, count] of Object.entries(shiftCounts)) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }

  if (bestKey && bestCount >= 2 && bestCount >= workingDayCount / 2) {
    return { usualShiftIds: bestKey.split(','), isMixed: false };
  }

  if (workingDayCount > 0 && bestCount < 2) {
    return { usualShiftIds: [], isMixed: true };
  }

  return { usualShiftIds: bestKey ? bestKey.split(',') : [], isMixed: bestCount < workingDayCount / 2 };
}

function hydrateFromExisting(
  existingDays: EmployeeWeeklyScheduleDay[],
  usualShiftIds: string[]
): { restDays: string[]; customizations: Record<string, DayCustomization> } {
  const restDays: string[] = [];
  const customizations: Record<string, DayCustomization> = {};
  const usualKey = usualShiftIds.join(',');

  for (const d of existingDays) {
    if (d.status === 'DAY_OFF') {
      restDays.push(d.dayOfWeek);
    } else if (d.status === 'UNCONFIGURED') {
      customizations[d.dayOfWeek] = { type: 'unconfigured', shifts: [] };
    } else if (d.status === 'WORKING') {
      const dayKey = getShiftSetKey(d.shifts || []);
      const isUsual = usualShiftIds.length > 0 && dayKey === usualKey;

      if (!isUsual) {
        customizations[d.dayOfWeek] = {
          type: 'working',
          shifts: (d.shifts || []).map((s, i) => ({
            shiftId: s.shiftId || s.shift?.id || '',
            sequence: s.sequence || i + 1
          }))
        };
      }
    }
  }

  return { restDays, customizations };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EmployeeScheduleProfileTab({
  employeeId,
  employeeName,
  readOnly = false,
}: {
  employeeId: string;
  /** Shown in the schedule editor so HR can confirm whose week they are setting. */
  employeeName?: string;
  /** My Profile: the person's own schedule, shown without editing controls. */
  readOnly?: boolean;
}) {
  const [applicableDate, setApplicableDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [weeklySchedule, setWeeklySchedule] = useState<EmployeeWeeklySchedule | null>(null);
  const [legacySchedule, setLegacySchedule] = useState<EmployeeScheduleData | null>(null);
  const [history, setHistory] = useState<ScheduleHistoryLog[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [usualShiftIds, setUsualShiftIds] = useState<string[]>(['']);
  const [restDays, setRestDays] = useState<string[]>([]);
  const [customizations, setCustomizations] = useState<Record<string, DayCustomization>>({});
  const [isMixedSchedule, setIsMixedSchedule] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Customize panel
  const [customizeDay, setCustomizeDay] = useState<string | null>(null);

  // Confirmation dialog
  const [confirmDayOff, setConfirmDayOff] = useState<string | null>(null);

  const { user } = useAuth();
  // HR edits anyone's week; a supervisor edits their direct reports' (the API
  // refuses a supervisor's own). Never from a self view.
  const canEdit = !readOnly && (
    user?.permissionTier === 'FULL' ||
    (user?.permissionTier === 'SUPERVISOR' && user?.employee?.id !== employeeId)
  );

  const activeShifts = useMemo(() => shifts.filter(s => s.isActive), [shifts]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [weeklyRes, legacyRes, histRes, shiftsRes] = await Promise.all([
        weeklyScheduleApi.getEmployeeWeeklySchedule(employeeId, applicableDate),
        scheduleApi.getEmployeeSchedules({ employeeId, applicableDate }),
        scheduleApi.getHistory(employeeId),
        weeklyScheduleApi.listShifts()
      ]);

      setWeeklySchedule(weeklyRes);
      setLegacySchedule(legacyRes.data.find((e: any) => e.id === employeeId) || null);
      setHistory(histRes.filter(h => h.targetEmployeeId === employeeId));
      setShifts(shiftsRes);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load schedule information.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) fetchData();
  }, [employeeId, applicableDate]);

  // ─── Open Editor ─────────────────────────────────────────────────────────

  const openEditor = () => {
    setCustomizeDay(null);
    setConfirmDayOff(null);

    if (weeklySchedule && weeklySchedule.days && weeklySchedule.days.length > 0) {
      // Initialize with the exact effective date of the schedule being edited
      const loadedEffectiveFrom = new Date(weeklySchedule.effectiveFrom);
      setEffectiveFrom(format(loadedEffectiveFrom, 'yyyy-MM-dd'));

      const { usualShiftIds: inferred, isMixed } = inferUsualShifts(weeklySchedule.days);
      setUsualShiftIds(inferred.length > 0 ? inferred : ['']);
      setIsMixedSchedule(isMixed);
      const { restDays: existingRestDays, customizations: existingCustomizations } = hydrateFromExisting(weeklySchedule.days, inferred);
      setRestDays(existingRestDays);
      setCustomizations(existingCustomizations);
    } else {
      setEffectiveFrom(applicableDate);
      setUsualShiftIds(['']);
      setRestDays([]);
      setCustomizations({});
      setIsMixedSchedule(false);
    }

    setIsEditorOpen(true);
  };

  // ─── Build the 7-day preview from current editor state ──────────────────

  const weekPreview = useMemo(() => {
    return WEEKDAYS.map(day => {
      if (restDays.includes(day)) {
        return { day, status: 'DAY_OFF' as const, shifts: [] as { shiftId: string; shift?: ShiftDefinition }[], isCustomized: false };
      }
      const custom = customizations[day];
      if (custom) {
        if (custom.type === 'dayOff') {
          return { day, status: 'DAY_OFF' as const, shifts: [], isCustomized: true };
        }
        if (custom.type === 'unconfigured') {
          return { day, status: 'UNCONFIGURED' as const, shifts: [], isCustomized: true };
        }
        return {
          day,
          status: 'WORKING' as const,
          shifts: custom.shifts.map(s => ({ shiftId: s.shiftId, shift: shifts.find(sh => sh.id === s.shiftId) })),
          isCustomized: true
        };
      }
      if (usualShiftIds.length > 0 && usualShiftIds[0] !== '') {
        return {
          day,
          status: 'WORKING' as const,
          shifts: usualShiftIds.filter(id => id).map(id => ({ shiftId: id, shift: shifts.find(s => s.id === id) })),
          isCustomized: false
        };
      }
      return { day, status: 'UNCONFIGURED' as const, shifts: [], isCustomized: false };
    });
  }, [usualShiftIds, restDays, customizations, shifts]);

  /**
   * Everything that would make `handleSave` reject, listed while HR is still
   * editing. The two use the same rules, so the modal never says "ready" and
   * then refuses the identical configuration on save.
   *
   * An UNCONFIGURED day is NOT a problem — leaving a day unset is a supported
   * state in the weekly schedule model, not a mistake.
   */
  const scheduleProblems = useMemo(() => {
    const problems: string[] = [];

    if (!effectiveFrom) problems.push('Choose the date this schedule starts.');

    const validUsualIds = usualShiftIds.filter(id => id);
    const usualOverlap = validUsualIds.length > 0 ? findOverlap(validUsualIds.map(id => ({ shiftId: id })), shifts) : null;
    if (usualOverlap) {
      problems.push(`Regular shift: ${usualOverlap.split('\n')[0]}`);
    }

    const daysNeedingShift = weekPreview.filter(
      p => p.status === 'WORKING' && (p.shifts.length === 0 || p.shifts.some(s => !s.shiftId))
    );
    if (daysNeedingShift.length === 1) {
      problems.push(`${prettyDay(daysNeedingShift[0].day)} is a working day but still needs a shift.`);
    } else if (daysNeedingShift.length > 1) {
      problems.push(
        `${daysNeedingShift.length} working days still need a shift (${daysNeedingShift.map(p => WEEKDAY_SHORT[p.day]).join(', ')}).`
      );
    }

    for (const p of weekPreview) {
      if (p.status !== 'WORKING' || p.shifts.length < 2) continue;
      const overlap = findOverlap(p.shifts, shifts);
      if (overlap) problems.push(`${prettyDay(p.day)}: ${overlap.split('\n')[0]}`);
    }

    return problems;
  }, [effectiveFrom, usualShiftIds, weekPreview, shifts]);

  // ─── Usual Shift Change ────────────────────────────────────────────────

  const handleUpdateUsualShift = (idx: number, newShiftId: string) => {
    setUsualShiftIds(prev => {
      const next = [...prev];
      next[idx] = newShiftId;
      return next;
    });
    if (newShiftId) setIsMixedSchedule(false);
  };

  const handleAddUsualShift = () => {
    setUsualShiftIds(prev => [...prev, '']);
  };

  const handleRemoveUsualShift = (idx: number) => {
    setUsualShiftIds(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Rest Day Toggle ───────────────────────────────────────────────────

  const toggleRestDay = (day: string) => {
    if (restDays.includes(day)) {
      setRestDays(prev => prev.filter(d => d !== day));
    } else {
      if (customizations[day] && customizations[day].type === 'working' && customizations[day].shifts.length > 0) {
        setConfirmDayOff(day);
      } else {
        setRestDays(prev => [...prev, day]);
        setCustomizations(prev => {
          const next = { ...prev };
          delete next[day];
          return next;
        });
      }
    }
  };

  const confirmSetDayOff = () => {
    if (!confirmDayOff) return;
    setRestDays(prev => [...prev, confirmDayOff]);
    setCustomizations(prev => {
      const next = { ...prev };
      delete next[confirmDayOff];
      return next;
    });
    setConfirmDayOff(null);
  };

  // ─── Customize Day Actions ────────────────────────────────────────────

  const handleChangeShift = (day: string, shiftId: string) => {
    setCustomizations(prev => ({
      ...prev,
      [day]: { type: 'working', shifts: [{ shiftId, sequence: 1 }] }
    }));
  };

  const handleAddShift = (day: string) => {
    setCustomizations(prev => {
      const existing = prev[day];
      const currentShifts = existing?.shifts || [];
      let newShifts = [...currentShifts];
      if (!existing && usualShiftIds.length > 0 && usualShiftIds[0] !== '') {
        newShifts = usualShiftIds.filter(id => id).map((id, idx) => ({ shiftId: id, sequence: idx + 1 }));
      }
      newShifts.push({ shiftId: '', sequence: newShifts.length + 1 });
      return { ...prev, [day]: { type: 'working', shifts: newShifts } };
    });
  };

  const handleUpdateCustomShift = (day: string, idx: number, shiftId: string) => {
    setCustomizations(prev => {
      const existing = prev[day];
      if (!existing) return prev;
      const newShifts = [...existing.shifts];
      newShifts[idx] = { ...newShifts[idx], shiftId };
      return { ...prev, [day]: { ...existing, shifts: newShifts } };
    });
  };

  const handleRemoveCustomShift = (day: string, idx: number) => {
    setCustomizations(prev => {
      const existing = prev[day];
      if (!existing) return prev;
      const newShifts = existing.shifts.filter((_, i) => i !== idx);
      if (newShifts.length === 0) {
        return { ...prev, [day]: { type: 'unconfigured', shifts: [] } };
      }
      return { ...prev, [day]: { ...existing, shifts: newShifts } };
    });
  };

  const handleSetDayOff = (day: string) => {
    setRestDays(prev => [...prev, day]);
    setCustomizations(prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
    setCustomizeDay(null);
  };

  const handleClearDay = (day: string) => {
    setCustomizations(prev => ({
      ...prev,
      [day]: { type: 'unconfigured', shifts: [] }
    }));
    setCustomizeDay(null);
  };

  const handleUseUsualShift = (day: string) => {
    setCustomizations(prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
    setRestDays(prev => prev.filter(d => d !== day));
    setCustomizeDay(null);
  };

  // ─── Save ──────────────────────────────────────────────────────────────

  const checkOverlap = (shiftsArr: { shiftId: string }[]) => findOverlap(shiftsArr, shifts);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      if (!effectiveFrom) throw new Error('Please choose an effective date.');

      const validUsualIds = usualShiftIds.filter(id => id);
      if (validUsualIds.length > 0) {
        const err = checkOverlap(validUsualIds.map(id => ({ shiftId: id })));
        if (err) throw new Error(err);
      }

      const days: EmployeeWeeklyScheduleDay[] = [];
      for (const p of weekPreview) {
        if (p.status === 'DAY_OFF') {
          days.push({ dayOfWeek: p.day, status: 'DAY_OFF', shifts: [] });
        } else if (p.status === 'UNCONFIGURED') {
          days.push({ dayOfWeek: p.day, status: 'UNCONFIGURED', shifts: [] });
        } else {
          if (p.shifts.length === 0) {
            throw new Error(`Please add at least one shift for ${prettyDay(p.day)}, or set it as Day Off.`);
          }
          for (const s of p.shifts) {
            if (!s.shiftId) {
              throw new Error(`Please select a shift for ${prettyDay(p.day)}.`);
            }
          }
          
          const err = checkOverlap(p.shifts);
          if (err) throw new Error(`Error on ${prettyDay(p.day)}: ` + err);

          days.push({
            dayOfWeek: p.day,
            status: 'WORKING',
            shifts: p.shifts.map((s, i) => ({ shiftId: s.shiftId, sequence: i + 1 }))
          });
        }
      }

      await weeklyScheduleApi.saveEmployeeWeeklySchedule(employeeId, effectiveFrom, days);
      setIsEditorOpen(false);
      
      if (applicableDate !== effectiveFrom) {
        setApplicableDate(effectiveFrom);
      } else {
        fetchData();
      }
      
      toast.success('Weekly schedule saved successfully.');
    } catch (err: any) {
      if (!isAxiosError(err) && err?.message) {
        toast.error(err.message); // Our own validation messages, thrown above
      } else {
        // Request failures — including no connection, which has no response
        // either and must not surface as the raw "Network Error".
        toast.error(getApiErrorMessage(err, 'Failed to save weekly schedule.'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Loading / Error ──────────────────────────────────────────────────

  if (isLoading && !weeklySchedule && !legacySchedule) {
    return <div className="p-12 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="p-12 text-center text-danger">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="font-bold">{error}</p>
      </div>
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  const renderReadOnlySchedule = () => {
    if (!weeklySchedule && !legacySchedule?.currentTemplate) {
      return (
        <div className="bg-surface rounded-xl border border-border p-8 text-center shadow-sm">
          <Calendar className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-bold text-foreground mb-1">No Weekly Schedule Yet</p>
          <p className="text-sm text-muted-foreground mb-4">This employee does not have a work schedule yet.</p>
          {canEdit && (
            <Button onClick={openEditor} className="bg-primary text-primary-foreground">
              <CalendarPlus className="h-4 w-4" /> Set Weekly Schedule
            </Button>
          )}
        </div>
      );
    }

    if (weeklySchedule) {
      const { usualShiftIds: inferredIds } = inferUsualShifts(weeklySchedule.days);
      const inferredShifts = inferredIds.map(id => shifts.find(s => s.id === id)).filter(Boolean) as ShiftDefinition[];
      const usualKey = inferredIds.join(',');

      const daysConfig = WEEKDAYS.map(day => {
        const d = weeklySchedule.days?.find(x => x.dayOfWeek === day);
        if (!d) return { day, status: 'UNCONFIGURED', shifts: [] as any[], isCustomized: false };
        if (d.status === 'DAY_OFF') return { day, status: 'DAY_OFF', shifts: [], isCustomized: false };
        if (d.status === 'UNCONFIGURED') return { day, status: 'UNCONFIGURED', shifts: [], isCustomized: false };
        const dayKey = getShiftSetKey(d.shifts || []);
        const isUsual = inferredIds.length > 0 && dayKey === usualKey;
        return {
          day,
          status: 'WORKING',
          shifts: d.shifts || [],
          isCustomized: !isUsual
        };
      });

      return (
        <div className="bg-surface rounded-xl border border-border p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h3 className="font-bold text-sm uppercase text-muted-foreground">Work Schedule</h3>
              {weeklySchedule.effectiveFrom && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Effective From</span>
                  <span className="text-sm font-bold text-foreground">{format(new Date(weeklySchedule.effectiveFrom), 'MMMM d, yyyy')}</span>
                </div>
              )}
              {inferredShifts.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-muted-foreground mt-0.5">Usual Work Shift(s)</span>
                  <div className="flex flex-col gap-0.5">
                    {inferredShifts.map(sh => (
                      <span key={sh.id} className="text-sm font-bold text-foreground">{sh.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {inferredShifts.length === 0 && weeklySchedule.days.some(d => d.status === 'WORKING') && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Schedule</span>
                  <span className="text-sm font-bold text-foreground">Mixed Schedule</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">View for:</span>
              <input type="date" value={applicableDate} onChange={(e) => setApplicableDate(e.target.value)} className="text-xs border rounded px-2 py-1 bg-surface" />
            </div>
          </div>

          <div className="space-y-1">
            {daysConfig.map(config => (
              <div key={config.day} className={`flex items-center gap-4 px-4 py-2.5 rounded-lg transition-colors ${config.status === 'DAY_OFF' ? 'bg-status-warning-surface/50' : config.status === 'UNCONFIGURED' ? 'bg-muted/10' : 'bg-surface'}`}>
                <span className="text-xs font-bold uppercase tracking-wider w-10 text-muted-foreground">{WEEKDAY_SHORT[config.day]}</span>
                <div className="flex-1">
                  {config.status === 'DAY_OFF' && <span className="text-sm font-semibold text-status-warning-foreground">Day Off</span>}
                  {config.status === 'UNCONFIGURED' && <span className="text-sm font-medium text-warning-600 dark:text-warning-400 italic">Needs Setup</span>}
                  {config.status === 'WORKING' && (
                    <div className="flex flex-col gap-0.5">
                      {config.shifts.map((s: any, i: number) => (
                        <span key={i} className="text-sm font-medium text-foreground">
                          {formatTime12h(s.shift?.startTime || s.startTime)} – {formatTime12h(s.shift?.endTime || s.endTime)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {config.isCustomized && config.status === 'WORKING' && (
                  <span className="text-[10px] font-semibold text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">Customized</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Legacy fallback
    if (legacySchedule?.currentTemplate) {
      return (
        <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
          <div className="mb-4 bg-status-warning-surface text-status-warning-foreground text-xs p-2 rounded border border-status-warning-border">
            <strong>Legacy Schedule:</strong> Editing will migrate to the new weekly schedule system.
          </div>
          <h3 className="font-bold text-sm uppercase text-muted-foreground mb-3">Work Schedule</h3>
          <div className="space-y-1">
            {WEEKDAYS.map(day => {
              const d = legacySchedule.currentTemplate?.days?.find(x => x.dayOfWeek === day);
              return (
                <div key={day} className={`flex items-center gap-4 px-4 py-2.5 rounded-lg ${!d ? 'bg-muted/10' : !d.isWorking ? 'bg-status-warning-surface/50' : 'bg-surface'}`}>
                  <span className="text-xs font-bold uppercase tracking-wider w-10 text-muted-foreground">{WEEKDAY_SHORT[day]}</span>
                  {!d && <span className="text-sm font-medium text-warning-600 italic">Needs Setup</span>}
                  {d && !d.isWorking && <span className="text-sm font-semibold text-status-warning-foreground">Day Off</span>}
                  {d && d.isWorking && (
                    <span className="text-sm font-medium text-foreground">
                      {formatTime12h(d.startTime)} – {formatTime12h(d.endTime)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  const formatAction = (action: string) => {
    switch (action) {
      case 'SCHEDULE_CONFIGURED': return 'Weekly Schedule Set';
      case 'SCHEDULE_UPDATED': return 'Weekly Schedule Updated';
      case 'TEMPLATE_ASSIGNED': return 'Schedule Assigned (Legacy)';
      case 'TEMPLATE_REVISED': return 'Schedule Updated (Legacy)';
      case 'SHIFT_CREATED': return 'Shift Created';
      case 'SHIFT_UPDATED': return 'Shift Updated';
      case 'SHIFT_DEACTIVATED': return 'Shift Deactivated';
      default: return action.replace(/_/g, ' ');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-6">

      {/* Current Schedule Section */}
      <motion.section variants={staggerItem} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Work Schedule
          </h2>
          {canEdit && (weeklySchedule || legacySchedule?.currentTemplate) && (
            <Button variant="update" size="sm" onClick={openEditor}>
              <Pencil className="h-4 w-4" /> Edit Schedule
            </Button>
          )}
        </div>

        {renderReadOnlySchedule()}
      </motion.section>

      {/* Schedule History */}
      <motion.section variants={staggerItem} className="space-y-4">
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileClock className="h-5 w-5 text-muted-foreground" /> Schedule History
          </h2>
        </div>

        {history.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-6 text-center text-muted-foreground shadow-sm">
            <p className="font-semibold text-sm">No schedule history found.</p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground font-bold uppercase text-xs">
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 w-full">Details</th>
                  <th className="px-4 py-3">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map(log => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-xs uppercase text-foreground">
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="truncate max-w-[300px]" title={log.remarks || undefined}>
                        {log.remarks || 'Schedule updated.'}
                        {log.newValue?.effectiveDate && (
                          <span className="block mt-0.5 font-semibold text-foreground">
                            Effective: {format(new Date(log.newValue.effectiveDate), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-xs">
                      {log.user?.employee ? `${log.user.employee.firstName} ${log.user.employee.lastName}` : log.user?.email || 'System'}
                      {log.user?.employee?.jobRole && <span className="block text-[10px] text-muted-foreground font-normal">{log.user.employee.jobRole.title}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>

      {/* ─── Editor Modal ──────────────────────────────────────────────── */}
      {isEditorOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/60 p-0 sm:p-6 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekly-schedule-title"
        >
          <div className="bg-surface w-full sm:max-w-[820px] sm:min-w-0 min-h-full sm:min-h-0 sm:max-h-[88vh] flex flex-col sm:rounded-2xl shadow-2xl overflow-hidden sm:border border-border">

            {/* ── Header (stays put) ──────────────────────────────────── */}
            <div className="px-5 sm:px-7 py-5 border-b border-border bg-surface shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 id="weekly-schedule-title" className="font-bold text-xl text-foreground">Configure Weekly Schedule</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set the employee&apos;s regular working shifts and rest days.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  aria-label="Close without saving"
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {employeeName && (
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employee</span>
                    <span className="font-semibold text-foreground">{employeeName}</span>
                  </div>
                )}
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effective from</span>
                  <span className="font-semibold text-foreground">
                    {effectiveFrom ? format(new Date(`${effectiveFrom}T00:00:00`), 'MMMM d, yyyy') : 'Not chosen yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Body (scrolls) ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 bg-muted/10 space-y-6">

              {/* ── 1. Schedule Start Date ───────────────────────────── */}
              <section className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                <h4 className="text-base font-bold text-foreground">1. Schedule Start Date</h4>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  This schedule will apply starting on this date. Previous schedules stay in history.
                </p>
                <label htmlFor="weekly-effective-from" className="block text-sm font-semibold text-foreground mb-1.5">
                  Start date
                </label>
                <input
                  id="weekly-effective-from"
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  className="w-full sm:max-w-xs border border-border rounded-lg px-4 py-3 text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-surface"
                />
              </section>

              {/* ── 2. Regular Shift ─────────────────────────────────── */}
              <section className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                <h4 className="text-base font-bold text-foreground">2. Regular Shift</h4>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Choose the shift the employee normally works. It is applied to every day that is not a rest day and has not been customised.
                </p>

                {activeShifts.length === 0 ? (
                  <div className="flex items-start gap-2 bg-warning-light/60 border border-warning/40 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-warning-dark shrink-0 mt-0.5" />
                    <p className="text-sm text-warning-dark font-medium">
                      No work shifts have been set up yet. Add a shift in the Shift Catalog first, then come back here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {usualShiftIds.map((shiftId, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-muted/10 p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <label htmlFor={`usual-shift-${idx}`} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Shift {idx + 1}
                          </label>
                          {usualShiftIds.length > 1 && (
                            <Button
                              type="button"
                              variant="delete"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => handleRemoveUsualShift(idx)}>
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </Button>
                          )}
                        </div>
                        <select
                          id={`usual-shift-${idx}`}
                          value={shiftId}
                          onChange={e => handleUpdateUsualShift(idx, e.target.value)}
                          className="w-full border border-border rounded-lg px-4 py-3 text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-surface"
                        >
                          <option value="">Select a shift...</option>
                          {activeShifts.map(s => (
                            <option key={s.id} value={s.id}>
                              {describeShift(s)}
                            </option>
                          ))}
                        </select>
                        {shiftId && (
                          <p className="mt-2 text-sm text-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {describeShift(shifts.find(s => s.id === shiftId))}
                          </p>
                        )}
                      </div>
                    ))}

                    {usualShiftIds.every(id => !!id) && (
                      <Button type="button" variant="create" size="sm" onClick={handleAddUsualShift}>
                        <Plus className="h-3.5 w-3.5" /> Add Another Shift
                      </Button>
                    )}
                  </div>
                )}

                {isMixedSchedule && (
                  <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 p-3 rounded-lg mt-4">
                    <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-primary/80 font-medium">
                      This employee works different shifts during the week. Each day has been kept as it is, below. You may pick a regular shift to simplify, or leave each day customised.
                    </p>
                  </div>
                )}
              </section>

              {/* ── 3. Rest Days ─────────────────────────────────────── */}
              <section className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                <h4 className="text-base font-bold text-foreground">3. Rest Day(s)</h4>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Select the employee&apos;s regular rest day(s). You may select more than one.
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {WEEKDAYS.map(day => {
                    const isRest = restDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={isRest}
                        onClick={() => toggleRestDay(day)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isRest
                            ? 'bg-status-warning-surface border-status-warning-foreground text-status-warning-foreground'
                            : 'bg-surface border-border text-foreground hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        <span className="uppercase tracking-wide">{WEEKDAY_SHORT[day]}</span>
                        <span className={`text-[10px] font-semibold uppercase ${isRest ? 'text-status-warning-foreground' : 'text-muted-foreground'}`}>
                          {isRest ? 'Rest day' : 'Working'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── 4. Weekly Preview ────────────────────────────────── */}
              <section className="bg-surface p-5 rounded-xl border border-border shadow-sm">
                <h4 className="text-base font-bold text-foreground">4. Weekly Preview</h4>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  This is exactly what will be saved. Select <strong>Customise</strong> on a day to give it a different shift.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                  {weekPreview.map(p => {
                    const isOpen = customizeDay === p.day;
                    return (
                      <div
                        key={p.day}
                        className={`rounded-xl border-2 p-3 flex flex-col gap-2 ${
                          p.status === 'DAY_OFF'
                            ? 'border-status-warning-border bg-status-warning-surface/70'
                            : p.status === 'UNCONFIGURED'
                              ? 'border-dashed border-warning bg-warning-light/40'
                              : 'border-border bg-muted/10'
                        } ${isOpen ? 'ring-2 ring-primary' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">{WEEKDAY_SHORT[p.day]}</span>
                          {p.isCustomized && p.status === 'WORKING' && (
                            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Custom</span>
                          )}
                        </div>

                        <div className="min-h-[52px]">
                          {p.status === 'DAY_OFF' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-status-warning-foreground">
                              <RotateCcw className="h-3 w-3" /> Rest Day
                            </span>
                          )}
                          {p.status === 'UNCONFIGURED' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-warning-dark">
                              <AlertCircle className="h-3 w-3" /> Needs Setup
                            </span>
                          )}
                          {p.status === 'WORKING' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-success-dark">Working</span>
                              {p.shifts.length === 0 ? (
                                <span className="text-xs text-warning-dark font-medium">No shift chosen</span>
                              ) : (
                                p.shifts.map((s, i) => (
                                  <span key={i} className="text-xs text-foreground leading-tight">
                                    {s.shift ? (
                                      <>
                                        <span className="font-semibold block">{s.shift.name}</span>
                                        <span className="text-muted-foreground">
                                          {formatTime12h(s.shift.startTime)} – {formatTime12h(s.shift.endTime)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-warning-dark font-medium">No shift chosen</span>
                                    )}
                                  </span>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setCustomizeDay(isOpen ? null : p.day)}
                          className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            isOpen ? 'bg-primary text-primary-foreground' : 'bg-surface border border-border text-foreground hover:bg-muted/40'
                          }`}
                        >
                          {isOpen ? 'Close' : 'Customise'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* ── Customise one day ─────────────────────────────── */}
                {customizeDay && (
                  <div className="mt-4 p-4 bg-surface rounded-xl border-2 border-primary/30 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-foreground">Customise {prettyDay(customizeDay)}</h5>
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setCustomizeDay(null)}>
                        <X className="h-3.5 w-3.5" /> Close
                      </Button>
                    </div>

                    {restDays.includes(customizeDay) ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {prettyDay(customizeDay)} is currently a rest day.
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={() => toggleRestDay(customizeDay)}>
                          <Clock className="h-3.5 w-3.5" /> Make it a working day
                        </Button>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const dayPreview = weekPreview.find(p => p.day === customizeDay)!;
                          const rows =
                            customizations[customizeDay]?.shifts ??
                            (dayPreview.shifts.length > 0
                              ? dayPreview.shifts.map((s, i) => ({ shiftId: s.shiftId, sequence: i + 1 }))
                              : []);

                          return (
                            <>
                              {rows.length > 0 && (
                                <div className="space-y-2">
                                  {rows.map((s, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                      <label
                                        htmlFor={`custom-shift-${customizeDay}-${idx}`}
                                        className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:w-16 shrink-0"
                                      >
                                        Shift {idx + 1}
                                      </label>
                                      <select
                                        id={`custom-shift-${customizeDay}-${idx}`}
                                        value={s.shiftId}
                                        onChange={(e) => {
                                          if (!customizations[customizeDay]) {
                                            handleChangeShift(customizeDay, e.target.value);
                                          } else {
                                            handleUpdateCustomShift(customizeDay, idx, e.target.value);
                                          }
                                        }}
                                        className="flex-1 border border-border rounded-lg px-3 py-2.5 text-sm font-medium bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                      >
                                        <option value="">Select a shift...</option>
                                        {activeShifts.map(sh => (
                                          <option key={sh.id} value={sh.id}>{describeShift(sh)}</option>
                                        ))}
                                      </select>
                                      {(customizations[customizeDay]?.shifts?.length ?? 0) > 1 && (
                                        <Button
                                          type="button"
                                          variant="delete"
                                          size="sm"
                                          className="h-9 px-2 text-xs"
                                          onClick={() => handleRemoveCustomShift(customizeDay, idx)}>
                                          <Trash2 className="h-3.5 w-3.5" /> Remove
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {rows.length === 0 && (
                                <p className="text-sm text-warning-dark">
                                  No shift or rest day has been chosen for {prettyDay(customizeDay)} yet.
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                                {rows.length === 0 ? (
                                  <Button
                                    type="button"
                                    variant="create"
                                    size="sm"
                                    disabled={activeShifts.length === 0}
                                    onClick={() => handleChangeShift(customizeDay, activeShifts[0]?.id || '')}>
                                    <Clock className="h-3.5 w-3.5" /> Add Shift
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="create"
                                    size="sm"
                                    disabled={activeShifts.length === 0}
                                    onClick={() => handleAddShift(customizeDay)}>
                                    <Plus className="h-3.5 w-3.5" /> Add Another Shift
                                  </Button>
                                )}
                                <Button type="button" variant="outline" size="sm" onClick={() => handleSetDayOff(customizeDay)}>
                                  Set as Rest Day
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="text-muted-foreground" onClick={() => handleClearDay(customizeDay)}>
                                  Leave Not Set
                                </Button>
                                {(dayPreview.isCustomized || customizations[customizeDay]) && usualShiftIds.filter(id => id).length > 0 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-primary border-primary/30 hover:bg-primary/5"
                                    onClick={() => handleUseUsualShift(customizeDay)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" /> Use Regular Shift
                                  </Button>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* ── Problems found before saving ─────────────────────── */}
              {scheduleProblems.length > 0 && (
                <div className="rounded-xl border border-warning/50 bg-warning-light/60 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-warning-dark shrink-0" />
                    <p className="text-sm font-bold text-warning-dark">Before you can save</p>
                  </div>
                  <ul className="list-disc pl-6 space-y-1">
                    {scheduleProblems.map((problem, i) => (
                      <li key={i} className="text-sm text-warning-dark">{problem}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ── Footer (stays put) ──────────────────────────────────── */}
            <div className="px-5 sm:px-7 py-4 border-t border-border bg-surface shrink-0 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditorOpen(false)}
                className="text-muted-foreground hover:text-foreground w-full sm:w-auto"
              >
                Cancel
              </Button>
              <div className="flex flex-col items-stretch sm:items-end gap-1 w-full sm:w-auto">
                <Button
                  type="button"
                  disabled={isSaving || scheduleProblems.length > 0}
                  onClick={handleSave}
                  title={scheduleProblems.length > 0 ? scheduleProblems[0] : undefined}
                  className="bg-primary text-primary-foreground w-full sm:w-auto sm:min-w-[200px]"
                >
                  {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  {isSaving ? 'Saving...' : 'Save Weekly Schedule'}
                </Button>
                {scheduleProblems.length > 0 && (
                  <p className="text-xs text-warning-dark text-center sm:text-right">{scheduleProblems[0]}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Confirmation Dialog */}
      {confirmDayOff && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-sm rounded-xl border border-border shadow-2xl p-6">
            <h3 className="font-bold text-lg text-foreground mb-2">Make {prettyDay(confirmDayOff)} a Day Off?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              The custom work shift{customizations[confirmDayOff]?.shifts?.length > 1 ? 's' : ''} for {prettyDay(confirmDayOff)} will be removed.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDayOff(null)}>Cancel</Button>
              <Button onClick={confirmSetDayOff} className="bg-primary text-primary-foreground">Set as Day Off</Button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}
