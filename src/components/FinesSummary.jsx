import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, ChevronDown, ChevronRight, Calendar, CheckCircle, XCircle, Trash2, CreditCard, ArrowUp } from 'lucide-react';
import { getAllStudents, getAllEvents, getAllAttendance, getAllFines, markAllFinesAsPaid, clearAllFines, markFineAsPaid, markFineAsUnpaid, updateFine, deleteFine, getStudentFines, getAllMembershipPayments, updateAttendance, getFineRules, recordFine, recordAttendance } from '../db/hybridDatabase';
import { getAllStudentsFinesSummary, getFinesStatistics, formatCurrency } from '../utils/finesCalculator';
import { exportToCSV } from '../utils/syncManager';
import DataTable from './common/DataTable';

const NO_EVENT_KEY = '__NO_EVENT__';

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

      const normalizeEventId = (value) => {
        if (value === null || value === undefined || value === '') return null;
        return String(value);
      };

      // Build per-event data using hybrid API data (backend when online, IndexedDB when offline).
      const eventData = {};
      for (const event of allEvents) {
        const eventId = String(event.id);
        const attendance = allAttendance.filter((a) => normalizeEventId(a.eventId) === eventId);
        const fines = allFines.filter((f) => normalizeEventId(f.eventId) === eventId);

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

      // Keep uncategorized fines accessible in admin breakdown so they can be managed/deleted.
      const noEventFines = allFines.filter((f) => normalizeEventId(f.eventId) === null);
      eventData[NO_EVENT_KEY] = {
        attendance: [],
        fines: noEventFines,
        totalFines: noEventFines.reduce((sum, f) => sum + Number(f.amount || 0), 0),
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
      };
      
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
    const NOT_INCLUDED_STATUS = '__not_included__';

    const rows = [...studentAttendance]
      .map(({ event, attendance }) => ({
        key: `id:${attendance.id}`,
        id: attendance.id,
        eventId: event.id,
        eventName: event.name,
        date: attendance.date || event.date,
        session: attendance.session || 'AM_IN',
        status: attendance.status || 'absent',
        type: attendance.type || 'manual',
        eventFineAmount: event.fineAmount,
        timestamp: attendance.timestamp || null,
      }));

    // Include rows for events/sessions where the student has no attendance yet.
    const existingKeys = new Set(rows.map((r) => `${String(r.eventId)}::${r.session}`));
    for (const event of events) {
      const eventId = String(event.id);
      const eventRows = (eventAttendance[eventId]?.attendance || []);
      const sessionCandidates = [...new Set(eventRows.map((a) => a.session).filter(Boolean))];
      const sessions = sessionCandidates.length > 0 ? sessionCandidates : ['AM_IN'];

      for (const session of sessions) {
        const composite = `${eventId}::${session}`;
        if (existingKeys.has(composite)) continue;

        rows.push({
          key: `new:${eventId}:${session}`,
          id: null,
          eventId: event.id,
          eventName: event.name,
          date: event.date,
          session,
          status: NOT_INCLUDED_STATUS,
          type: 'manual',
          eventFineAmount: event.fineAmount,
          timestamp: null,
        });
      }
    }

    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const originalStatusById = {};
    rows.forEach((row) => {
      originalStatusById[row.key] = row.status;
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

  const handleModalAttendanceStatusChange = (rowKey, nextStatus) => {
    setAttendanceModal((prev) => ({
      ...prev,
      records: prev.records.map((row) =>
        row.key === rowKey
          ? { ...row, status: nextStatus }
          : row
      ),
    }));
  };

  const handleSaveAttendanceEdits = async () => {
    try {
      setSavingAttendanceEdits(true);

      const NOT_INCLUDED_STATUS = '__not_included__';

      const changedRows = attendanceModal.records.filter((row) => (
        attendanceModal.originalStatusById[row.key] !== row.status
      ));

      if (changedRows.length === 0) {
        setResult({ success: false, message: 'No attendance changes to save.' });
        setTimeout(() => setResult(null), 2000);
        closeAttendanceModal(true);
        return;
      }

      const fineRules = await getFineRules();
      const ruleMap = {};
      fineRules.forEach((rule) => {
        ruleMap[rule.type] = Number(rule.amount || 0);
      });

      const studentId = attendanceModal.student?.studentId;
      const studentFines = studentId ? await getStudentFines(studentId) : [];
      const normalizeDate = (value) => String(value || '').slice(0, 10);
      const normalizeId = (value) => (value === null || value === undefined || value === '' ? null : String(value));
      const toSessionLabel = (session) => String(session || 'AM_IN').replace('_', ' ');

      const findMatchingFine = (row) => {
        const rowEventId = normalizeId(row.eventId);
        const rowDate = normalizeDate(row.date);
        const label = toSessionLabel(row.session);

        const eventDateFines = studentFines.filter((fine) => {
          const fineEventId = normalizeId(fine.eventId);
          return fineEventId === rowEventId && normalizeDate(fine.date) === rowDate;
        });

        const exactSessionFine = eventDateFines.find((fine) =>
          String(fine.reason || '').toUpperCase().includes(label.toUpperCase())
        );
        if (exactSessionFine) return exactSessionFine;

        if (eventDateFines.length === 1) return eventDateFines[0];

        return null;
      };

      for (const row of changedRows) {
        if (row.id) {
          if (row.status !== NOT_INCLUDED_STATUS) {
            await updateAttendance(row.id, { status: row.status });
          }
        } else if (row.status !== NOT_INCLUDED_STATUS) {
          // Create attendance for previously not-included event/session rows.
          await recordAttendance(
            studentId,
            'manual',
            row.status,
            row.eventId,
            row.session,
            row.date
          );
        }

        if (!studentId) continue;

        if (row.status === NOT_INCLUDED_STATUS) {
          continue;
        }

        const existingFine = findMatchingFine(row);
        const eventFineAmount = Number(row.eventFineAmount || 0);
        const absentFineAmount = eventFineAmount > 0 ? eventFineAmount : Number(ruleMap.absent || 0);
        const lateFineAmount = eventFineAmount > 0 ? eventFineAmount * 0.75 : Number(ruleMap.late || 0);
        const absentReason = `Absent - ${toSessionLabel(row.session)}`;
        const lateReason = `Late Arrival - ${toSessionLabel(row.session)}`;

        // Present and excused should not have attendance fines.
        if (row.status === 'present' || row.status === 'excused') {
          if (existingFine) {
            await deleteFine(existingFine.id);
          }
          continue;
        }

        if (row.status === 'absent') {
          if (absentFineAmount <= 0) {
            if (existingFine) await deleteFine(existingFine.id);
            continue;
          }

          if (existingFine) {
            await updateFine(existingFine.id, {
              amount: absentFineAmount,
              reason: absentReason,
              date: row.date,
            });
          } else {
            await recordFine(studentId, absentFineAmount, absentReason, row.date, row.eventId);
          }
          continue;
        }

        if (row.status === 'late') {
          if (lateFineAmount <= 0) {
            if (existingFine) await deleteFine(existingFine.id);
            continue;
          }

          if (existingFine) {
            await updateFine(existingFine.id, {
              amount: lateFineAmount,
              reason: lateReason,
              date: row.date,
            });
          } else {
            await recordFine(studentId, lateFineAmount, lateReason, row.date, row.eventId);
          }
        }
      }

      setResult({ success: true, message: `Updated ${changedRows.length} attendance record(s) and synced fines.` });
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

  const getStudentAttendanceDetails = (student) => events.flatMap((event) => {
    const eventId = String(event.id);
    return (eventAttendance[eventId]?.attendance || [])
      .filter((a) => a.studentId === student.studentId)
      .map((attendance) => ({ event, attendance }));
  });

  const getStudentFineDetails = (student) => events.flatMap((event) => {
    const eventId = String(event.id);
    return (eventAttendance[eventId]?.fines || [])
      .filter((f) => f.studentId === student.studentId)
      .map((fine) => ({ event, fine }));
  }).concat(
    (eventAttendance[NO_EVENT_KEY]?.fines || [])
      .filter((f) => f.studentId === student.studentId)
      .map((fine) => ({
        event: {
          id: NO_EVENT_KEY,
          name: 'General / No Event',
          date: fine.date || '',
        },
        fine,
      }))
  );

  const renderExpandedStudentRow = (student) => {
    const studentAttendance = getStudentAttendanceDetails(student);
    const studentFinesDetailed = getStudentFineDetails(student);

    const expandedAttendanceColumns = [
      { key: 'event', header: 'Event', sortable: true, accessor: (row) => row.event.name, render: (row) => row.event.name },
      {
        key: 'date',
        header: 'Date',
        sortable: true,
        accessor: (row) => row.event.date,
        render: (row) => new Date(row.event.date).toLocaleDateString(),
        cellClassName: 'text-gray-600',
      },
      {
        key: 'session',
        header: 'Session',
        sortable: true,
        accessor: (row) => row.attendance?.session || '',
        render: (row) => row.attendance?.session ? row.attendance.session.replace('_', ' ') : '-',
        headerClassName: 'text-center',
        cellClassName: 'text-center text-gray-700',
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        accessor: (row) => row.attendance?.status || '',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (row) => (
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            row.attendance.status === 'present' ? 'bg-green-100 text-green-800' :
            row.attendance.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
            row.attendance.status === 'excused' ? 'bg-blue-100 text-blue-800' :
            'bg-red-100 text-red-800'
          }`}>
            {String(row.attendance.status || '').toUpperCase()}
          </span>
        ),
      },
      {
        key: 'time',
        header: 'Time',
        sortable: true,
        accessor: (row) => row.attendance?.timestamp || '',
        render: (row) => row.attendance?.timestamp ? new Date(row.attendance.timestamp).toLocaleTimeString() : '-',
        headerClassName: 'text-center',
        cellClassName: 'text-center text-gray-600',
      },
    ];

    const expandedFineColumns = [
      { key: 'event', header: 'Event', sortable: true, accessor: (row) => row.event.name, render: (row) => row.event.name },
      { key: 'date', header: 'Date', sortable: true, accessor: (row) => row.fine.date || '', render: (row) => row.fine.date || '-', cellClassName: 'text-gray-600' },
      { key: 'reason', header: 'Reason', sortable: true, accessor: (row) => row.fine.reason || '', render: (row) => row.fine.reason, cellClassName: 'text-gray-700' },
      {
        key: 'amount',
        header: 'Amount',
        sortable: true,
        accessor: (row) => Number(row.fine.amount || 0),
        render: (row) => <span className="font-semibold text-red-600">{formatCurrency(row.fine.amount)}</span>,
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        accessor: (row) => row.fine.paid ? 'PAID' : 'UNPAID',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (row) => (
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            row.fine.paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {row.fine.paid ? 'PAID' : 'UNPAID'}
          </span>
        ),
      },
      {
        key: 'action',
        header: 'Action',
        sortable: false,
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (row) => (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => handleToggleFinePayment(row.fine)}
              className={`px-2 py-1 text-xs font-medium rounded ${
                row.fine.paid
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              {row.fine.paid ? 'Unpay' : 'Pay'}
            </button>
            <button
              onClick={() => handleEditFine(row.fine)}
              className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
            >
              Edit Fine
            </button>
            <button
              onClick={() => handleDeleteFine(row.fine)}
              className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800 hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        ),
      },
    ];

    return (
      <div className="px-4 py-3 bg-gray-50 text-sm">
        <h4 className="font-semibold text-gray-900 mb-3">Attendance Records for {student.name}</h4>
        {studentAttendance.length > 0 ? (
          <DataTable
            columns={expandedAttendanceColumns}
            data={studentAttendance}
            rowKey={(row) => `${row.attendance.id || `${row.event.id}-${row.attendance.session}-${row.attendance.timestamp || ''}`}`}
            initialSortKey="date"
            initialSortDirection="desc"
            pageSize={8}
            pageSizeOptions={[5, 8, 12]}
            showFooter={false}
            tableClassName="w-full"
            stickyHeader={true}
            maxBodyHeight="260px"
            compact={true}
          />
        ) : (
          <p className="text-xs text-gray-500">No attendance records for this student.</p>
        )}

        <h4 className="font-semibold text-gray-900 mt-4 mb-3">Fines Breakdown for {student.name}</h4>
        {studentFinesDetailed.length > 0 ? (
          <DataTable
            columns={expandedFineColumns}
            data={studentFinesDetailed}
            rowKey={(row) => `${row.fine.id || `${row.event.id}-${row.fine.reason}-${row.fine.date || ''}`}`}
            initialSortKey="date"
            initialSortDirection="desc"
            pageSize={8}
            pageSizeOptions={[5, 8, 12]}
            showFooter={false}
            tableClassName="w-full"
            stickyHeader={true}
            maxBodyHeight="260px"
            compact={true}
          />
        ) : (
          <p className="text-xs text-gray-500">No fine records for this student.</p>
        )}
      </div>
    );
  };

  const finesSummaryColumns = [
    {
      key: 'studentId',
      header: 'Student ID',
      sortable: true,
      accessor: (row) => row.studentId,
      render: (row) => (
        <button
          onClick={() => toggleStudent(row.studentId)}
          className="flex items-center gap-2 hover:text-blue-600"
          title="Click to view attendance details"
        >
          {expandedStudents[row.studentId] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {row.studentId}
        </button>
      ),
    },
    { key: 'name', header: 'Name', sortable: true, accessor: (row) => row.name },
    { key: 'program', header: 'Program', sortable: true, accessor: (row) => row.program || '-', cellClassName: 'text-gray-600' },
    {
      key: 'yearLevel',
      header: 'Year',
      sortable: true,
      accessor: (row) => Number(row.yearLevel || 0),
      render: (row) => row.yearLevel ? `${row.yearLevel}${['st', 'nd', 'rd', 'th'][row.yearLevel > 3 ? 3 : row.yearLevel - 1]} Year` : '-',
      cellClassName: 'text-gray-600',
    },
    {
      key: 'totalFines',
      header: 'Total Fines',
      sortable: true,
      accessor: (row) => Number(row.totalFines || 0),
      render: (row) => <span className={`font-semibold ${row.totalFines > 0 ? 'text-blue-600' : 'text-gray-600'}`}>{formatCurrency(row.totalFines)}</span>,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      key: 'unpaidFines',
      header: 'Unpaid',
      sortable: true,
      accessor: (row) => Number(row.unpaidFines || 0),
      render: (row) => <span className={`font-semibold ${row.unpaidFines > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatCurrency(row.unpaidFines)}</span>,
      headerClassName: 'text-right text-red-700',
      cellClassName: 'text-right',
    },
    {
      key: 'paidFines',
      header: 'Paid',
      sortable: true,
      accessor: (row) => Number(row.paidFines || 0),
      render: (row) => <span className={`font-semibold ${row.paidFines > 0 ? 'text-green-600' : 'text-gray-400'}`}>{formatCurrency(row.paidFines)}</span>,
      headerClassName: 'text-right text-green-700',
      cellClassName: 'text-right',
    },
    {
      key: 'fineCount',
      header: 'Count',
      sortable: true,
      accessor: (row) => Number(row.fineCount || 0),
      render: (row) => (
        <>
          {row.fineCount}
          {row.paidCount > 0 && <span className="ml-1 text-xs text-green-600">({row.paidCount} paid)</span>}
        </>
      ),
      cellClassName: 'text-right text-gray-600',
      headerClassName: 'text-right',
    },
    {
      key: 'membership',
      header: 'Membership',
      sortable: true,
      accessor: (row) => Number(row.unpaidMembership || row.paidMembership || 0),
      render: (row) => row.unpaidMembership > 0
        ? <span className="font-semibold text-red-600">{formatCurrency(row.unpaidMembership)}</span>
        : row.paidMembership > 0
          ? <span className="font-semibold text-green-600">{formatCurrency(row.paidMembership)} ✓</span>
          : <span className="text-gray-400">-</span>,
      headerClassName: 'text-right text-indigo-700',
      cellClassName: 'text-right',
    },
    {
      key: 'totalDues',
      header: 'Total Dues',
      sortable: true,
      accessor: (row) => Number(row.totalDues || 0),
      render: (row) => <span className={`font-bold ${row.totalDues > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{formatCurrency(row.totalDues || 0)}</span>,
      headerClassName: 'text-right text-orange-700',
      cellClassName: 'text-right',
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      render: (row) => {
        const studentAttendance = getStudentAttendanceDetails(row);
        return (
          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              onClick={() => handleMarkStudentFinesAsPaid(row.studentId)}
              disabled={row.unpaidFines <= 0}
              className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Mark Paid
            </button>
            <button
              onClick={() => toggleStudent(row.studentId)}
              className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
            >
              {expandedStudents[row.studentId] ? 'Hide' : 'View'}
            </button>
            <button
              onClick={() => openAttendanceModal(row, studentAttendance)}
              disabled={events.length === 0}
              className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              title="Edit attendance status for this student"
            >
              Edit Att.
            </button>
          </div>
        );
      },
    },
  ];

  const attendanceModalColumns = [
    { key: 'eventName', header: 'Event', sortable: true, accessor: (row) => row.eventName || '-', render: (row) => row.eventName || '-' },
    { key: 'date', header: 'Date', sortable: true, accessor: (row) => row.date || '-', render: (row) => row.date || '-', cellClassName: 'text-gray-600' },
    {
      key: 'session',
      header: 'Session',
      sortable: true,
      accessor: (row) => row.session || '',
      render: (row) => String(row.session || '').replace('_', ' '),
      headerClassName: 'text-center',
      cellClassName: 'text-center text-gray-700',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: false,
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      render: (row) => (
        <select
          value={row.status}
          onChange={(e) => handleModalAttendanceStatusChange(row.key, e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-xs"
          disabled={savingAttendanceEdits}
        >
          {!row.id && <option value="__not_included__">Not Included</option>}
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="excused">Excused</option>
          <option value="absent">Absent</option>
        </select>
      ),
    },
  ];

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
          <div className="mb-6">
            <DataTable
              columns={finesSummaryColumns}
              data={filteredSummary}
              rowKey={(row) => row.studentId}
              initialSortKey="totalDues"
              initialSortDirection="desc"
              pageSize={25}
              tableClassName="w-full"
              stickyHeader={true}
              maxBodyHeight="70vh"
              isRowExpanded={(row) => Boolean(expandedStudents[row.studentId])}
              renderExpandedRow={renderExpandedStudentRow}
              expandedRowColSpan={11}
            />
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
                <DataTable
                  columns={attendanceModalColumns}
                  data={attendanceModal.records}
                  rowKey={(row) => row.key}
                  initialSortKey="date"
                  initialSortDirection="desc"
                  pageSize={12}
                  pageSizeOptions={[8, 12, 20]}
                  showFooter={false}
                  tableClassName="w-full text-sm"
                  stickyHeader={true}
                  maxBodyHeight="52vh"
                  compact={true}
                />
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
