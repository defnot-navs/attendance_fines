import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Trash2, ArrowUp } from 'lucide-react';
import { getAllAttendance, getAllStudents, getAllEvents, deleteAttendance, clearAllAttendance } from '../db/hybridDatabase';

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

  const filteredLogs = logs
    .filter(log => filter === 'all' || log.type === filter)
    .filter(log => eventFilter === 'all' || log.eventId === parseInt(eventFilter));

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
              const count = logs.filter(l => l.eventId === event.id).length;
              return (
                <option key={event.id} value={event.id}>
                  {event.name} - {new Date(event.date).toLocaleDateString()} ({count})
                </option>
              );
            })
          }
        </select>
      </div>

      {/* Logs Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm sm:text-base">No attendance records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">Date</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Event</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Student</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">Student ID</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Type</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Status</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Time</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredLogs.map((log, idx) => {
                const student = students[log.studentId];
                const event = events[log.eventId];
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 whitespace-nowrap">{log.date}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700">
                      {event ? event.name : <span className="text-gray-400 italic">No event</span>}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 whitespace-nowrap">
                      {student 
                        ? `${student.lastName}, ${student.firstName} ${student.middleInitial}`
                        : 'Unknown'
                      }
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">{log.studentId}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getTypeBadge(log.type)}`}>
                        {log.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getStatusBadge(log.status)}`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                      <button
                        onClick={() => handleDeleteAttendance(log)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete attendance record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
