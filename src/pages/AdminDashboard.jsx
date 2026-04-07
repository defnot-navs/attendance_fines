import React, { useState } from 'react';
import { ClipboardList, Upload, Users, Calendar as CalendarIcon, DollarSign, Settings as SettingsIcon, CalendarDays, FileText, UserCheck, CreditCard, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [selectedEventId, setSelectedEventId] = useState(null);

  // Listen for tab switch events from other components
  React.useEffect(() => {
    const handleSwitchTab = (event) => {
      if (event.detail) {
        setActiveTab(event.detail);
      }
    };
    window.addEventListener('switchTab', handleSwitchTab);
    return () => window.removeEventListener('switchTab', handleSwitchTab);
  }, []);

  const tabs = [
    { id: 'scanner', label: 'QR Scanner', icon: ClipboardList },
    { id: 'upload', label: 'Upload Members', icon: Upload },
    { id: 'students', label: 'Students', icon: UserCheck },
    { id: 'events', label: 'Events', icon: CalendarDays },
    { id: 'excuses', label: 'Excuses', icon: FileText },
    { id: 'membership', label: 'Membership', icon: CreditCard },
    { id: 'online', label: 'Online Meeting', icon: Users },
    { id: 'attendance', label: 'Attendance Logs', icon: CalendarIcon },
    { id: 'fines', label: 'Fines Summary', icon: DollarSign },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600">Attendance & Fines Management System</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/scan"
                className="flex items-center gap-1 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 active:bg-green-800 text-xs sm:text-sm touch-manipulation"
                title="Open QR Scanner (for mobile devices)"
              >
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Mobile Scanner</span>
                <span className="sm:hidden">Scan</span>
              </Link>
              <OnlineStatus />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <nav className="flex flex-nowrap sm:flex-wrap gap-1 overflow-x-auto sm:overflow-visible scrollbar-hide -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
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
  );
}
