import React from 'react';
import { Home, QrCode, Upload, CalendarDays, DollarSign, ArrowRight } from 'lucide-react';
import PageHeading from './common/PageHeading';
import StatCards from './common/StatCards';
import useDashboardStats from '../hooks/useDashboardStats';
import { formatCurrency } from '../utils/finesCalculator';

const goTo = (tab) => window.dispatchEvent(new CustomEvent('switchTab', { detail: tab }));

const QUICK_ACTIONS = [
  { tab: 'scanner', label: 'Scan attendance', hint: 'Open the QR scanner', Icon: QrCode },
  { tab: 'upload', label: 'Upload members', hint: 'Import a student list', Icon: Upload },
  { tab: 'events', label: 'Manage events', hint: 'Create or edit events', Icon: CalendarDays },
  { tab: 'fines', label: 'Review fines', hint: 'See who owes what', Icon: DollarSign },
];

export default function Dashboard() {
  const stats = useDashboardStats();

  return (
    <div className="space-y-5">
      <PageHeading icon={Home} title="Dashboard" subtitle="Overview of attendance, fines and events" />
      <StatCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Upcoming events</h3>
            <button onClick={() => goTo('events')} className="text-sm text-blue-600 hover:underline">
              View all
            </button>
          </div>
          {stats.loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}
            </div>
          ) : stats.upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No upcoming events. Create one in the Events tab.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.upcomingEvents.slice(0, 5).map((event) => (
                <li key={event.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{event.name}</p>
                    <p className="text-xs text-slate-500">{new Date(event.date).toLocaleDateString()}</p>
                  </div>
                  {event.fineAmount != null && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 whitespace-nowrap">
                      Fine {formatCurrency(event.fineAmount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Outstanding fines</h3>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.pendingAmount)}</p>
          <p className="text-xs text-slate-500 mb-4">across {stats.pendingFines} unpaid fine{stats.pendingFines === 1 ? '' : 's'}</p>
          <div className="space-y-2">
            {QUICK_ACTIONS.map(({ tab, label, hint, Icon }) => (
              <button
                key={tab}
                onClick={() => goTo(tab)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-left transition-colors group"
              >
                <span className="p-2 rounded-lg bg-blue-50 text-blue-600"><Icon className="w-4 h-4" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
