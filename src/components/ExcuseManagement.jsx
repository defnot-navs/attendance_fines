import React, { useState, useEffect } from 'react';
import { FileText, Upload, Trash2, CheckCircle, XCircle, Calendar, Clock, ArrowUp, Search, Paperclip, ShieldCheck, Layers } from 'lucide-react';
import { addExcuse, getAllExcuses, deleteExcuse, clearAllExcuses, getAllStudents, getAllEvents, markAttendanceAsExcused, db } from '../db/hybridDatabase';
import { formatTime12Hour } from '../utils/timeFormatter';

export default function ExcuseManagement() {
  const [excuses, setExcuses] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    studentId: '',
    type: 'COE',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    description: '',
    fileName: '',
    fileData: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showManualExcuse, setShowManualExcuse] = useState(false);
  const [manualExcuseData, setManualExcuseData] = useState({
    studentId: '',
    eventId: '',
    reason: ''
  });
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
    try {
      const [allExcuses, allStudents, allEvents] = await Promise.all([
        getAllExcuses(),
        getAllStudents(),
        getAllEvents()
      ]);
      setExcuses(allExcuses);
      setStudents(allStudents);
      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData({
          ...formData,
          fileName: file.name,
          fileData: event.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.studentId || !formData.startDate || !formData.endDate) {
      setError('Student ID, start date, and end date are required');
      return;
    }

    setIsAdding(true);
    setError(null);
    setResult(null);

    try {
      await addExcuse(formData);
      
      setResult({
        success: true,
        message: `Excuse added successfully for Student ID: ${formData.studentId}`
      });
      
      // Reset form
      setFormData({
        studentId: '',
        type: 'COE',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        description: '',
        fileName: '',
        fileData: ''
      });
      setSelectedFile(null);
      setShowForm(false);
      
      // Reload data
      await loadData();
      
      setTimeout(() => setResult(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id, studentId) => {
    if (!confirm(`Delete excuse for Student ID: ${studentId}?`)) {
      return;
    }

    try {
      await deleteExcuse(id);
      setResult({
        success: true,
        message: 'Excuse deleted successfully'
      });
      await loadData();
      setTimeout(() => setResult(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveAll = async () => {
    const confirmText = 'DELETE ALL';
    const userInput = prompt(
      `⚠️ WARNING: Remove ALL excuse records?\n\n` +
      `This will delete ${excuses.length} excuse record(s).\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        setError('Remove all cancelled - confirmation text did not match');
        setTimeout(() => setError(null), 3000);
      }
      return;
    }

    try {
      await clearAllExcuses();
      setResult({
        success: true,
        message: `Successfully removed ${excuses.length} excuse record(s)`
      });
      await loadData();
      setTimeout(() => setResult(null), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleManualExcuse = async (e) => {
    e.preventDefault();
    
    if (!manualExcuseData.studentId || !manualExcuseData.eventId) {
      setError('Student ID and Event are required');
      return;
    }

    try {
      // Find the attendance record
      const attendance = await db.attendance
        .where({ studentId: manualExcuseData.studentId, eventId: parseInt(manualExcuseData.eventId) })
        .first();

      if (attendance) {
        await markAttendanceAsExcused(attendance.id, manualExcuseData.reason || 'Manual excuse');
        setResult({
          success: true,
          message: `Student ${manualExcuseData.studentId} marked as excused for the selected event`
        });
      } else {
        setError('No attendance record found for this student and event');
      }

      setManualExcuseData({ studentId: '', eventId: '', reason: '' });
      setShowManualExcuse(false);
      await loadData();
      setTimeout(() => setResult(null), 5000);
    } catch (err) {
      setError(err.message);
    }
  };

  const getStudentName = (studentId) => {
    const student = students.find(s => s.studentId === studentId);
    return student ? `${student.firstName} ${student.lastName}` : studentId;
  };

  const TYPE_STYLES = {
    COE: 'bg-blue-100 text-blue-800 ring-blue-200',
    OJT: 'bg-purple-100 text-purple-800 ring-purple-200',
    Medical: 'bg-red-100 text-red-800 ring-red-200',
  };
  const typeStyle = (type) => TYPE_STYLES[type] || 'bg-gray-100 text-gray-800 ring-gray-200';

  const excuseTypes = ['All', ...Array.from(new Set(excuses.map((e) => e.type).filter(Boolean)))];
  const approvedCount = excuses.filter((e) => e.approved).length;
  const uniqueStudents = new Set(excuses.map((e) => e.studentId)).size;
  const filteredExcuses = excuses.filter((e) => {
    if (typeFilter !== 'All' && e.type !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(e.studentId).toLowerCase().includes(q) ||
      getStudentName(e.studentId).toLowerCase().includes(q) ||
      String(e.description || '').toLowerCase().includes(q)
    );
  });
  const initials = (studentId) =>
    getStudentName(studentId).split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Excuse Management</h2>
            <p className="text-sm text-slate-500">Upload COE, OJT, and other excuse documents</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center gap-2 text-sm font-medium flex-1 sm:flex-initial touch-manipulation transition-colors"
          >
            <Upload className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Upload Excuse'}
          </button>
          <button
            onClick={() => setShowManualExcuse(!showManualExcuse)}
            className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-amber-600 active:bg-amber-700 flex items-center justify-center gap-2 text-sm font-medium flex-1 sm:flex-initial touch-manipulation transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Manual Excuse
          </button>
          <button
            onClick={handleRemoveAll}
            disabled={excuses.length === 0}
            className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 active:bg-red-100 disabled:text-slate-400 disabled:border-slate-200 disabled:bg-slate-50 flex items-center justify-center gap-2 text-sm font-medium flex-1 sm:flex-initial touch-manipulation transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remove All
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total excuses', value: excuses.length, Icon: Layers, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Approved', value: approvedCount, Icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600' },
          { label: 'Students covered', value: uniqueStudents, Icon: FileText, tone: 'bg-purple-50 text-purple-600' },
        ].map(({ label, value, Icon, tone }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${tone}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Result/Error Messages */}
      {result && (
        <div className={`mb-4 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <p className={result.success ? 'text-green-800' : 'text-red-800'}>{result.message}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Manual Excuse Form */}
      {showManualExcuse && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Manual Excuse Marking</h3>
          <form onSubmit={handleManualExcuse} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student ID *
                </label>
                <input
                  type="text"
                  value={manualExcuseData.studentId}
                  onChange={(e) => setManualExcuseData({...manualExcuseData, studentId: e.target.value})}
                  placeholder="Enter student ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event *
                </label>
                <select
                  value={manualExcuseData.eventId}
                  onChange={(e) => setManualExcuseData({...manualExcuseData, eventId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                >
                  <option value="">Select event</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={manualExcuseData.reason}
                onChange={(e) => setManualExcuseData({...manualExcuseData, reason: e.target.value})}
                placeholder="Reason for excuse"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <button
              type="submit"
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
            >
              Mark as Excused
            </button>
          </form>
        </div>
      )}

      {/* Upload Excuse Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Upload Excuse Document</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student ID *
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                  placeholder="Enter student ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                >
                  <option value="COE">COE (Certificate of Employment)</option>
                  <option value="OJT">OJT Deployment</option>
                  <option value="Medical">Medical Certificate</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time (Optional)
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time (Optional)
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAdding}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Additional details about the excuse..."
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Document (Optional)
              </label>
              <input
                type="file"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-1">Selected: {selectedFile.name}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isAdding ? 'Adding...' : 'Add Excuse'}
            </button>
          </form>
        </div>
      )}

      {/* Excuses List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">
            All Excuses <span className="text-slate-400 font-normal">({filteredExcuses.length}{filteredExcuses.length !== excuses.length ? ` of ${excuses.length}` : ''})</span>
          </h3>
          {excuses.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID or notes"
                  className="w-full sm:w-64 pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                {excuseTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                      typeFilter === t
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {excuses.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <p className="text-lg font-semibold text-slate-800">No excuses uploaded yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Add COE, OJT, medical or other excuse documents so absences are excused automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" /> Upload Excuse
              </button>
              <button
                onClick={() => setShowManualExcuse(true)}
                className="inline-flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                <CheckCircle className="w-4 h-4" /> Mark manually
              </button>
            </div>
          </div>
        ) : filteredExcuses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
            No excuses match your search.{' '}
            <button className="text-blue-600 hover:underline" onClick={() => { setSearch(''); setTypeFilter('All'); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExcuses.map((excuse) => (
              <div
                key={excuse.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                    {initials(excuse.studentId)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-900 truncate">{getStudentName(excuse.studentId)}</h4>
                      <span className="text-xs text-slate-500">{excuse.studentId}</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ring-1 ${typeStyle(excuse.type)}`}>
                        {excuse.type}
                      </span>
                      {excuse.approved && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full ring-1 bg-green-100 text-green-800 ring-green-200">
                          Approved
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(excuse.startDate).toLocaleDateString()} - {new Date(excuse.endDate).toLocaleDateString()}
                      </p>
                      {excuse.startTime && excuse.endTime && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {formatTime12Hour(excuse.startTime)} - {formatTime12Hour(excuse.endTime)}
                        </p>
                      )}
                      {excuse.fileName && (
                        <p className="flex items-center gap-1.5 text-blue-600">
                          <Paperclip className="w-4 h-4" />
                          {excuse.fileName}
                        </p>
                      )}
                    </div>
                    {excuse.description && <p className="text-sm text-slate-500 mt-2">{excuse.description}</p>}
                    <p className="text-xs text-slate-400 mt-2">
                      Uploaded {new Date(excuse.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(excuse.id, excuse.studentId)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Delete excuse"
                    aria-label="Delete excuse"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
