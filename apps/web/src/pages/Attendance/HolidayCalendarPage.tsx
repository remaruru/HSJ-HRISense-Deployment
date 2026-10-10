import React, { useState, useEffect } from 'react';
import { CalendarDays, AlertCircle, CheckCircle2, XCircle, Plus, Info, Edit, Trash2, Building2 } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from '@/utils/error-handler.util';

export function HolidayCalendarPage() {
  const { user } = useAuth();
  
  // Use permissionTier === 'FULL' since frontend treats it as Admin/HR access for UI rendering
  const isHR = user?.permissionTier === 'FULL';

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [formData, setFormData] = useState({ date: '', name: '', type: 'HOLIDAY', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Units expected to work on an entry (everyone else observes it).
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [unitsEntry, setUnitsEntry] = useState<any | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [isSavingUnits, setIsSavingUnits] = useState(false);

  useEffect(() => {
    fetchEntries(year);
  }, [year]);

  useEffect(() => {
    if (!isHR) return;
    api.get('/employees/units').then((res) => setUnits(res.data?.data || [])).catch(() => setUnits([]));
  }, [isHR]);

  const openUnitsDialog = (entry: any) => {
    setUnitsEntry(entry);
    setSelectedUnitIds((entry.workingUnits ?? []).map((w: any) => w.unitId));
  };

  const saveWorkingUnits = async () => {
    if (!unitsEntry) return;
    setIsSavingUnits(true);
    setError(null);
    try {
      await api.put(`/holidays/${unitsEntry.id}/working-units`, { unitIds: selectedUnitIds });
      setUnitsEntry(null);
      fetchEntries(year);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to save the working units.'));
    } finally {
      setIsSavingUnits(false);
    }
  };

  const fetchEntries = async (selectedYear: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/holidays', { params: { year: selectedYear } });
      setEntries(res.data.data || []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to fetch holiday calendar.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchSuggestions = async () => {
    if (!isHR) return;
    setIsFetchingSuggestions(true);
    setError(null);
    try {
      await api.post('/holidays/suggestions/fetch', {}, { params: { year } });
      // Reload entries after fetching suggestions
      fetchEntries(year);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to fetch external suggestions.'));
    } finally {
      setIsFetchingSuggestions(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'IGNORED') => {
    if (!isHR) return;
    try {
      await api.patch(`/holidays/suggestions/${id}/status`, { status });
      fetchEntries(year);
    } catch (err: any) {
      setError(getApiErrorMessage(err, `Failed to update status to ${status}.`));
    }
  };

  const handleDeactivateManual = async (id: string) => {
    if (!isHR) return;
    if (
      !confirm(
        'Deactivate this calendar entry?\n\nIt will no longer apply to attendance, but the record is kept for history. This is not a permanent delete.'
      )
    ) {
      return;
    }
    try {
      // Named deactivate endpoint — entries are never hard-deleted because
      // historical attendance is interpreted against them.
      await api.post(`/holidays/manual/${id}/deactivate`);
      fetchEntries(year);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to deactivate entry.'));
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHR) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingEntry) {
        await api.patch(`/holidays/manual/${editingEntry.id}`, {
          name: formData.name,
          type: formData.type,
          notes: formData.notes
        });
      } else {
        await api.post('/holidays/manual', formData);
      }
      setIsModalOpen(false);
      fetchEntries(year);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to save calendar entry.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setEditingEntry(null);
    setFormData({ date: '', name: '', type: 'HOLIDAY', notes: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (entry: any) => {
    setEditingEntry(entry);
    setFormData({ 
      date: entry.date.split('T')[0], 
      name: entry.name, 
      type: entry.type, 
      notes: entry.notes || '' 
    });
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string, source: string) => {
    switch(status) {
      case 'APPROVED': return <span className="bg-success-light text-success-dark px-2 py-1 rounded-md text-xs font-bold uppercase">Approved</span>;
      case 'PENDING': return <span className="bg-warning-light text-warning-dark px-2 py-1 rounded-md text-xs font-bold uppercase">Pending</span>;
      case 'IGNORED': return <span className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs font-bold uppercase">{source === 'MANUAL' ? 'Deactivated' : 'Ignored'}</span>;
      default: return <span className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs font-bold uppercase">{status}</span>;
    }
  };

  const visibleEntries = isHR ? entries : entries.filter(e => e.status === 'APPROVED');

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title="Holiday & Work Calendar"
          subtitle="Manage organization-wide non-working days and special holidays."
        />
        <div className="flex items-center gap-3">
          <select 
            value={year.toString()} 
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="border-2 border-border rounded-xl px-3 py-2 text-sm font-bold bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {[year - 1, year, year + 1].map(y => (
              <option key={y} value={y.toString()}>{y}</option>
            ))}
          </select>

          {isHR && (
            <>
              <button 
                onClick={handleFetchSuggestions} 
                disabled={isFetchingSuggestions}
                className="px-4 py-2 border-2 border-border rounded-xl text-sm font-bold hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isFetchingSuggestions ? 'Fetching...' : 'Load API Suggestions'}
              </button>
              <button 
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Calendar Entry
              </button>
            </>
          )}
        </div>
      </motion.div>

      {error && (
        <motion.div variants={staggerItem} className="bg-danger-light border-2 border-danger text-danger-dark p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h4 className="font-bold text-sm">Error</h4>
            <p className="text-xs">{error}</p>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="bg-surface rounded-2xl border-2 border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/60 text-muted-foreground font-bold uppercase tracking-wider text-xs">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Who Works</th>
                {isHR && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={isHR ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    Loading calendar entries...
                  </td>
                </tr>
              ) : visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={isHR ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground font-medium">
                    No calendar entries found for {year}.
                  </td>
                </tr>
              ) : (
                visibleEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-bold text-foreground whitespace-nowrap">
                      {format(new Date(entry.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{entry.name}</td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-muted-foreground font-medium">{entry.type.toLowerCase().replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4">
                      {entry.source === 'HOLIDAY_API' ? (
                        <span className="flex items-center text-xs text-info-dark bg-info-light border border-info/30 px-2 py-1 rounded-md w-max font-bold">
                          <Info className="h-3 w-3 mr-1" /> API
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted border border-border px-2 py-1 rounded-md font-bold">Manual</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(entry.status, entry.source)}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {entry.workingUnits?.length ? (
                        <span className="text-foreground">
                          <span className="font-semibold">Works:</span>{' '}
                          {entry.workingUnits.map((w: any) => w.unit?.name).filter(Boolean).join(', ')}
                          <span className="block text-muted-foreground">All other units observe it</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">All units observe it</span>
                      )}
                    </td>
                    {isHR && (
                      <td className="px-6 py-4 text-right">
                        <div className="mb-1.5 flex justify-end">
                          <Button variant="outline" size="xs" className="gap-1" title="Units expected to work on this day" onClick={() => openUnitsDialog(entry)}>
                            <Building2 /> Working units
                          </Button>
                        </div>
                        {/* Row actions stay visible: one that only appears on
                            hover cannot be reached by touch or by keyboard. */}
                        {entry.status === 'PENDING' && entry.source === 'HOLIDAY_API' ? (
                          <div className="flex justify-end gap-2">
                            <button className="h-8 px-3 rounded-lg text-xs font-bold text-success-dark bg-success-light border border-success/30 hover:bg-success hover:text-success-foreground transition-colors" onClick={() => handleUpdateStatus(entry.id, 'APPROVED')}>
                              Approve
                            </button>
                            <button className="h-8 px-3 rounded-lg text-xs font-bold text-muted-foreground bg-muted border border-border hover:bg-danger hover:text-danger-foreground transition-colors" onClick={() => handleUpdateStatus(entry.id, 'IGNORED')}>
                              Ignore
                            </button>
                          </div>
                        ) : entry.source === 'MANUAL' ? (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="update" size="xs" className="w-8 p-0" title="Edit entry" onClick={() => openEditModal(entry)}>
                              <Edit />
                            </Button>
                            <Button variant="delete" size="xs" className="w-8 p-0" title="Delete entry" onClick={() => handleDeactivateManual(entry.id)}>
                              <Trash2 />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground opacity-50">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Working units dialog */}
      {unitsEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="working-units-title">
          <div className="bg-surface w-full max-w-md rounded-2xl border-2 border-border shadow-xl overflow-hidden">
            <div className="p-4 border-b-2 border-border bg-muted/30 flex justify-between items-center">
              <h3 id="working-units-title" className="font-bold">Units expected to work</h3>
              <button onClick={() => setUnitsEntry(null)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-foreground">
                <strong>{unitsEntry.name}</strong> · {format(new Date(unitsEntry.date), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">
                Tick the units that keep working on this day. Their employees follow their normal schedule, and punches on this day
                are not flagged as worked-on-holiday. Every unit left unticked observes the entry.
              </p>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {units.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedUnitIds.includes(u.id)}
                      onChange={(e) => setSelectedUnitIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))}
                    />
                    {u.name}
                  </label>
                ))}
                {units.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No units found.</p>}
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setUnitsEntry(null)} className="px-4 py-2 border-2 border-border rounded-xl text-sm font-bold hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={saveWorkingUnits} disabled={isSavingUnits} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {isSavingUnits ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-surface w-full max-w-md rounded-2xl border-2 border-border shadow-xl overflow-hidden"
          >
            <div className="p-4 border-b-2 border-border bg-muted/30 flex justify-between items-center">
              <h3 className="font-bold">{editingEntry ? 'Edit Manual Entry' : 'Add Calendar Entry'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <form onSubmit={handleSubmitManual} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Date</label>
                  <input 
                    type="date" 
                    required
                    disabled={!!editingEntry} // Cannot edit date of existing entry easily, only deactivate
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Founder's Day"
                    className="w-full border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="HOLIDAY">Holiday</option>
                    <option value="SPECIAL_NON_WORKING">Special Non-Working</option>
                    <option value="ORGANIZATION_NON_WORKING">Organization Non-Working</option>
                    <option value="SUSPENSION">Suspension</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Notes (Optional)</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="w-full border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border-2 border-border rounded-xl text-sm font-bold hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Entry'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
