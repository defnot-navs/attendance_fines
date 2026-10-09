import React from 'react';
import { Users, CalendarCheck, Coins, CalendarDays } from 'lucide-react';

const TONES = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  purple: 'bg-purple-100 text-purple-600',
};

// Four headline stat cards driven by useDashboardStats().
export default function StatCards({ stats }) {
  const items = [
    { label: 'Total Students', value: stats.totalStudents, Icon: Users, tone: 'blue' },
    {
      label: 'Attendance Today',
      value: stats.attendanceRate == null ? '—' : `${stats.attendanceRate}%`,
      Icon: CalendarCheck,
      tone: 'green',
    },
    { label: 'Pending Fines', value: stats.pendingFines, Icon: Coins, tone: 'amber' },
    { label: 'Active Events', value: stats.activeEvents, Icon: CalendarDays, tone: 'purple' },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {items.map(({ label, value, Icon, tone }) => (
        <div
          key={label}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex items-center gap-3 sm:gap-4"
        >
          <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 ${TONES[tone]}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500 truncate">{label}</p>
            {stats.loading ? (
              <div className="h-7 w-14 mt-1 rounded bg-slate-100 animate-pulse" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{value}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
