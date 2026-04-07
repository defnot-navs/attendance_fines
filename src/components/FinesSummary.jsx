import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, ChevronDown, ChevronRight, Calendar, CheckCircle, XCircle, Trash2, CreditCard, ArrowUp } from 'lucide-react';
import { getAllStudents, getAllEvents, getAllAttendance, getAllFines, markAllFinesAsPaid, clearAllFines, markFineAsPaid, markFineAsUnpaid, updateFine, deleteFine, getStudentFines, getAllMembershipPayments, updateAttendance } from '../db/hybridDatabase';
import { getAllStudentsFinesSummary, getFinesStatistics, formatCurrency } from '../utils/finesCalculator';
import { exportToCSV } from '../utils/syncManager';

export default function FinesSummary() {
  const [summary, setSummary] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [events, setEvents] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [expandedStudents, setExpandedStudents] = useState({});
  const [eventAttendance, setEventAttendance] = useState({});
  const [result, setResult] = useState(null);
  const [membershipPayments, setMembershipPayments] = useState([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [attendanceModal, setAttendanceModal] = useState({
    open: false,
    student: null,
    records: [],
    originalStatusById: {}
  });
  const [savingAttendanceEdits, setSavingAttendanceEdits] = useState(false);

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const students = await getAllStudents();
      const finesSummary = await getAllStudentsFinesSummary(students);
      
      // Load membership payments
      const allMembershipPayments = await getAllMembershipPayments();
      
      // Merge membership fees into summary
      const membershipMap = {};
      allMembershipPayments.forEach(payment => {
        if (!membershipMap[payment.studentId]) {
          membershipMap[payment.studentId] = {
            totalMembership: 0,
            paidMembership: 0,
            unpaidMembership: 0,
            membershipCount: 0
          };
        }
        membershipMap[payment.studentId].totalMembership += payment.amount;
        membershipMap[payment.studentId].membershipCount++;
        if (payment.paid) {
          membershipMap[payment.studentId].paidMembership += payment.amount;
        } else {
          membershipMap[payment.studentId].unpaidMembership += payment.amount;
        }
      });
      
      // Add membership data to each student in summary
      const enhancedSummary = finesSummary.map(student => ({
        ...student,
        membershipFees: membershipMap[student.studentId]?.totalMembership || 0,
        paidMembership: membershipMap[student.studentId]?.paidMembership || 0,
        unpaidMembership: membershipMap[student.studentId]?.unpaidMembership || 0,
        membershipCount: membershipMap[student.studentId]?.membershipCount || 0,
        totalDues: (student.totalFines || 0) + (membershipMap[student.studentId]?.unpaidMembership || 0)
      }));
      
      const stats = getFinesStatistics(finesSummary);
      
      // Add membership statistics
      const membershipStats = {
        totalMembership: allMembershipPayments.reduce((sum, p) => sum + p.amount, 0),
        paidMembership: allMembershipPayments.filter(p => p.paid).reduce((sum, p) => sum + p.amount, 0),
        unpaidMembership: allMembershipPayments.filter(p => !p.paid).reduce((sum, p) => sum + p.amount, 0),
        membershipCount: allMembershipPayments.length,
        paidMembershipCount: allMembershipPayments.filter(p => p.paid).length
      };
      
      const allEvents = await getAllEvents();
      const allAttendance = await getAllAttendance();
      const allFines = await getAllFines();

      // Build per-event data using hybrid API data (backend when online, IndexedDB when offline).
      const eventData = {};
      for (const event of allEvents) {
        const eventId = String(event.id);
        const attendance = allAttendance.filter((a) => String(a.eventId) === eventId);
        const fines = allFines.filter((f) => String(f.eventId) === eventId);

        eventData[eventId] = {
          attendance,
          fines,
          totalFines: fines.reduce((sum, f) => sum + Number(f.amount || 0), 0),
          presentCount: attendance.filter((a) => a.status === 'present').length,
          lateCount: attendance.filter((a) => a.status === 'late').length,
          absentCount: attendance.filter((a) => a.status === 'absent').length,
          excusedCount: attendance.filter((a) => a.status === 'excused').length,
        };
      }
      
      setSummary(enhancedSummary);
      setStatistics({...stats, ...membershipStats});
      setEvents(allEvents);
      setEventAttendance(eventData);
      setMembershipPayments(allMembershipPayments);
    } catch (error) {
      console.error('Error loading fines:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (eventId) => {
    setExpandedEvents(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  const toggleStudent = (studentId) => {
    setExpandedStudents(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleExport = () => {
    if (summary.length === 0) {
      alert('No data to export');
      return;
    }

    const exportData = summary.map(s => ({
      'Student ID': s.studentId,
      'Name': s.name,
      'Total Fines': s.totalFines,
      'Fine Count': s.fineCount
    }));

    exportToCSV(exportData, `fines-summary-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleMarkAllAsPaid = async () => {
    if (!confirm('Mark all fines as PAID? This will mark all unpaid fines as paid.')) {
      return;
    }

    try {
      const count = await markAllFinesAsPaid();
      setResult({
        success: true,
        message: `Successfully marked ${count} fines as paid`
      });
      await loadData();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error marking fines as paid: ' + error.message
      });
    }
  };

  const handleClearAllFines = async () => {
    const confirmMessage = `⚠️ WARNING: This will permanently DELETE all ${statistics?.totalFineRecords || 0} fine records.\n\nThis action CANNOT be undone!\n\nType 'DELETE ALL' to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput === 'DELETE ALL') {
      try {
        const count = await clearAllFines();
        setResult({
          success: true,
          message: `Successfully deleted ${count} fine records`
        });
        await loadData();
        setTimeout(() => setResult(null), 3000);
      } catch (error) {
        setResult({
          success: false,
          message: 'Error clearing fines: ' + error.message
        });
      }
    } else if (userInput !== null) {
      alert('Deletion cancelled. You must type "DELETE ALL" exactly to confirm.');
    }
  };

  const handleToggleFinePayment = async (fine) => {
    try {
      if (fine.paid) {
        await markFineAsUnpaid(fine.id);
        setResult({ success: true, message: 'Fine marked as UNPAID' });
      } else {
        await markFineAsPaid(fine.id);
        setResult({ success: true, message: 'Fine marked as PAID' });
      }

      await loadData();
      setTimeout(() => setResult(null), 2500);
    } catch (error) {
      setResult({ success: false, message: `Error updating fine status: ${error.message}` });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const handleMarkStudentFinesAsPaid = async (studentId) => {
    try {
      const fines = await getStudentFines(studentId);
      const unpaid = fines.filter((fine) => !fine.paid);

      if (unpaid.length === 0) {
        setResult({ success: false, message: 'No unpaid fines for this student.' });
        setTimeout(() => setResult(null), 2500);
        return;
      }

      for (const fine of unpaid) {
        await markFineAsPaid(fine.id);
      }

      setResult({ success: true, message: `Marked ${unpaid.length} fine(s) as PAID for ${studentId}.` });
      await loadData();
      setTimeout(() => setResult(null), 2500);
    } catch (error) {
      setResult({ success: false, message: `Error updating student fines: ${error.message}` });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const handleEditFine = async (fine) => {
    const nextAmountInput = prompt('Edit fine amount:', String(fine.amount));
    if (nextAmountInput === null) return;

    const nextAmount = Number(nextAmountInput);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      alert('Invalid fine amount.');
      return;
    }

    const nextReason = prompt('Edit fine reason:', String(fine.reason || ''));
    if (nextReason === null) return;

    try {
      await updateFine(fine.id, { amount: nextAmount, reason: nextReason });
      setResult({ success: true, message: 'Fine updated successfully.' });
      await loadData();
      setTimeout(() => setResult(null), 2500);
    } catch (error) {
      setResult({ success: false, message: `Error editing fine: ${error.message}` });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const handleDeleteFine = async (fine) => {
    const confirmed = confirm(
      `Delete this fine?\n\nReason: ${fine.reason}\nAmount: ${formatCurrency(fine.amount)}\nDate: ${fine.date || '-'}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteFine(fine.id);
      setResult({ success: true, message: 'Fine deleted successfully.' });
      await loadData();
      setTimeout(() => setResult(null), 2500);
    } catch (error) {
      setResult({ success: false, message: `Error deleting fine: ${error.message}` });
      setTimeout(() => setResult(null), 3000);
    }
  };

  const openAttendanceModal = (student, studentAttendance) => {
    const rows = [...studentAttendance]
      .map(({ event, attendance }) => ({
        id: attendance.id,
        eventName: event.name,
        date: attendance.date || event.date,
        session: attendance.session || 'AM_IN',
        status: attendance.status || 'absent',
        type: attendance.type || 'manual',
        timestamp: attendance.timestamp || null,
      }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const originalStatusById = {};
    rows.forEach((row) => {
      if (row.id !== undefined && row.id !== null) {
        originalStatusById[String(row.id)] = row.status;
      }
    });

    setAttendanceModal({
      open: true,
      student,
      records: rows,
      originalStatusById,
    });
  };

  const closeAttendanceModal = (force = false) => {
    if (savingAttendanceEdits && !force) return;
    setAttendanceModal({ open: false, student: null, records: [], originalStatusById: {} });
  };

  const handleModalAttendanceStatusChange = (attendanceId, nextStatus) => {
    setAttendanceModal((prev) => ({
      ...prev,
      records: prev.records.map((row) =>
        String(row.id) === String(attendanceId)
          ? { ...row, status: nextStatus }
          : row
      ),
    }));
  };

  const handleSaveAttendanceEdits = async () => {
    try {
      setSavingAttendanceEdits(true);

      const changedRows = attendanceModal.records.filter((row) => {
        if (row.id === undefined || row.id === null) return false;
        return attendanceModal.originalStatusById[String(row.id)] !== row.status;
      });

      if (changedRows.length === 0) {
        setResult({ success: false, message: 'No attendance changes to save.' });
        setTimeout(() => setResult(null), 2000);
        closeAttendanceModal(true);
        return;
      }

      for (const row of changedRows) {
        await updateAttendance(row.id, { status: row.status });
      }

      setResult({ success: true, message: `Updated ${changedRows.length} attendance record(s).` });
      closeAttendanceModal(true);
      await loadData();
      setTimeout(() => setResult(null), 2500);
    } catch (error) {
      setResult({ success: false, message: `Error updating attendance: ${error.message}` });
      setTimeout(() => setResult(null), 3000);
    } finally {
      setSavingAttendanceEdits(false);
    }
  };

  const filteredSummary = searchTerm
    ? summary.filter(s => 
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : summary;

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          Fines Summary
        </h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 text-xs sm:text-sm font-medium flex-1 sm:flex-initial touch-manipulation"
          >
            Refresh
          </button>
          <button
            onClick={handleMarkAllAsPaid}
            className="flex items-center justify-center gap-1 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 active:bg-green-800 text-xs sm:text-sm font-medium flex-1 sm:flex-initial touch-manipulation"
            title="Mark all fines as paid"
          >
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Mark All Paid</span>
            <span className="sm:hidden">Paid</span>
          </button>
          <button
            onClick={handleClearAllFines}
            className="flex items-center justify-center gap-1 sm:gap-2 bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 active:bg-red-800 text-xs sm:text-sm font-medium flex-1 sm:flex-initial touch-manipulation"
            title="Delete all fine records"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Clear All</span>
            <span className="sm:hidden">Clear</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-700 active:bg-gray-800 text-xs sm:text-sm font-medium w-full sm:w-auto touch-manipulation"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Result Messages */}
      {result && (
        <div className={`mb-4 p-4 rounded-lg ${
          result.success 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {result.message}
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <>
          {/* Fines Statistics */}
          <div className="mb-4">
            <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
              Attendance Fines
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-blue-600 font-medium">Total Fines</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-900">
                      {formatCurrency(statistics.totalFines)}
                    </p>
                  </div>
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 opacity-50 hidden sm:block" />
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-red-600 font-medium">Unpaid Fines</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-900">
                      {formatCurrency(statistics.unpaidFines)}
                    </p>
                  </div>
                  <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 opacity-50 hidden sm:block" />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-green-600 font-medium">Paid Fines</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-900">
                      {formatCurrency(statistics.paidFines)}
                    </p>
                  </div>
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 opacity-50 hidden sm:block" />
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Students with Fines</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {statistics.studentsWithFines}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-purple-600 opacity-50" />
                </div>
              </div>
            </div>
          </div>

          {/* Membership Statistics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Membership Fees
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-indigo-600 font-medium">Total Membership</p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {formatCurrency(statistics.totalMembership || 0)}
                    </p>
                  </div>
                  <CreditCard className="w-8 h-8 text-indigo-600 opacity-50" />
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 font-medium">Unpaid Membership</p>
                    <p className="text-2xl font-bold text-red-900">
                      {formatCurrency(statistics.unpaidMembership || 0)}
                    </p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600 opacity-50" />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Paid Membership</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(statistics.paidMembership || 0)}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Paid Members</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {statistics.paidMembershipCount || 0} / {statistics.membershipCount || 0}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-purple-600 opacity-50" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by Student ID or Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Summary Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filteredSummary.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No fines records found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-6">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Program</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Year</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Fines</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-red-700">Unpaid</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-green-700">Paid</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Count</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-indigo-700">Membership</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-orange-700">Total Dues</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSummary.map((student, idx) => {
                  const isExpanded = expandedStudents[student.studentId];
                  const studentAttendance = events.flatMap((event) => {
                    const eventId = String(event.id);
                    const attendanceRecords = (eventAttendance[eventId]?.attendance || [])
                      .filter((a) => a.studentId === student.studentId)
                      .map((attendance) => ({ event, attendance }));

                    return attendanceRecords;
                  });

                  const studentFinesDetailed = events.flatMap((event) => {
                    const eventId = String(event.id);
                    const fineRecords = (eventAttendance[eventId]?.fines || [])
                      .filter((f) => f.studentId === student.studentId)
                      .map((fine) => ({ event, fine }));

                    return fineRecords;
                  });

                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <button
                            onClick={() => toggleStudent(student.studentId)}
                            className="flex items-center gap-2 hover:text-blue-600"
                            title="Click to view attendance details"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {student.studentId}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{student.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.program || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {student.yearLevel ? `${student.yearLevel}${['st', 'nd', 'rd', 'th'][student.yearLevel > 3 ? 3 : student.yearLevel - 1]} Year` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-semibold ${
                            student.totalFines > 0 ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {formatCurrency(student.totalFines)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-semibold ${
                            student.unpaidFines > 0 ? 'text-red-600' : 'text-gray-400'
                          }`}>
                            {formatCurrency(student.unpaidFines)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-semibold ${
                            student.paidFines > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {formatCurrency(student.paidFines)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {student.fineCount}
                          {student.paidCount > 0 && (
                            <span className="ml-1 text-xs text-green-600">({student.paidCount} paid)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {student.unpaidMembership > 0 ? (
                            <span className="font-semibold text-red-600">
                              {formatCurrency(student.unpaidMembership)}
                            </span>
                          ) : student.paidMembership > 0 ? (
                            <span className="font-semibold text-green-600">
                              {formatCurrency(student.paidMembership)} ✓
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-bold ${
                            student.totalDues > 0 ? 'text-orange-600' : 'text-gray-400'
                          }`}>
                            {formatCurrency(student.totalDues || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <button
                              onClick={() => handleMarkStudentFinesAsPaid(student.studentId)}
                              disabled={student.unpaidFines <= 0}
                              className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              Mark Paid
                            </button>
                            <button
                              onClick={() => toggleStudent(student.studentId)}
                              className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                            >
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                            <button
                              onClick={() => openAttendanceModal(student, studentAttendance)}
                              disabled={studentAttendance.length === 0}
                              className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                              title="Edit attendance status for this student"
                            >
                              Edit Att.
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="11" className="px-4 py-3 bg-gray-50">
                            <div className="text-sm">
                              <h4 className="font-semibold text-gray-900 mb-3">Attendance Records for {student.name}</h4>
                              {studentAttendance.length > 0 ? (
                                <div className="bg-white rounded-lg border overflow-hidden">
                                  <table className="w-full">
                                    <thead className="bg-gray-100 border-b">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Event</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Session</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Status</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Time</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {studentAttendance.map(({ event, attendance }, detailIdx) => (
                                        <tr key={detailIdx} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 text-xs text-gray-900">{event.name}</td>
                                          <td className="px-3 py-2 text-xs text-gray-600">
                                            {new Date(event.date).toLocaleDateString()}
                                          </td>
                                          <td className="px-3 py-2 text-center text-xs text-gray-700">
                                            {attendance?.session ? attendance.session.replace('_', ' ') : '-'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                                              attendance.status === 'present' ? 'bg-green-100 text-green-800' :
                                              attendance.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                              attendance.status === 'excused' ? 'bg-blue-100 text-blue-800' :
                                              'bg-red-100 text-red-800'
                                            }`}>
                                              {attendance.status.toUpperCase()}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-600 text-center">
                                            {attendance?.timestamp ? new Date(attendance.timestamp).toLocaleTimeString() : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">No attendance records for this student.</p>
                              )}

                              <h4 className="font-semibold text-gray-900 mt-4 mb-3">Fines Breakdown for {student.name}</h4>
                              {studentFinesDetailed.length > 0 ? (
                                <div className="bg-white rounded-lg border overflow-hidden">
                                  <table className="w-full">
                                    <thead className="bg-gray-100 border-b">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Event</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Reason</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Amount</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Status</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {studentFinesDetailed.map(({ event, fine }, fineIdx) => (
                                        <tr key={fineIdx} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 text-xs text-gray-900">{event.name}</td>
                                          <td className="px-3 py-2 text-xs text-gray-600">{fine.date || '-'}</td>
                                          <td className="px-3 py-2 text-xs text-gray-700">{fine.reason}</td>
                                          <td className="px-3 py-2 text-xs text-right font-semibold text-red-600">
                                            {formatCurrency(fine.amount)}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                                              fine.paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                              {fine.paid ? 'PAID' : 'UNPAID'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                onClick={() => handleToggleFinePayment(fine)}
                                                className={`px-2 py-1 text-xs font-medium rounded ${
                                                  fine.paid
                                                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                                                }`}
                                              >
                                                {fine.paid ? 'Unpay' : 'Pay'}
                                              </button>
                                              <button
                                                onClick={() => handleEditFine(fine)}
                                                className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                                              >
                                                Edit Fine
                                              </button>
                                              <button
                                                onClick={() => handleDeleteFine(fine)}
                                                className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800 hover:bg-red-200"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">No fine records for this student.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Events Section */}
          {events.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Events Breakdown
              </h3>
              <div className="space-y-2">
                {events.map((event) => {
                  const data = eventAttendance[String(event.id)] || {};
                  const isExpanded = expandedEvents[event.id];
                  
                  return (
                    <div key={event.id} className="border rounded-lg">
                      <button
                        onClick={() => toggleEvent(event.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                          )}
                          <div className="text-left">
                            <h4 className="font-semibold text-gray-900">{event.name}</h4>
                            <p className="text-sm text-gray-600">
                              {new Date(event.date).toLocaleDateString()}
                              {event.startTime && ` • ${event.startTime}`}
                              {event.lateThreshold && ` → Late: ${event.lateThreshold}`}
                              {event.endTime && ` - ${event.endTime}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600">✓ {data.presentCount || 0}</span>
                          <span className="text-yellow-600">⏰ {data.lateCount || 0}</span>
                          <span className="text-blue-600">📝 {data.excusedCount || 0}</span>
                          <span className="text-red-600">✗ {data.absentCount || 0}</span>
                          <span className="font-semibold text-red-700">
                            {formatCurrency(data.totalFines || 0)}
                          </span>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t bg-gray-50">
                          <div className="pt-4">
                            <h5 className="font-semibold text-sm text-gray-700 mb-2">Attendance Details:</h5>
                            {data.attendance && data.attendance.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Present */}
                                {data.presentCount > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-green-700 mb-1">
                                      Present ({data.presentCount})
                                    </p>
                                    <div className="bg-white rounded p-2 max-h-32 overflow-y-auto text-xs">
                                      {data.attendance
                                        .filter(a => a.status === 'present')
                                        .map((a, i) => (
                                          <div key={i} className="text-gray-600">{a.studentId}</div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Late */}
                                {data.lateCount > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-yellow-700 mb-1">
                                      Late ({data.lateCount})
                                    </p>
                                    <div className="bg-white rounded p-2 max-h-32 overflow-y-auto text-xs">
                                      {data.attendance
                                        .filter(a => a.status === 'late')
                                        .map((a, i) => (
                                          <div key={i} className="text-gray-600">{a.studentId}</div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Excused */}
                                {data.excusedCount > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-blue-700 mb-1">
                                      Excused ({data.excusedCount})
                                    </p>
                                    <div className="bg-white rounded p-2 max-h-32 overflow-y-auto text-xs">
                                      {data.attendance
                                        .filter(a => a.status === 'excused')
                                        .map((a, i) => (
                                          <div key={i} className="text-gray-600">
                                            {a.studentId}
                                            {a.excuseReason && <span className="text-gray-400 ml-1">({a.excuseReason})</span>}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Absent */}
                                {data.absentCount > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-red-700 mb-1">
                                      Absent ({data.absentCount})
                                    </p>
                                    <div className="bg-white rounded p-2 max-h-32 overflow-y-auto text-xs">
                                      {data.attendance
                                        .filter(a => a.status === 'absent')
                                        .map((a, i) => (
                                          <div key={i} className="text-gray-600">{a.studentId}</div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No attendance records</p>
                            )}
                            
                            {data.fines && data.fines.length > 0 && (
                              <div className="mt-3">
                                <h5 className="font-semibold text-sm text-gray-700 mb-2">
                                  Fines ({data.fines.length}):
                                </h5>
                                <div className="bg-white rounded p-2 max-h-32 overflow-y-auto text-xs space-y-1">
                                  {data.fines.map((fine, i) => (
                                    <div key={i} className="flex justify-between text-gray-600">
                                      <span>{fine.studentId} - {fine.reason}</span>
                                      <span className="font-semibold text-red-600">
                                        {formatCurrency(fine.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {attendanceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeAttendanceModal} />
          <div className="relative z-10 w-full max-w-4xl bg-white rounded-xl shadow-xl border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Edit Attendance</h3>
                <p className="text-sm text-gray-600">
                  {attendanceModal.student?.name} ({attendanceModal.student?.studentId})
                </p>
              </div>
              <button
                onClick={closeAttendanceModal}
                disabled={savingAttendanceEdits}
                className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-auto">
              {attendanceModal.records.length === 0 ? (
                <p className="text-sm text-gray-500">No attendance records found for this student.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Event</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Session</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attendanceModal.records.map((row, idx) => (
                      <tr key={`${row.id || 'tmp'}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{row.eventName || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{row.date || '-'}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{row.session.replace('_', ' ')}</td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={row.status}
                            onChange={(e) => handleModalAttendanceStatusChange(row.id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                            disabled={row.id === undefined || row.id === null || savingAttendanceEdits}
                          >
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="excused">Excused</option>
                            <option value="absent">Absent</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={closeAttendanceModal}
                disabled={savingAttendanceEdits}
                className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAttendanceEdits}
                disabled={savingAttendanceEdits || attendanceModal.records.length === 0}
                className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {savingAttendanceEdits ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
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
