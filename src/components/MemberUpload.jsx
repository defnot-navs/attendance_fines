import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { processStudentFile } from '../utils/fileParser';
import { addStudent } from '../db/hybridDatabase';

export default function MemberUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Manual entry states
  const [manualForm, setManualForm] = useState({
    studentId: '',
    lastName: '',
    firstName: '',
    middleInitial: '',
    yearLevel: '1',
    program: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [manualResult, setManualResult] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    setUploading(true);
    setResult(null);
    setError(null);

    try {
      // Process file
      const { students, errors, duplicates, totalRows, validRows } = await processStudentFile(file);

      // Upload to database
      let added = 0;
      let failed = 0;
      const uploadErrors = [];

      for (const student of students) {
        try {
          await addStudent(student);
          added++;
        } catch (err) {
          failed++;
          uploadErrors.push({
            studentId: student.studentId,
            error: err.message
          });
        }
      }

      setResult({
        totalRows,
        validRows,
        added,
        failed,
        parseErrors: errors,
        duplicates,
        uploadErrors
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    if (!manualForm.studentId.trim() || !manualForm.lastName.trim() || 
        !manualForm.firstName.trim() || !manualForm.middleInitial.trim() || 
        !manualForm.yearLevel || !manualForm.program.trim()) {
      setError('All fields are required for manual entry');
      return;
    }

    setIsAdding(true);
    setError(null);
    setManualResult(null);

    try {
      const student = {
        studentId: manualForm.studentId.trim(),
        lastName: manualForm.lastName.trim().toUpperCase(),
        firstName: manualForm.firstName.trim().toUpperCase(),
        middleInitial: manualForm.middleInitial.trim().toUpperCase(),
        yearLevel: parseInt(manualForm.yearLevel),
        program: manualForm.program.trim().toUpperCase()
      };

      await addStudent(student);
      
      setManualResult({
        success: true,
        message: `Successfully added ${student.firstName} ${student.lastName} (${student.studentId})`
      });
      
      // Clear form
      setManualForm({
        studentId: '',
        lastName: '',
        firstName: '',
        middleInitial: '',
        yearLevel: '1',
        program: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
        <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
        Upload Member List
      </h2>

      {/* Manual Entry Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Add Student Manually</h3>
        <form onSubmit={handleManualAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student ID
              </label>
              <input
                type="text"
                value={manualForm.studentId}
                onChange={(e) => setManualForm({...manualForm, studentId: e.target.value})}
                placeholder="e.g., 2021-12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={manualForm.lastName}
                onChange={(e) => setManualForm({...manualForm, lastName: e.target.value})}
                placeholder="e.g., DELA CRUZ"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={manualForm.firstName}
                onChange={(e) => setManualForm({...manualForm, firstName: e.target.value})}
                placeholder="e.g., JUAN"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Middle Initial
              </label>
              <input
                type="text"
                value={manualForm.middleInitial}
                onChange={(e) => setManualForm({...manualForm, middleInitial: e.target.value.slice(0, 1)})}
                placeholder="e.g., A"
                maxLength="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year Level
              </label>
              <select
                value={manualForm.yearLevel}
                onChange={(e) => setManualForm({...manualForm, yearLevel: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              >
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program
              </label>
              <input
                type="text"
                value={manualForm.program}
                onChange={(e) => setManualForm({...manualForm, program: e.target.value})}
                placeholder="e.g., BSIT, BSCS"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAdding}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isAdding ? 'Adding...' : 'Add Student'}
          </button>
        </form>
      </div>

      {/* Manual Entry Success */}
      {manualResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Student Added Successfully!</h3>
              <p className="text-green-700 mt-1">{manualResult.message}</p>
              <p className="text-green-600 text-sm mt-2">
                ✓ Student saved to database and ready for attendance tracking
              </p>
              <Link 
                to="/admin" 
                onClick={() => { const event = new CustomEvent('switchTab', { detail: 'students' }); window.dispatchEvent(event); }}
                className="text-green-700 underline text-sm mt-2 inline-block hover:text-green-800"
              >
                View in Students tab →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-300 my-6"></div>

      {/* File Upload */}
      <div className="mb-6">
        <label className="block mb-2 font-medium text-gray-700">
          Select CSV or Excel File
        </label>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50"
        />
        <p className="mt-2 text-sm text-gray-500">
          Required fields: Student ID, LASTNAME, FIRSTNAME, MIDDLE INITIAL, YEAR LEVEL, PROGRAM
        </p>
      </div>

      {/* Loading */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700">Processing file...</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Success Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900">Upload Summary</h3>
                <ul className="mt-2 space-y-1 text-sm text-green-700">
                  <li>Total rows: {result.totalRows}</li>
                  <li>Valid rows: {result.validRows}</li>
                  <li className="font-semibold text-green-800">✓ Successfully added: {result.added} students</li>
                  {result.failed > 0 && (
                    <li className="text-red-600 font-medium">Failed: {result.failed}</li>
                  )}
                </ul>
                {result.added > 0 && (
                  <p className="text-green-600 text-sm mt-3 border-t border-green-200 pt-2">
                    ✓ All students saved to database and ready for attendance tracking
                  </p>
                )}
                <Link 
                  to="/admin" 
                  onClick={() => { const event = new CustomEvent('switchTab', { detail: 'students' }); window.dispatchEvent(event); }}
                  className="text-green-700 underline text-sm mt-2 inline-block hover:text-green-800"
                >
                  View all students in Students tab →
                </Link>
              </div>
            </div>
          </div>

          {/* Parse Errors */}
          {result.parseErrors && result.parseErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">
                    Parse Errors ({result.parseErrors.length})
                  </h3>
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    {result.parseErrors.slice(0, 10).map((err, idx) => (
                      <p key={idx} className="text-sm text-red-700">
                        Line {err.line}: {err.error}
                      </p>
                    ))}
                    {result.parseErrors.length > 10 && (
                      <p className="text-sm text-red-600 mt-1">
                        ... and {result.parseErrors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Duplicates */}
          {result.duplicates && result.duplicates.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900">
                    Duplicate Student IDs ({result.duplicates.length})
                  </h3>
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    {result.duplicates.slice(0, 5).map((dup, idx) => (
                      <p key={idx} className="text-sm text-yellow-700">
                        Line {dup.line}: {dup.studentId}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Errors */}
          {result.uploadErrors && result.uploadErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900">
                    Database Errors ({result.uploadErrors.length})
                  </h3>
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    {result.uploadErrors.slice(0, 5).map((err, idx) => (
                      <p key={idx} className="text-sm text-red-700">
                        {err.studentId}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sample Format */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Sample CSV Format:</h3>
        <pre className="text-xs text-gray-700 bg-white p-3 rounded border overflow-x-auto">
{`Student ID,LASTNAME,FIRSTNAME,MIDDLE INITIAL
2021-12345,DELA CRUZ,JUAN,A
2021-12346,SANTOS,MARIA,B
2021-12347,REYES,PEDRO,C`}
        </pre>
      </div>
    </div>
  );
}
