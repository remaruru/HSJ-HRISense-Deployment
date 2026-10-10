import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Clock, FileClock, LayoutTemplate, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpLink } from '@/components/common/HelpLink';
import { useAuth } from '@/hooks/useAuth';
import { staggerContainer, staggerItem } from '@/lib/motion';

import { EmployeeSchedulesTab } from './components/EmployeeSchedulesTab';
import { ScheduleCoverageTab } from './components/ScheduleCoverageTab';
import { ShiftCatalogTab } from './components/ShiftCatalogTab';
import { ScheduleHistoryTab } from './components/ScheduleHistoryTab';

export default function WorkSchedulePage() {
  const { user } = useAuth();
  const tier = user?.permissionTier ?? 'STANDARD';
  const isHR = tier === 'FULL';
  const isSupervisor = tier === 'SUPERVISOR';

  // Hooks must run on EVERY render, in the same order. `useState` used to sit
  // BELOW the STANDARD-employee early return, so the hook count changed with the
  // caller's role and with any role change during a session — React then throws
  // "Rendered more hooks than during the previous render" and unmounts the page.
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'COVERAGE' | 'TEMPLATES' | 'HISTORY'>('EMPLOYEES');

  // STANDARD employees should not see the management tabs.
  if (!isHR && !isSupervisor) {
    return (
      <div className="p-6 max-w-screen-2xl mx-auto text-center">
        <PageHeader icon={<CalendarDays className="h-5 w-5" />} title="My Work Schedule" subtitle="Your assigned work schedule" badgeText="Read Only" />
        <div className="mt-12 bg-surface p-8 rounded-2xl border-2 border-border max-w-lg mx-auto">
          <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-bold text-lg">Schedule Management</h3>
          <p className="text-muted-foreground text-sm mt-2">
            Schedule management is restricted to authorized personnel. 
            You can view your current schedule in your Employee Profile.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'EMPLOYEES', label: 'Employee Schedules', icon: Users, show: true },
    { id: 'COVERAGE', label: 'Schedule Coverage', icon: CalendarDays, show: true },
    { id: 'TEMPLATES', label: 'Shift Catalog', icon: LayoutTemplate, show: isHR },
    { id: 'HISTORY', label: 'History', icon: FileClock, show: true },
  ].filter(t => t.show);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-screen-2xl mx-auto"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title={isHR ? 'Work Schedule Management' : 'Team Work Schedules'}
          subtitle={isHR ? 'Manage employee weekly schedules, shifts, coverage, and schedule history.' : 'View and manage schedules for your direct subordinates.'}
          actions={<HelpLink slug="assign-work-schedules" />}
        />
      </motion.div>

      {/* Tabs */}
      <motion.div variants={staggerItem} className="flex gap-2 border-b-2 border-border overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon as any;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 font-bold text-sm transition-colors relative whitespace-nowrap ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeScheduleTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Content */}
      <div className="pt-2">
        <AnimatePresence mode="wait">
          {activeTab === 'EMPLOYEES' && <EmployeeSchedulesTab key="EMPLOYEES" isHR={isHR} />}
          {activeTab === 'COVERAGE' && <ScheduleCoverageTab key="COVERAGE" isHR={isHR} />}
          {activeTab === 'TEMPLATES' && isHR && <ShiftCatalogTab key="TEMPLATES" />}
          {activeTab === 'HISTORY' && <ScheduleHistoryTab key="HISTORY" isHR={isHR} />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

