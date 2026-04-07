import React, { useState } from 'react';
import { Search, Calendar, DollarSign, User, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { getStudentByStudentId, getStudentAttendance, getStudentFines, getAllEvents } from '../db/hybridDatabase';
import { cacheStudentPortalSnapshot } from '../db/database';
import { formatCurrency } from '../utils/finesCalculator';
import { formatTime12Hour } from '../utils/timeFormatter';
import DataTable from '../components/common/DataTable';

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

  const getStatusBadge = (status) => {
    const badges = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800',
      not_included: 'bg-gray-100 text-gray-700'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
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
      render: (row) => (
        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadge(row.status)}`}>
          {String(row.status || '').toUpperCase()}
        </span>
      ),
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Student Portal</h1>
          <p className="text-gray-600">View your attendance and fines</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter your Student ID"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              <Search className="w-5 h-5" />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Student Info & Data */}
        {student && (
          <div className="space-y-6">
            {/* Student Info Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {student.lastName}, {student.firstName} {student.middleInitial}
                  </h2>
                  <p className="text-gray-600">
                    Student ID: {student.studentId}
                    {student.program && (
                      <span className="ml-3 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                        {student.program}
                      </span>
                    )}
                    {student.yearLevel && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                        {student.yearLevel}{['st', 'nd', 'rd', 'th'][student.yearLevel > 3 ? 3 : student.yearLevel - 1]} Year
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Total Attendance</span>
                  </div>
                  <p className="text-3xl font-bold text-green-900">{attendance.length}</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">Total Fines</span>
                  </div>
                  <p className="text-3xl font-bold text-red-900">{formatCurrency(totalFines)}</p>
                </div>
              </div>
            </div>

            {/* Attendance History */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Attendance History
              </h3>

              {attendance.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No attendance records found</p>
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
            </div>

            {/* Events Attendance */}
            {events.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  Events Attendance
                </h3>

                <div className="space-y-3">
                  {events.map((event) => {
                    const att = eventAttendance[event.id];
                    const targetYear = getTargetYearFromEvent(event);
                    const isIncludedByTarget = targetYear === null || Number(student.yearLevel) === targetYear;
                    const hasFineForEvent = fines.some(f => f.eventId === event.id);
                    const isLegacySelectiveOnlineEvent =
                      !att &&
                      !hasFineForEvent &&
                      (event.description || '').toLowerCase().includes('online meeting attendance');
                    const isIncluded = isIncludedByTarget && !isLegacySelectiveOnlineEvent;
                    const status = !isIncluded ? 'not_included' : att ? att.status : 'absent';
                    
                    return (
                      <div key={event.id} className={`border rounded-lg p-4 ${
                        status === 'present' ? 'bg-green-50 border-green-200' :
                        status === 'late' ? 'bg-yellow-50 border-yellow-200' :
                        status === 'excused' ? 'bg-blue-50 border-blue-200' :
                        status === 'not_included' ? 'bg-gray-50 border-gray-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{event.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              📅 {new Date(event.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            {(event.startTime || event.endTime) && (
                              <p className="text-sm text-gray-600">
                                🕐 {formatTime12Hour(event.startTime)}
                                {event.lateThreshold && <span className="text-yellow-600"> (Late after: {formatTime12Hour(event.lateThreshold)})</span>}
                                {' '} to {formatTime12Hour(event.endTime)}
                              </p>
                            )}
                            {event.description && (
                              <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                            )}
                          </div>
                          <div className="ml-4">
                            {status === 'present' && (
                              <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle className="w-6 h-6" />
                                <span className="font-semibold">Present</span>
                              </div>
                            )}
                            {status === 'late' && (
                              <div className="flex items-center gap-2 text-yellow-700">
                                <Clock className="w-6 h-6" />
                                <span className="font-semibold">Late</span>
                              </div>
                            )}
                            {status === 'excused' && (
                              <div className="flex items-center gap-2 text-blue-700">
                                <FileText className="w-6 h-6" />
                                <span className="font-semibold">Excused</span>
                              </div>
                            )}
                            {status === 'absent' && (
                              <div className="flex items-center gap-2 text-red-700">
                                <XCircle className="w-6 h-6" />
                                <span className="font-semibold">Absent</span>
                              </div>
                            )}
                            {status === 'not_included' && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <FileText className="w-6 h-6" />
                                <span className="font-semibold">Not Included</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {att && att.timestamp && (
                          <p className="text-xs text-gray-500 mt-2">
                            Recorded: {new Date(att.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fines Breakdown */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-6 h-6" />
                Fines Breakdown
              </h3>

              {fines.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-green-600 font-medium text-lg">No fines! 🎉</p>
                  <p className="text-gray-500 text-sm mt-1">Keep up the good attendance!</p>
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
                  <div className="mt-2 px-2 text-right text-sm font-semibold text-gray-900">
                    Total: <span className="text-lg font-bold text-red-600">{formatCurrency(totalFines)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>This is a view-only portal. Contact your administrator for any corrections.</p>
        </div>
      </div>
    </div>
  );
}
