import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Trash2, ArrowUp } from 'lucide-react';
import { getAllAttendance, getAllStudents, getAllEvents, deleteAttendance, clearAllAttendance } from '../db/hybridDatabase';
import DataTable from './common/DataTable';

export default function AttendanceLogs() {
  const [logs, setLogs] = useState([]);
  const [students, setStudents] = useState({});
  const [events, setEvents] = useState({});
  const [filter, setFilter] = useState('all'); // all, qr, online
  const [eventFilter, setEventFilter] = useState('all'); // all, or specific eventId
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
 

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attendanceData, studentsData, eventsData] = await Promise.all([
        getAllAttendance(),
        getAllStudents(),
        getAllEvents()
      ]);

      // Create student lookup map
      const studentMap = {};
      studentsData.forEach(s => {
        studentMap[s.studentId] = s;
      });

      // Create event lookup map
      const eventMap = {};
      eventsData.forEach(e => {
        eventMap[e.id] = e;
      });

      setLogs(attendanceData);
      setStudents(studentMap);
      setEvents(eventMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeEventId = (value) => {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
  };

  const filteredLogs = logs
    .filter(log => filter === 'all' || log.type === filter)
    .filter(log => eventFilter === 'all' || normalizeEventId(log.eventId) === String(eventFilter));

  const getStatusBadge = (status) => {
    const badges = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeBadge = (type) => {
    const badges = {
      qr: 'bg-blue-100 text-blue-800',
      online: 'bg-purple-100 text-purple-800'
    };
    return badges[type] || 'bg-gray-100 text-gray-800';
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAttendance = async (log) => {
    const student = students[log.studentId];
    const studentName = student ? `${student.lastName}, ${student.firstName}` : log.studentId;
    const event = events[log.eventId];
    const eventName = event ? event.name : 'No event';
    
    if (!confirm(`Delete attendance record?\n\nStudent: ${studentName}\nEvent: ${eventName}\nDate: ${log.date}\nStatus: ${log.status}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteAttendance(log.id);
      setResult({
        success: true,
        message: `Deleted attendance record for ${studentName}`
      });
      await loadData();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error deleting attendance: ' + error.message
      });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const handleRemoveAll = async () => {
    const confirmText = 'DELETE ALL';
    const userInput = prompt(
      `⚠️ WARNING: Remove ALL attendance records?\n\n` +
      `This will delete ${logs.length} attendance record(s).\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        setResult({
          success: false,
          message: 'Remove all cancelled - confirmation text did not match'
        });
        setTimeout(() => setResult(null), 3000);
      }
      return;
    }

    try {
      await clearAllAttendance();
      setResult({
        success: true,
        message: `Successfully removed ${logs.length} attendance record(s)`
      });
      await loadData();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error removing attendance records: ' + error.message
      });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const attendanceColumns = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      accessor: (row) => row.date,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'event',
      header: 'Event',
      sortable: true,
      accessor: (row) => events[row.eventId]?.name || 'No event',
      render: (row) => {
        const event = events[row.eventId];
        return event ? event.name : <span className="text-gray-400 italic">No event</span>;
      },
    },
    {
      key: 'student',
      header: 'Student',
      sortable: true,
      accessor: (row) => {
        const student = students[row.studentId];
        return student ? `${student.lastName}, ${student.firstName} ${student.middleInitial}` : 'Unknown';
      },
      render: (row) => {
        const student = students[row.studentId];
        return student
          ? `${student.lastName}, ${student.firstName} ${student.middleInitial}`
          : 'Unknown';
      },
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'studentId',
      header: 'Student ID',
      sortable: true,
      accessor: (row) => row.studentId,
      cellClassName: 'text-gray-600 whitespace-nowrap',
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      accessor: (row) => row.type,
      render: (row) => (
        <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getTypeBadge(row.type)}`}>
          {String(row.type || '').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => (
        <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getStatusBadge(row.status)}`}>
          {String(row.status || '').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      sortable: true,
      accessor: (row) => row.timestamp,
      render: (row) => (
        <div className="flex items-center gap-1 whitespace-nowrap text-gray-600">
          <Clock className="w-3 h-3" />
          {new Date(row.timestamp).toLocaleTimeString()}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <button
          onClick={() => handleDeleteAttendance(row)}
          className="text-red-600 hover:text-red-800 p-1"
          title="Delete attendance record"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          Attendance Logs
        </h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleRemoveAll}
            disabled={logs.length === 0}
            className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-sm flex-1 sm:flex-initial justify-center"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Remove All</span>
            <span className="sm:hidden">Remove</span>
          </button>
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm flex-1 sm:flex-initial"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {result && (
        <div className={`mb-4 p-4 rounded-lg ${
          result.success 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <p className={result.success ? 'text-green-700' : 'text-red-700'}>
            {result.message}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
            filter === 'all' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          All ({logs.length})
        </button>
        <button
          onClick={() => setFilter('qr')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
            filter === 'qr' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          QR ({logs.filter(l => l.type === 'qr').length})
        </button>
        <button
          onClick={() => setFilter('online')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
            filter === 'online' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Online ({logs.filter(l => l.type === 'online').length})
        </button>
      </div>

      {/* Event Filter */}
      <div className="mb-4">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Filter by Event:</label>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
        >
          <option value="all">All Events ({logs.length})</option>
          {Object.values(events)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(event => {
              const count = logs.filter(l => normalizeEventId(l.eventId) === normalizeEventId(event.id)).length;
              return (
                <option key={event.id} value={String(event.id)}>
                  {event.name} - {new Date(event.date).toLocaleDateString()} ({count})
                </option>
              );
            })
          }
        </select>
      </div>

      {/* Logs Table */}
      <DataTable
        columns={attendanceColumns}
        data={filteredLogs}
        rowKey={(row) => row.id}
        initialSortKey="time"
        initialSortDirection="desc"
        pageSize={25}
        loading={loading}
        loadingMessage="Loading attendance records..."
        emptyMessage="No attendance records found"
        tableClassName="min-w-full w-full"
      />

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all z-50"
          title="Back to Top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
