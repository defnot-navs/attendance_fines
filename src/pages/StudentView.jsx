import React, { useState, useRef } from 'react';
import {
  Search, Calendar, User, CheckCircle, XCircle, Clock, FileText, GraduationCap, Eye, HelpCircle,
  Lock, PieChart, Coins, Users, ArrowLeft,
} from 'lucide-react';
import { getStudentByStudentId, getStudentAttendance, getStudentFines, getAllEvents } from '../db/hybridDatabase';
import { cacheStudentPortalSnapshot } from '../db/database';
import { formatCurrency } from '../utils/finesCalculator';
import { formatTime12Hour } from '../utils/timeFormatter';
import { notify } from '../utils/toast';
import DataTable from '../components/common/DataTable';

const SAMPLE_ROWS = [
  { date: 'Jul 21, 2025', event: 'General Assembly', status: 'present', remarks: '-' },
  { date: 'Jul 18, 2025', event: 'Advanced Programming', status: 'late', remarks: '5 mins late' },
  { date: 'Jul 16, 2025', event: 'Team Building', status: 'present', remarks: '-' },
  { date: 'Jul 14, 2025', event: 'Web Development', status: 'absent', remarks: 'No excuse' },
  { date: 'Jul 11, 2025', event: 'General Assembly', status: 'present', remarks: '-' },
];

const STATUS_PILL = {
  present: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', label: 'Present' },
  late: { cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', label: 'Late' },
  absent: { cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500', label: 'Absent' },
  excused: { cls: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500', label: 'Excused' },
  not_included: { cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', label: 'Not Included' },
};

function StatusPill({ status }) {
  const s = STATUS_PILL[status] || STATUS_PILL.not_included;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {String(status || '').toLowerCase() in STATUS_PILL ? s.label : String(status || '').toUpperCase()}
    </span>
  );
}

function MiniStat({ icon: Icon, label, value, tone }) {
  const tones = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    red: 'bg-red-50 border-red-200 text-red-600',
  };
  const [bg, border, text] = tones[tone].split(' ');
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 flex items-center gap-4`}>
      <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shrink-0">
        <Icon className={`w-6 h-6 ${text}`} />
      </div>
      <div>
        <p className="text-xs sm:text-sm text-slate-600">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children, id }) {
  return (
    <section id={id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 scroll-mt-24">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Icon className="w-5 h-5" /></span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function StudentView() {
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [fines, setFines] = useState([]);
  const [totalFines, setTotalFines] = useState(0);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventAttendance, setEventAttendance] = useState({});
  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!studentId.trim()) {
      setError('Please enter your Student ID');
      return;
    }

    setLoading(true);
    setError(null);
    setStudent(null);

    try {
      // Get student info
      const studentData = await getStudentByStudentId(studentId.trim());

      if (!studentData) {
        setError('Student ID not found');
        setLoading(false);
        return;
      }

      // Get attendance and fines
      const [attendanceData, finesData, allEvents] = await Promise.all([
        getStudentAttendance(studentId.trim()),
        getStudentFines(studentId.trim()),
        getAllEvents()
      ]);

      const total = finesData
        .filter(f => !f.paid)
        .reduce((sum, fine) => sum + Number(fine.amount || 0), 0);

      // Group attendance by event
      const eventAttMap = {};
      for (const event of allEvents) {
        const eventAtt = attendanceData.find(a => a.eventId === event.id);
        eventAttMap[event.id] = eventAtt || null;
      }

      // Cache for offline viewing on this device (best-effort)
      cacheStudentPortalSnapshot({
        student: studentData,
        attendance: attendanceData,
        fines: finesData,
        events: allEvents,
      }).catch((e) => console.warn('Student snapshot cache failed:', e));

      setStudent(studentData);
      setAttendance(attendanceData);
      setFines(finesData);
      setTotalFines(total);
      setEvents(allEvents);
      setEventAttendance(eventAttMap);
    } catch (err) {
      setError('Error loading data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setStudent(null);
    setStudentId('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const getTargetYearFromEvent = (event) => {
    const text = `${event?.name || ''} ${event?.description || ''}`;
    const match = text.match(/Target\s*:\s*(\d)(?:st|nd|rd|th)?\s*Year/i);
    if (!match) return null;

    const targetYear = Number(match[1]);
    return Number.isFinite(targetYear) ? targetYear : null;
  };

  const normalizeId = (value) => {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
  };

  const findEventName = (eventId) => (
    events.find((e) => normalizeId(e.id) === normalizeId(eventId))?.name || 'General / No Event'
  );

  // Per-event status, shared by the event list and the summary stats
  const eventStatus = (event) => {
    const att = eventAttendance[event.id];
    const targetYear = getTargetYearFromEvent(event);
    const isIncludedByTarget = targetYear === null || Number(student.yearLevel) === targetYear;
    const hasFineForEvent = fines.some(f => f.eventId === event.id);
    const isLegacySelectiveOnlineEvent =
      !att &&
      !hasFineForEvent &&
      (event.description || '').toLowerCase().includes('online meeting attendance');
    const isIncluded = isIncludedByTarget && !isLegacySelectiveOnlineEvent;
    return { att, status: !isIncluded ? 'not_included' : att ? att.status : 'absent' };
  };

  const attendanceStats = (() => {
    if (!student) return { rate: 0, attended: 0 };
    const statuses = events.map((ev) => eventStatus(ev).status).filter((s) => s !== 'not_included');
    const attended = statuses.filter((s) => s === 'present' || s === 'late').length;
    const counted = statuses.filter((s) => s !== 'excused').length;
    return { attended, rate: counted ? Math.round((attended / counted) * 100) : 0 };
  })();

  const attendanceColumns = [
    { key: 'date', header: 'Date', sortable: true, accessor: (row) => row.date },
    {
      key: 'event',
      header: 'Event',
      sortable: true,
      accessor: (row) => findEventName(row.eventId),
      render: (row) => findEventName(row.eventId),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      accessor: (row) => row.type,
      render: (row) => String(row.type || '').toUpperCase(),
      cellClassName: 'text-gray-600',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  const fineColumns = [
    { key: 'date', header: 'Date', sortable: true, accessor: (row) => row.date },
    {
      key: 'event',
      header: 'Event',
      sortable: true,
      accessor: (row) => findEventName(row.eventId),
      render: (row) => findEventName(row.eventId),
    },
    { key: 'reason', header: 'Reason', sortable: true, accessor: (row) => row.reason, cellClassName: 'text-gray-600' },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      accessor: (row) => Number(row.amount || 0),
      render: (row) => <span className="font-semibold text-red-600">{formatCurrency(row.amount)}</span>,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
  ];

  const scrollTo = (id) => {
    if (!student) {
      notify('Enter your Student ID above to see your records.', 'info');
      inputRef.current?.focus();
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const FEATURES = [
    { id: 'sec-attendance', title: 'Attendance History', text: 'View your daily attendance and status records.', Icon: Calendar, tone: 'bg-blue-100 text-blue-600' },
    { id: 'sec-fines', title: 'Fine Summary', text: 'Check your outstanding fines and payment status.', Icon: Coins, tone: 'bg-emerald-100 text-emerald-600' },
    { id: 'sec-events', title: 'Event Records', text: 'See your event participation and activity history.', Icon: Users, tone: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-50 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-blue-100/60" aria-hidden="true" />
      <div className="pointer-events-none absolute top-40 -right-32 w-96 h-96 rounded-full border-[40px] border-blue-100/50" aria-hidden="true" />

      {/* Top bar */}
      <header className="relative z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-blue-600" />
            <span className="text-lg sm:text-xl font-bold text-slate-900">
              Attend<span className="text-blue-600">Ease</span>
            </span>
            <span className="hidden sm:block h-6 w-px bg-slate-300" />
            <span className="hidden sm:block text-slate-500">Student Portal</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              <Eye className="w-3.5 h-3.5" /> View-only access
            </span>
            <button
              onClick={() => notify('Need a correction? Contact your administrator with your Student ID.', 'info')}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600"
            >
              <HelpCircle className="w-4 h-4" /> Need Help?
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0b1a3a] tracking-tight">
            Your attendance, all in one place
          </h1>
          <p className="text-slate-600 mt-3 text-sm sm:text-base">
            Check your attendance records, event participation, and outstanding fines.
          </p>
        </div>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg shadow-blue-900/5 p-4 sm:p-6"
        >
          <label htmlFor="student-id" className="block text-sm font-semibold text-slate-900 mb-2">
            Student ID
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="student-id"
                ref={inputRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 2024-00123"
                className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-base"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 flex items-center justify-center gap-2 font-semibold shadow-sm whitespace-nowrap"
            >
              <Search className="w-5 h-5" />
              {loading ? 'Searching…' : 'Find My Records'}
            </button>
          </div>
          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </form>

        {/* Feature cards */}
        {!student && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto mt-6">
              {FEATURES.map(({ id, title, text, Icon, tone }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 text-left hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{text}</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-6">
              <Lock className="w-3.5 h-3.5" />
              Your records are private. Only you can view records using your Student ID.
            </p>

            {/* Sample preview */}
            <section className="mt-10 bg-white/80 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 flex items-start gap-3 bg-slate-50 border-b border-slate-200">
                <div className="p-2 rounded-full bg-blue-100 text-blue-600"><Eye className="w-5 h-5" /></div>
                <div>
                  <h2 className="font-bold text-slate-900">Sample Preview</h2>
                  <p className="text-xs text-slate-500">
                    This is a sample of how your records will look. The data below is for preview purposes only and does not
                    reflect your actual records.
                  </p>
                </div>
              </div>
              <div className="p-4 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <MiniStat icon={PieChart} label="Attendance Rate" value="92%" tone="green" />
                  <MiniStat icon={Calendar} label="Events Attended" value="12" tone="purple" />
                  <MiniStat icon={Coins} label="Outstanding Fines" value="₱70.00" tone="red" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900">Recent Attendance Records</h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">Sample Data</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Event / Class</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_ROWS.map((row, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.date}</td>
                            <td className="px-4 py-2 text-slate-700">{row.event}</td>
                            <td className="px-4 py-2"><StatusPill status={row.status} /></td>
                            <td className="px-4 py-2 text-slate-500">{row.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Student results */}
        {student && (
          <div className="space-y-5 mt-8">
            <div className="flex items-center justify-between">
              <button onClick={resetSearch} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <ArrowLeft className="w-4 h-4" /> Search another student
              </button>
            </div>

            {/* Student Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                    {student.lastName}, {student.firstName} {student.middleInitial}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-600">
                    <span>Student ID: {student.studentId}</span>
                    {student.program && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                        {student.program}
                      </span>
                    )}
                    {student.yearLevel && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {student.yearLevel}{['st', 'nd', 'rd', 'th'][student.yearLevel > 3 ? 3 : student.yearLevel - 1]} Year
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5">
                <MiniStat icon={PieChart} label="Attendance Rate" value={events.length ? `${attendanceStats.rate}%` : '—'} tone="green" />
                <MiniStat icon={Calendar} label="Events Attended" value={attendanceStats.attended} tone="purple" />
                <MiniStat icon={Coins} label="Outstanding Fines" value={formatCurrency(totalFines)} tone="red" />
              </div>
            </div>

            {/* Attendance History */}
            <SectionCard id="sec-attendance" icon={Calendar} title="Attendance History">
              {attendance.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No attendance records found</p>
              ) : (
                <DataTable
                  columns={attendanceColumns}
                  data={attendance}
                  rowKey={(row) => row.id}
                  initialSortKey="date"
                  initialSortDirection="desc"
                  pageSize={10}
                  tableClassName="w-full"
                  stickyHeader={true}
                  maxBodyHeight="60vh"
                />
              )}
            </SectionCard>

            {/* Events Attendance */}
            {events.length > 0 && (
              <SectionCard id="sec-events" icon={Users} title="Event Records">
                <div className="space-y-3">
                  {events.map((event) => {
                    const { att, status } = eventStatus(event);
                    const tone = {
                      present: 'bg-emerald-50/60 border-emerald-200',
                      late: 'bg-amber-50/60 border-amber-200',
                      excused: 'bg-blue-50/60 border-blue-200',
                      not_included: 'bg-slate-50 border-slate-200',
                      absent: 'bg-red-50/60 border-red-200',
                    }[status] || 'bg-red-50/60 border-red-200';
                    const StatusIcon = { present: CheckCircle, late: Clock, excused: FileText, not_included: FileText, absent: XCircle }[status] || XCircle;

                    return (
                      <div key={event.id} className={`border rounded-xl p-4 ${tone}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900">{event.name}</h4>
                            <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              {new Date(event.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            {(event.startTime || event.endTime) && (
                              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span>
                                  {formatTime12Hour(event.startTime)}
                                  {event.lateThreshold && <span className="text-amber-600"> (Late after: {formatTime12Hour(event.lateThreshold)})</span>}
                                  {' '}to {formatTime12Hour(event.endTime)}
                                </span>
                              </p>
                            )}
                            {event.description && (
                              <p className="text-sm text-slate-500 mt-1">{event.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <StatusIcon className="w-5 h-5 text-slate-500" />
                            <StatusPill status={status} />
                          </div>
                        </div>
                        {att && att.timestamp && (
                          <p className="text-xs text-slate-500 mt-2">
                            Recorded: {new Date(att.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Fines Breakdown */}
            <SectionCard id="sec-fines" icon={Coins} title="Fine Summary">
              {fines.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-emerald-600 font-semibold text-lg">No fines! 🎉</p>
                  <p className="text-slate-500 text-sm mt-1">Keep up the good attendance!</p>
                </div>
              ) : (
                <>
                  <DataTable
                    columns={fineColumns}
                    data={fines}
                    rowKey={(row) => row.id}
                    initialSortKey="date"
                    initialSortDirection="desc"
                    pageSize={10}
                    tableClassName="w-full"
                    stickyHeader={true}
                    maxBodyHeight="60vh"
                  />
                  <div className="mt-3 px-2 text-right text-sm font-semibold text-slate-900">
                    Outstanding: <span className="text-lg font-bold text-red-600">{formatCurrency(totalFines)}</span>
                  </div>
                </>
              )}
            </SectionCard>
          </div>
        )}

        <p className="mt-10 text-center text-xs sm:text-sm text-slate-500">
          This is a view-only portal. Contact your administrator for any corrections.
        </p>
      </main>
    </div>
  );
}
