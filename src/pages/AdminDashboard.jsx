import React, { useState, useEffect } from 'react';
import {
  Home, ClipboardList, Upload, Users, Calendar as CalendarIcon, DollarSign, Settings as SettingsIcon,
  CalendarDays, FileText, GraduationCap, CreditCard, QrCode, Menu, X, Video, UserCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import QRScanner from '../components/QRScanner';
import MemberUpload from '../components/MemberUpload';
import OnlineMeetingParser from '../components/OnlineMeetingParser';
import AttendanceLogs from '../components/AttendanceLogs';
import FinesSummary from '../components/FinesSummary';
import Settings from '../components/Settings';
import OnlineStatus from '../components/OnlineStatus';
import EventsManagement from '../components/EventsManagement';
import ExcuseManagement from '../components/ExcuseManagement';
import StudentsManagement from '../components/StudentsManagement';
import MembershipRegistration from '../components/MembershipRegistration';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'scanner', label: 'QR Scanner', icon: QrCode },
  { id: 'upload', label: 'Upload Members', icon: Upload },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'excuses', label: 'Excuses', icon: FileText },
  { id: 'membership', label: 'Membership', icon: CreditCard },
  { id: 'online', label: 'Online Meeting', icon: Video },
  { id: 'attendance', label: 'Attendance Logs', icon: ClipboardList },
  { id: 'fines', label: 'Fines Summary', icon: DollarSign },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);

  // Listen for tab switch events from other components
  useEffect(() => {
    const handleSwitchTab = (event) => {
      if (event.detail) setActiveTab(event.detail);
    };
    window.addEventListener('switchTab', handleSwitchTab);
    return () => window.removeEventListener('switchTab', handleSwitchTab);
  }, []);

  const selectTab = (id) => {
    setActiveTab(id);
    if (!isDesktop()) setSidebarOpen(false);
  };

  const current = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0b1a3a] text-slate-300 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Users className="w-8 h-8 text-blue-400" />
            <span className="text-xl font-bold text-white tracking-tight">
              Attend<span className="text-blue-400">Ease</span>
            </span>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => selectTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-blue-600/40 text-white shadow-inner'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-white/10 text-xs text-slate-500">
          Attendance &amp; Fines Management
        </div>
      </aside>

      {/* Main column */}
      <div className={`transition-[padding] duration-200 ${sidebarOpen ? 'lg:pl-64' : ''}`}>
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between gap-3 px-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Toggle menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav className="hidden sm:flex items-center gap-2 text-sm min-w-0" aria-label="Breadcrumb">
              <span className="text-slate-500">Admin</span>
              <span className="text-slate-300">/</span>
              <span className="text-blue-600 font-medium truncate">{current.label}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <OnlineStatus />
            <Link
              to="/scan"
              className="flex items-center gap-2 border border-emerald-500 text-emerald-700 bg-white px-3 py-2 rounded-lg hover:bg-emerald-50 text-sm font-medium touch-manipulation"
              title="Open QR Scanner (for mobile devices)"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden md:inline">Mobile Scanner</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
              <UserCircle className="w-8 h-8 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Admin</span>
            </div>
          </div>
        </header>

        <main key={activeTab} className="tab-in max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'scanner' && <QRScanner selectedEventId={selectedEventId} />}
          {activeTab === 'upload' && <MemberUpload />}
          {activeTab === 'students' && <StudentsManagement />}
          {activeTab === 'events' && <EventsManagement onEventSelect={setSelectedEventId} />}
          {activeTab === 'excuses' && <ExcuseManagement />}
          {activeTab === 'membership' && <MembershipRegistration />}
          {activeTab === 'online' && <OnlineMeetingParser selectedEventId={selectedEventId} />}
          {activeTab === 'attendance' && <AttendanceLogs />}
          {activeTab === 'fines' && <FinesSummary />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
