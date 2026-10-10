import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, AlertCircle, RefreshCw, Archive, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { weeklyScheduleApi, ShiftDefinition } from '@/services/api/weekly-schedule';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/error-handler.util';


function formatTime12h(timeStr: string) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

export function ShiftCatalogTab() {
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftDefinition | null>(null);
  const [deactivateShiftId, setDeactivateShiftId] = useState<string | null>(null);
  
  // Editor state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'OFFICE' | 'SHIFT'>('SHIFT');
  const [startTime, setStartTime] = useState('08:00:00');
  const [endTime, setEndTime] = useState('17:00:00');
  
  const [isSaving, setIsSaving] = useState(false);

  const fetchShifts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await weeklyScheduleApi.listShifts();
      setShifts(data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load shift definitions.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleOpenNew = () => {
    setEditingShift(null);
    setName('');
    setDescription('');
    setCategory('SHIFT');
    setStartTime('08:00:00');
    setEndTime('17:00:00');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shift: ShiftDefinition) => {
    setEditingShift(shift);
    setName(shift.name);
    setDescription(shift.description || '');
    setCategory(shift.category);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deactivateShiftId) return;
    
    try {
      await weeklyScheduleApi.deactivateShift(deactivateShiftId);
      toast.success('Shift deactivated.');
      setDeactivateShiftId(null);
      fetchShifts();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to deactivate shift.'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startTime || !endTime) return;
    
    setIsSaving(true);
    try {
      if (editingShift) {
        await weeklyScheduleApi.updateShift(editingShift.id, {
          name, description, category, startTime, endTime
        });
        toast.success('Shift updated successfully.');
      } else {
        await weeklyScheduleApi.createShift({
          name, description, category, startTime, endTime
        });
        toast.success('Shift created successfully.');
      }
      setIsModalOpen(false);
      fetchShifts();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to save shift.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchShifts} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <span className="text-sm text-muted-foreground font-semibold bg-muted/30 px-3 py-1 rounded-full border border-border">
            {shifts.length} Active Shifts
          </span>
        </div>
        <Button variant="create" onClick={handleOpenNew} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Create Shift
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="bg-surface rounded-2xl border-2 border-border p-12 flex justify-center shadow-sm">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-surface rounded-2xl border-2 border-border p-12 text-center text-danger shadow-sm">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-bold">{error}</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-surface rounded-2xl border-2 border-border p-12 text-center text-muted-foreground shadow-sm">
          <Archive className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="font-bold">No active shifts found.</p>
          <p className="text-sm mt-1">Create a new shift definition to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-surface rounded-xl border border-border shadow-sm flex flex-col hover:border-primary/40 transition-colors">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{shift.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        {shift.category === 'OFFICE' ? 'Office Hours' : 'Shift'}
                      </span>
                      {shift.isActive && <span className="text-[10px] font-semibold text-success-700 bg-success-50 px-2 py-0.5 rounded-full border border-success-200">Active</span>}
                    </div>
                  </div>
                </div>
                
                <div className="my-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-medium tracking-tight text-foreground">
                      {formatTime12h(shift.startTime)} → {formatTime12h(shift.endTime)}
                    </span>
                  </div>
                  {shift.endTime < shift.startTime && (
                    <div className="mt-1 text-xs font-semibold text-status-accent-foreground bg-status-accent-surface px-2 py-0.5 rounded-md inline-flex items-center border border-status-accent-border">
                      Overnight Shift
                    </div>
                  )}
                </div>

                {shift.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {shift.description}
                  </p>
                )}
              </div>
              
              <div className="border-t border-border p-3 flex justify-end gap-2 bg-muted/5 rounded-b-xl">
                <Button variant="update" size="sm" onClick={() => handleOpenEdit(shift)}>
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
                <Button variant="delete" size="sm"  onClick={() => setDeactivateShiftId(shift.id)}>
                  <Trash2 className="h-4 w-4" /> Deactivate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-surface w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden my-8"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10">
                <h3 className="font-bold text-lg text-foreground">{editingShift ? 'Edit Shift' : 'Create New Shift'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              
              <div className="p-6">
                <form onSubmit={handleSave} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Shift Name</label>
                    <input 
                      type="text" 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Office 8AM-5PM"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-surface transition-shadow"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Type</label>
                    <select 
                      required 
                      value={category} 
                      onChange={e => setCategory(e.target.value as any)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-surface transition-shadow"
                    >
                      <option value="OFFICE">Office Hours</option>
                      <option value="SHIFT">Shift</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Start Time</label>
                      <input 
                        type="time" 
                        required 
                        value={startTime} 
                        onChange={e => setStartTime(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-surface transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">End Time</label>
                      <input 
                        type="time" 
                        required 
                        value={endTime} 
                        onChange={e => setEndTime(e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-surface transition-shadow"
                      />
                    </div>
                  </div>

                  {/* Time Preview */}
                  {startTime && endTime && (
                    <div className="text-sm font-medium text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border">
                      {formatTime12h(startTime)} → {formatTime12h(endTime)}{endTime < startTime ? ' next day' : ''}
                      {endTime < startTime && (
                        <span className="ml-2 text-xs font-semibold text-status-accent-foreground bg-status-accent-surface px-2 py-0.5 rounded-md border border-status-accent-border">
                          Overnight Shift
                        </span>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Description (Optional)</label>
                    <textarea 
                      value={description} 
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Optional details about this shift..."
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px] bg-surface resize-none transition-shadow"
                    />
                  </div>

                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg flex gap-3 text-xs text-primary/90 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <div>
                      Changes will apply to future schedules. Previous schedules are not affected.
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-border mt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSaving} className="min-w-[120px]">
                      {isSaving ? 'Saving...' : editingShift ? 'Save Changes' : 'Create Shift'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deactivate Dialog */}
      <AnimatePresence>
        {deactivateShiftId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface w-full max-w-sm rounded-xl border border-border shadow-2xl p-6"
            >
              <h3 className="font-bold text-lg text-foreground mb-2">Deactivate Shift</h3>
              <p className="text-sm text-muted-foreground mb-6">
                This shift will no longer be available for new schedules. Existing schedules using this shift are not affected.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDeactivateShiftId(null)}>Cancel</Button>
                <Button variant="delete" onClick={handleDelete}>Deactivate</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
