import React, { useState, useEffect } from 'react';
import { FileText, Upload, Trash2, CheckCircle, XCircle, Calendar, Clock, ArrowUp } from 'lucide-react';
import { addExcuse, getAllExcuses, deleteExcuse, clearAllExcuses, getAllStudents, getAllEvents, markAttendanceAsExcused, db } from '../db/hybridDatabase';
import { formatTime12Hour } from '../utils/timeFormatter';

export default function ExcuseManagement() {
  const [excuses, setExcuses] = useState([]);
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
            Excuse Management
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Upload COE, OJT, and other excuse documents</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleRemoveAll}
            disabled={excuses.length === 0}
            className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm flex-1 sm:flex-initial touch-manipulation"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Remove All</span>
            <span className="sm:hidden">Remove</span>
          </button>
          <button
            onClick={() => setShowManualExcuse(!showManualExcuse)}
            className="bg-yellow-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-yellow-700 active:bg-yellow-800 flex items-center justify-center gap-2 text-xs sm:text-sm flex-1 sm:flex-initial touch-manipulation"
          >
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Manual Excuse</span>
            <span className="sm:hidden">Manual</span>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto touch-manipulation"
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            {showForm ? 'Cancel' : 'Upload Excuse'}
          </button>
        </div>
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
        <h3 className="font-semibold text-gray-900">All Excuses ({excuses.length})</h3>
        
        {excuses.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No excuses uploaded yet</p>
            <p className="text-sm text-gray-500 mt-1">Click "Upload Excuse" to add COE, OJT, or other excuse documents</p>
          </div>
        ) : (
          <div className="space-y-2">
            {excuses.map((excuse) => (
              <div
                key={excuse.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        excuse.type === 'COE' ? 'bg-blue-100 text-blue-800' :
                        excuse.type === 'OJT' ? 'bg-purple-100 text-purple-800' :
                        excuse.type === 'Medical' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {excuse.type}
                      </span>
                      {excuse.approved && (
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                          Approved
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900">
                      Student: {getStudentName(excuse.studentId)} ({excuse.studentId})
                    </h4>
                    <div className="text-sm text-gray-600 mt-2 space-y-1">
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(excuse.startDate).toLocaleDateString()} - {new Date(excuse.endDate).toLocaleDateString()}
                      </p>
                      {excuse.startTime && excuse.endTime && (
                        <p className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatTime12Hour(excuse.startTime)} - {formatTime12Hour(excuse.endTime)}
                        </p>
                      )}
                      {excuse.description && (
                        <p className="text-gray-500 mt-1">{excuse.description}</p>
                      )}
                      {excuse.fileName && (
                        <p className="text-blue-600 mt-1">
                          📎 {excuse.fileName}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Uploaded: {new Date(excuse.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(excuse.id, excuse.studentId)}
                    className="text-red-600 hover:text-red-700 p-2"
                    title="Delete excuse"
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
