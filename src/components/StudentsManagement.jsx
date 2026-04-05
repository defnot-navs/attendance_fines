import React, { useState, useEffect } from 'react';
import { Users, Search, Trash2, Edit2, Save, X, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getAllStudents, deleteAllStudents, db } from '../db/hybridDatabase';

export default function StudentsManagement() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [result, setResult] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'studentId', direction: 'asc' });
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const allStudents = await getAllStudents();
      setStudents(allStudents);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const handleEdit = (student) => {
    setEditingId(student.id);
    setEditForm({
      lastName: student.lastName,
      firstName: student.firstName,
      middleInitial: student.middleInitial,
      yearLevel: student.yearLevel,
      program: student.program
    });
  };

  const handleSave = async (studentId) => {
    try {
      await db.students.update(studentId, {
        lastName: editForm.lastName.toUpperCase(),
        firstName: editForm.firstName.toUpperCase(),
        middleInitial: editForm.middleInitial.toUpperCase(),
        yearLevel: parseInt(editForm.yearLevel),
        program: editForm.program.toUpperCase()
      });

      setResult({
        success: true,
        message: 'Student updated successfully'
      });
      
      setEditingId(null);
      await loadStudents();
      
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error updating student: ' + error.message
      });
    }
  };

  const handleDelete = async (student) => {
    if (!confirm(`Delete student ${student.firstName} ${student.lastName} (${student.studentId})?\n\nThis will also delete all their attendance records and fines!`)) {
      return;
    }

    try {
      // Delete related records
      await db.attendance.where('studentId').equals(student.studentId).delete();
      await db.fines.where('studentId').equals(student.studentId).delete();
      await db.excuses.where('studentId').equals(student.studentId).delete();
      
      // Delete student
      await db.students.delete(student.id);

      setResult({
        success: true,
        message: `Student ${student.studentId} deleted successfully`
      });
      
      await loadStudents();
      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error deleting student: ' + error.message
      });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDeleteAll = async () => {
    const confirmMessage = `⚠️ WARNING: This will permanently delete ALL ${students.length} students and their related records (attendance, fines, excuses).\n\nThis action CANNOT be undone!\n\nType 'DELETE ALL' to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput === 'DELETE ALL') {
      try {
        const deletedCount = await deleteAllStudents();
        setResult({
          success: true,
          message: `Successfully deleted ${deletedCount} students and all their related records`
        });
        await loadStudents();
        setTimeout(() => setResult(null), 5000);
      } catch (error) {
        setResult({
          success: false,
          message: 'Error deleting students: ' + error.message
        });
      }
    } else if (userInput !== null) {
      alert('Deletion cancelled. You must type "DELETE ALL" exactly to confirm.');
    }
  };

  const filteredStudents = students
    .filter(student => {
      const search = searchTerm.toLowerCase();
      return (
        student.studentId.toLowerCase().includes(search) ||
        student.lastName.toLowerCase().includes(search) ||
        student.firstName.toLowerCase().includes(search) ||
        (student.program || '').toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle different data types
      if (sortConfig.key === 'yearLevel') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // String comparison
      aValue = String(aValue || '').toLowerCase();
      bValue = String(bValue || '').toLowerCase();
      
      const comparison = aValue.localeCompare(bValue);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

  const getYearLabel = (year) => {
    if (!year) return '-';
    return `${year}${['st', 'nd', 'rd', 'th'][year > 3 ? 3 : year - 1]} Year`;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 sm:w-8 sm:h-8" />
            Students Management
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">View and manage all registered students</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full md:w-auto">
          <div className="text-left sm:text-right">
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{students.length}</p>
            <p className="text-xs sm:text-sm text-gray-600">Total Students</p>
          </div>
          {students.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors w-full sm:w-auto text-sm"
              title="Delete all students and their records"
            >
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Clear All Students</span>
            </button>
          )}
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

      {/* Students Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading students...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {searchTerm ? 'No students found matching your search' : 'No students registered yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th 
                    className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('studentId')}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="whitespace-nowrap">Student ID</span>
                      {getSortIcon('studentId')}
                    </div>
                  </th>
                  <th 
                    className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('lastName')}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="whitespace-nowrap">Last Name</span>
                      {getSortIcon('lastName')}
                    </div>
                  </th>
                  <th 
                    className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('firstName')}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="whitespace-nowrap">First Name</span>
                      {getSortIcon('firstName')}
                    </div>
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">MI</th>
                  <th 
                    className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('program')}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      Program
                      {getSortIcon('program')}
                    </div>
                  </th>
                  <th 
                    className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('yearLevel')}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      Year
                      {getSortIcon('yearLevel')}
                    </div>
                  </th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    {editingId === student.id ? (
                      // Edit Mode
                      <>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 font-medium">
                          {student.studentId}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <input
                            type="text"
                            value={editForm.lastName}
                            onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                          />
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <input
                            type="text"
                            value={editForm.firstName}
                            onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                          />
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <input
                            type="text"
                            value={editForm.middleInitial}
                            onChange={(e) => setEditForm({...editForm, middleInitial: e.target.value.slice(0, 1)})}
                            maxLength="1"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                          />
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <input
                            type="text"
                            value={editForm.program}
                            onChange={(e) => setEditForm({...editForm, program: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                          />
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <select
                            value={editForm.yearLevel}
                            onChange={(e) => setEditForm({...editForm, yearLevel: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                          >
                            <option value="1">1st</option>
                            <option value="2">2nd</option>
                            <option value="3">3rd</option>
                            <option value="4">4th</option>
                          </select>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <button
                              onClick={() => handleSave(student.id)}
                              className="text-green-600 hover:text-green-700 p-1"
                              title="Save"
                            >
                              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-gray-600 hover:text-gray-700 p-1"
                              title="Cancel"
                            >
                              <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode
                      <>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 font-medium whitespace-nowrap">
                          {student.studentId}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                          {student.lastName}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                          {student.firstName}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                          {student.middleInitial}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                          {student.program || '-'}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                          {getYearLabel(student.yearLevel)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <button
                              onClick={() => handleEdit(student)}
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(student)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="bg-gray-50 px-4 py-3 border-t">
            <p className="text-sm text-gray-600">
              Showing {filteredStudents.length} of {students.length} students
              {searchTerm && ` (filtered)`}
            </p>
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
