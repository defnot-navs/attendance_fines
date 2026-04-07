import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, DollarSign, Search, CreditCard, Plus, Mail, Trash2, ArrowUp } from 'lucide-react';
import { 
  getAllMembershipPayments, 
  initializeMembershipPayments,
  markMembershipAsPaid,
  markMembershipAsUnpaid,
  clearAllMembershipPayments,
  db,
  addStudent
} from '../db/hybridDatabase';
import { formatCurrency } from '../utils/finesCalculator';
import DataTable from './common/DataTable';

export default function MembershipRegistration() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'paid', 'unpaid'
  const [searchTerm, setSearchTerm] = useState('');
  const [result, setResult] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showManualInputModal, setShowManualInputModal] = useState(false);
  const [showNewMemberModal, setShowNewMemberModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'Cash',
    receiptNumber: '',
    nationalMembership: false,
    nationalReceiptNumber: '',
    email: ''
  });
  const [manualPaymentForm, setManualPaymentForm] = useState({
    studentId: '',
    email: '',
    paymentMethod: 'Cash',
    receiptNumber: '',
    nationalMembership: false,
    nationalReceiptNumber: ''
  });
  const [newMemberForm, setNewMemberForm] = useState({
    studentId: '',
    lastName: '',
    firstName: '',
    middleInitial: '',
    yearLevel: 1,
    program: 'BSIS',
    email: '',
    paymentMethod: 'Cash',
    receiptNumber: '',
    nationalMembership: false,
    nationalReceiptNumber: ''
  });

  // Settings
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [semester, setSemester] = useState('1st Semester');
  const [membershipAmount, setMembershipAmount] = useState(100);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [academicYear, semester]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const allPayments = await getAllMembershipPayments(academicYear, semester);
      setPayments(allPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializePayments = async () => {
    if (!confirm(`Initialize membership payments for ${academicYear} ${semester}?\n\nThis will create payment records for all students who don't have one yet.\nAmount: ${formatCurrency(membershipAmount)}`)) {
      return;
    }

    try {
      const count = await initializeMembershipPayments(academicYear, semester, membershipAmount);
      setResult({
        success: true,
        message: `Successfully initialized ${count} new membership payment records`
      });
      await loadPayments();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error initializing payments: ' + error.message
      });
    }
  };
  const handleNewMemberSubmit = async () => {
    // Validate required fields
    if (!newMemberForm.studentId || !newMemberForm.lastName || !newMemberForm.firstName) {
      setResult({
        success: false,
        message: 'Student ID, Last Name, and First Name are required'
      });
      setTimeout(() => setResult(null), 3000);
      return;
    }

    try {
      // Check if student already exists
      const existingStudent = await db.students.where('studentId').equals(newMemberForm.studentId).first();
      if (existingStudent) {
        setResult({
          success: false,
          message: `Student ID ${newMemberForm.studentId} already exists`
        });
        setTimeout(() => setResult(null), 3000);
        return;
      }

      // Add new student
      await addStudent({
        studentId: newMemberForm.studentId,
        lastName: newMemberForm.lastName,
        firstName: newMemberForm.firstName,
        middleInitial: newMemberForm.middleInitial || '',
        yearLevel: newMemberForm.yearLevel,
        program: newMemberForm.program,
        email: newMemberForm.email
      });

      // Create membership payment record as PAID
      await db.membershipPayments.add({
        studentId: newMemberForm.studentId,
        amount: membershipAmount,
        paid: true,
        paidAt: new Date().toISOString(),
        paymentMethod: newMemberForm.paymentMethod,
        receiptNumber: newMemberForm.receiptNumber || null,
        nationalMembership: newMemberForm.nationalMembership || false,
        nationalReceiptNumber: newMemberForm.nationalReceiptNumber || null,
        academicYear: academicYear,
        semester: semester,
        createdAt: new Date().toISOString(),
        synced: false
      });

      setResult({
        success: true,
        message: `New member ${newMemberForm.firstName} ${newMemberForm.lastName} added successfully`
      });

      setShowNewMemberModal(false);
      setNewMemberForm({
        studentId: '',
        lastName: '',
        firstName: '',
        middleInitial: '',
        yearLevel: 1,
        program: 'BSIS',
        email: '',
        paymentMethod: 'Cash',
        receiptNumber: '',
        nationalMembership: false,
        nationalReceiptNumber: ''
      });
      await loadPayments();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error adding new member: ' + error.message
      });
      setTimeout(() => setResult(null), 3000);
    }
  };
  const handleMarkAsPaid = async (payment) => {
    // Load student email if available
    const student = await db.students.where('studentId').equals(payment.studentId).first();
    setPaymentForm({
      paymentMethod: 'Cash',
      receiptNumber: '',
      nationalMembership: false,
      nationalReceiptNumber: '',
      email: student?.email || ''
    });
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async () => {

    try {
      // Update student email if provided
      if (paymentForm.email) {
        const student = await db.students.where('studentId').equals(selectedPayment.studentId).first();
        if (student && student.email !== paymentForm.email) {
          await db.students.update(student.id, { email: paymentForm.email });
        }
      }

      await markMembershipAsPaid(
        selectedPayment.id,
        paymentForm.paymentMethod,
        paymentForm.receiptNumber,
        paymentForm.nationalMembership,
        paymentForm.nationalReceiptNumber
      );
      
      setResult({
        success: true,
        message: `Marked ${selectedPayment.name} as PAID (Renewal)`
      });
      
      setShowPaymentModal(false);
      setPaymentForm({ 
        paymentMethod: 'Cash', 
        receiptNumber: '',
        nationalMembership: false,
        nationalReceiptNumber: '',
        email: ''
      });
      await loadPayments();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error marking as paid: ' + error.message
      });
    }
  };

  const handleMarkAsUnpaid = async (payment) => {
    if (!confirm(`Mark ${payment.name} as UNPAID?\n\nThis will remove their payment record.`)) {
      return;
    }

    try {
      await markMembershipAsUnpaid(payment.id);
      setResult({
        success: true,
        message: `Marked ${payment.name} as UNPAID`
      });
      await loadPayments();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error marking as unpaid: ' + error.message
      });
    }
  };

  const handleDeletePayment = async (payment) => {
    if (!confirm(`Delete membership payment record for ${payment.name}?\n\nStudent ID: ${payment.studentId}\nAmount: ${formatCurrency(payment.amount)}\nStatus: ${payment.paid ? 'PAID' : 'UNPAID'}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await db.membershipPayments.delete(payment.id);
      setResult({
        success: true,
        message: `Deleted membership payment record for ${payment.name}`
      });
      await loadPayments();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error deleting payment: ' + error.message
      });
    }
  };

  const handleRemoveAll = async () => {
    const confirmText = 'DELETE ALL';
    const userInput = prompt(
      `⚠️ WARNING: Remove ALL membership payment records?\n\n` +
      `This will delete ${payments.length} payment record(s) for ${academicYear} ${semester}.\n\n` +
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
      // Filter and delete only current academic year/semester
      const paymentsToDelete = await db.membershipPayments
        .filter(p => p.academicYear === academicYear && p.semester === semester)
        .toArray();
      
      for (const payment of paymentsToDelete) {
        await db.membershipPayments.delete(payment.id);
      }

      setResult({
        success: true,
        message: `Successfully removed ${paymentsToDelete.length} membership payment record(s)`
      });
      
      await loadPayments();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error removing payments: ' + error.message
      });
    }
  };

  const handleManualPaymentSubmit = async () => {

    try {
      // Find student
      const student = await db.students.where('studentId').equals(manualPaymentForm.studentId).first();
      
      if (!student) {
        setResult({
          success: false,
          message: `Student ID ${manualPaymentForm.studentId} not found`
        });
        setTimeout(() => setResult(null), 3000);
        return;
      }

      // Update student email if provided
      if (manualPaymentForm.email && student.email !== manualPaymentForm.email) {
        await db.students.update(student.id, { email: manualPaymentForm.email });
      }

      // Check if payment record exists
      let payment = await db.membershipPayments
        .where('studentId').equals(manualPaymentForm.studentId)
        .and(p => p.academicYear === academicYear && p.semester === semester)
        .first();

      if (!payment) {
        // Create new payment record
        await db.membershipPayments.add({
          studentId: manualPaymentForm.studentId,
          amount: membershipAmount,
          paid: true,
          paidAt: new Date().toISOString(),
          paymentMethod: manualPaymentForm.paymentMethod,
          receiptNumber: manualPaymentForm.receiptNumber || null,
          nationalMembership: manualPaymentForm.nationalMembership || false,
          nationalReceiptNumber: manualPaymentForm.nationalReceiptNumber || null,
          academicYear: academicYear,
          semester: semester,
          createdAt: new Date().toISOString(),
          synced: false
        });
      } else {
        // Update existing record
        await markMembershipAsPaid(
          payment.id,
          manualPaymentForm.paymentMethod,
          manualPaymentForm.receiptNumber,
          manualPaymentForm.nationalMembership,
          manualPaymentForm.nationalReceiptNumber
        );
      }

      setResult({
        success: true,
        message: `Payment recorded for ${student.firstName} ${student.lastName}`
      });

      setShowManualInputModal(false);
      setManualPaymentForm({
        studentId: '',
        email: '',
        paymentMethod: 'Cash',
        receiptNumber: '',
        nationalMembership: false,
        nationalReceiptNumber: ''
      });
      await loadPayments();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error recording payment: ' + error.message
      });
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = searchTerm === '' || 
      payment.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.program && payment.program.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (activeTab === 'paid') return matchesSearch && payment.paid;
    if (activeTab === 'unpaid') return matchesSearch && !payment.paid;
    return matchesSearch;
  });

  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.paid).length,
    unpaid: payments.filter(p => !p.paid).length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
    collectedAmount: payments.filter(p => p.paid).reduce((sum, p) => sum + p.amount, 0),
    pendingAmount: payments.filter(p => !p.paid).reduce((sum, p) => sum + p.amount, 0)
  };

  const membershipColumns = [
    {
      key: 'studentId',
      header: 'Student ID',
      sortable: true,
      accessor: (row) => row.studentId,
      cellClassName: 'font-medium',
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      accessor: (row) => row.name,
    },
    {
      key: 'program',
      header: 'Program',
      sortable: true,
      accessor: (row) => row.program,
      cellClassName: 'text-gray-600',
    },
    {
      key: 'yearLevel',
      header: 'Year',
      sortable: true,
      accessor: (row) => row.yearLevel,
      render: (row) => row.yearLevel ? `${row.yearLevel}${['st', 'nd', 'rd', 'th'][row.yearLevel > 3 ? 3 : row.yearLevel - 1]}` : '-',
      cellClassName: 'text-gray-600',
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      accessor: (row) => Number(row.amount || 0),
      render: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span>,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => row.paid ? 'Paid' : 'Unpaid',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      render: (row) => row.paid ? (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Paid
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Unpaid
        </span>
      ),
    },
    {
      key: 'paymentInfo',
      header: 'Payment Info',
      sortable: true,
      accessor: (row) => row.paidAt || '',
      render: (row) => row.paid ? (
        <div className="text-xs">
          <div className="font-medium">{row.paymentMethod}</div>
          {row.receiptNumber && <div className="text-gray-500">OR# {row.receiptNumber}</div>}
          <div className="text-gray-400">{new Date(row.paidAt).toLocaleDateString()}</div>
        </div>
      ) : (
        <span className="text-gray-400">-</span>
      ),
      cellClassName: 'text-gray-600',
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.paid ? (
            <button
              onClick={() => handleMarkAsUnpaid(row)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Mark Unpaid
            </button>
          ) : (
            <button
              onClick={() => handleMarkAsPaid(row)}
              className="text-green-600 hover:text-green-800 text-sm font-medium"
            >
              Mark Paid
            </button>
          )}
          <button
            onClick={() => handleDeletePayment(row)}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Delete payment record"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
            Membership Registration
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Track membership payment status</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowNewMemberModal(true)}
            className="flex items-center justify-center gap-1 sm:gap-2 bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 active:bg-purple-800 text-xs sm:text-sm flex-1 sm:flex-initial touch-manipulation"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">New Member</span>
            <span className="sm:hidden">New</span>
          </button>
          <button
            onClick={() => setShowManualInputModal(true)}
            className="flex items-center justify-center gap-1 sm:gap-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 active:bg-green-800 text-xs sm:text-sm flex-1 sm:flex-initial touch-manipulation"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Manual Input</span>
            <span className="sm:hidden">Manual</span>
          </button>
          <button
            onClick={handleInitializePayments}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 text-xs sm:text-sm w-full sm:w-auto touch-manipulation"
          >
            Initialize
          </button>
          <button
            onClick={handleRemoveAll}
            className="flex items-center justify-center gap-1 sm:gap-2 bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 active:bg-red-800 text-xs sm:text-sm w-full sm:w-auto touch-manipulation"
            title="Remove all membership payment records"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Remove All</span>
            <span className="sm:hidden">Remove</span>
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

      {/* Settings */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm touch-manipulation"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm touch-manipulation"
          >
            <option>1st Semester</option>
            <option>2nd Semester</option>
            <option>Summer</option>
          </select>
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Membership Amount</label>
          <input
            type="number"
            value={membershipAmount}
            onChange={(e) => setMembershipAmount(parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            step="10"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Expected</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Collected</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.collectedAmount)}</p>
              <p className="text-xs text-green-600">{stats.paid} members</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-red-900">{formatCurrency(stats.pendingAmount)}</p>
              <p className="text-xs text-red-600">{stats.unpaid} members</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Total Members</p>
              <p className="text-2xl font-bold text-purple-900">{stats.total}</p>
              <p className="text-xs text-purple-600">{stats.total > 0 ? Math.round(stats.paid / stats.total * 100) : 0}% paid</p>
            </div>
            <Users className="w-8 h-8 text-purple-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'all'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'paid'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Paid ({stats.paid})
        </button>
        <button
          onClick={() => setActiveTab('unpaid')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'unpaid'
              ? 'border-b-2 border-red-600 text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Unpaid ({stats.unpaid})
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by Student ID, Name, or Program..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={membershipColumns}
        data={filteredPayments}
        rowKey={(row) => row.id}
        initialSortKey="studentId"
        initialSortDirection="asc"
        pageSize={25}
        loading={loading}
        loadingMessage="Loading membership records..."
        emptyMessage={payments.length === 0
          ? 'No payment records. Click "Initialize Payments" to create records for all students.'
          : 'No members found matching your search'}
        tableClassName="w-full"
      />

      {/* Payment Modal (Renewal) */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Mark Payment as Paid (Renewal)</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">Student: <span className="font-medium text-gray-900">{selectedPayment.name}</span></p>
              <p className="text-sm text-gray-600">Student ID: <span className="font-medium text-gray-900">{selectedPayment.studentId}</span></p>
              <p className="text-sm text-gray-600">Amount: <span className="font-medium text-gray-900">{formatCurrency(selectedPayment.amount)}</span></p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={paymentForm.email}
                onChange={(e) => setPaymentForm({...paymentForm, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="student@example.com"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option>Cash</option>
                <option>GCash</option>
                <option>Bank Transfer</option>
                <option>Check</option>
                <option>Other</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number (Optional)</label>
              <input
                type="text"
                value={paymentForm.receiptNumber}
                onChange={(e) => setPaymentForm({...paymentForm, receiptNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="OR-XXXXXX"
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={paymentForm.nationalMembership}
                  onChange={(e) => setPaymentForm({...paymentForm, nationalMembership: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                National Membership
              </label>
            </div>

            {paymentForm.nationalMembership && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">National Receipt Number (Optional)</label>
                <input
                  type="text"
                  value={paymentForm.nationalReceiptNumber}
                  onChange={(e) => setPaymentForm({...paymentForm, nationalReceiptNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="NOR-XXXXXX"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentForm({ 
                    paymentMethod: 'Cash', 
                    receiptNumber: '',
                    nationalMembership: false,
                    nationalReceiptNumber: '',
                    email: ''
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Input Modal */}
      {showManualInputModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Manual Payment Input
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
              <input
                type="text"
                value={manualPaymentForm.studentId}
                onChange={(e) => setManualPaymentForm({...manualPaymentForm, studentId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., 25-07026"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={manualPaymentForm.email}
                onChange={(e) => setManualPaymentForm({...manualPaymentForm, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="student@example.com"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="text"
                value={formatCurrency(membershipAmount)}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={manualPaymentForm.paymentMethod}
                onChange={(e) => setManualPaymentForm({...manualPaymentForm, paymentMethod: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option>Cash</option>
                <option>GCash</option>
                <option>Bank Transfer</option>
                <option>Check</option>
                <option>Other</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number (Optional)</label>
              <input
                type="text"
                value={manualPaymentForm.receiptNumber}
                onChange={(e) => setManualPaymentForm({...manualPaymentForm, receiptNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="OR-XXXXXX"
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={manualPaymentForm.nationalMembership}
                  onChange={(e) => setManualPaymentForm({...manualPaymentForm, nationalMembership: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                National Membership
              </label>
            </div>

            {manualPaymentForm.nationalMembership && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">National Receipt Number (Optional)</label>
                <input
                  type="text"
                  value={manualPaymentForm.nationalReceiptNumber}
                  onChange={(e) => setManualPaymentForm({...manualPaymentForm, nationalReceiptNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="NOR-XXXXXX"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowManualInputModal(false);
                  setManualPaymentForm({
                    studentId: '',
                    email: '',
                    paymentMethod: 'Cash',
                    receiptNumber: '',
                    nationalMembership: false,
                    nationalReceiptNumber: ''
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleManualPaymentSubmit}
                disabled={!manualPaymentForm.studentId}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Member Modal */}
      {showNewMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Register New Member
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
                <input
                  type="text"
                  value={newMemberForm.studentId}
                  onChange={(e) => setNewMemberForm({...newMemberForm, studentId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 25-07026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={newMemberForm.email}
                  onChange={(e) => setNewMemberForm({...newMemberForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="student@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={newMemberForm.lastName}
                  onChange={(e) => setNewMemberForm({...newMemberForm, lastName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="DELA CRUZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  value={newMemberForm.firstName}
                  onChange={(e) => setNewMemberForm({...newMemberForm, firstName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="JUAN"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">M.I.</label>
                <input
                  type="text"
                  value={newMemberForm.middleInitial}
                  onChange={(e) => setNewMemberForm({...newMemberForm, middleInitial: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="P"
                  maxLength="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <select
                  value={newMemberForm.program}
                  onChange={(e) => setNewMemberForm({...newMemberForm, program: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option>BSIS</option>
                  <option>BSIT</option>
                  <option>BSCS</option>
                  <option>ACT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                <select
                  value={newMemberForm.yearLevel}
                  onChange={(e) => setNewMemberForm({...newMemberForm, yearLevel: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={1}>1st Year</option>
                  <option value={2}>2nd Year</option>
                  <option value={3}>3rd Year</option>
                  <option value={4}>4th Year</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-gray-900 mb-3">Payment Information</h4>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="text"
                  value={formatCurrency(membershipAmount)}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={newMemberForm.paymentMethod}
                    onChange={(e) => setNewMemberForm({...newMemberForm, paymentMethod: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option>Cash</option>
                    <option>GCash</option>
                    <option>Bank Transfer</option>
                    <option>Check</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number (Optional)</label>
                  <input
                    type="text"
                    value={newMemberForm.receiptNumber}
                    onChange={(e) => setNewMemberForm({...newMemberForm, receiptNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="OR-XXXXXX"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={newMemberForm.nationalMembership}
                    onChange={(e) => setNewMemberForm({...newMemberForm, nationalMembership: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  National Membership
                </label>
              </div>

              {newMemberForm.nationalMembership && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">National Receipt Number (Optional)</label>
                  <input
                    type="text"
                    value={newMemberForm.nationalReceiptNumber}
                    onChange={(e) => setNewMemberForm({...newMemberForm, nationalReceiptNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="NOR-XXXXXX"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowNewMemberModal(false);
                  setNewMemberForm({
                    studentId: '',
                    lastName: '',
                    firstName: '',
                    middleInitial: '',
                    yearLevel: 1,
                    program: 'BSIS',
                    email: '',
                    paymentMethod: 'Cash',
                    receiptNumber: '',
                    nationalMembership: false,
                    nationalReceiptNumber: ''
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNewMemberSubmit}
                disabled={!newMemberForm.studentId || !newMemberForm.lastName || !newMemberForm.firstName}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                Register Member
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
