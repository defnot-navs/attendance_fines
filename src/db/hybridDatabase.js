// Hybrid database layer - uses centralized backend when online, IndexedDB when offline
import { db as indexedDB } from './database';
import apiClient from '../services/apiClient';

// Check if backend is available
let backendAvailable = false;
let backendCheckPromise = null;
let lastBackendCheckAt = 0;
const BACKEND_CHECK_TTL_MS = 5000;

async function cacheStudentsSnapshot(students) {
  if (!Array.isArray(students) || students.length === 0) return;

  try {
    // Preserve existing local primary keys to avoid collisions with server IDs.
    const existing = await indexedDB.students.toArray();
    const existingIdByStudentId = new Map(existing.map(s => [s.studentId, s.id]));

    const normalized = students
      .filter(s => s && s.studentId)
      .map(s => ({
        id: existingIdByStudentId.get(s.studentId),
        studentId: s.studentId,
        lastName: (s.lastName || '').toUpperCase(),
        firstName: (s.firstName || '').toUpperCase(),
        middleInitial: (s.middleInitial || '').toUpperCase(),
        yearLevel: s.yearLevel,
        program: s.program ? String(s.program).toUpperCase() : '',
        email: s.email || '',
        createdAt: s.createdAt || new Date().toISOString(),
      }));

    await indexedDB.students.bulkPut(normalized);
  } catch (error) {
    console.warn('Student cache snapshot failed:', error);
  }
}

async function checkBackendAvailability(force = false) {
  const now = Date.now();
  if (!force && now - lastBackendCheckAt < BACKEND_CHECK_TTL_MS) {
    return backendAvailable;
  }

  if (backendCheckPromise) {
    return backendCheckPromise;
  }

  backendCheckPromise = (async () => {
    try {
      await apiClient.healthCheck();
      backendAvailable = true;
      console.log('✅ Backend server connected - using centralized database');
    } catch (error) {
      backendAvailable = false;
      console.log('⚠️ Backend unavailable - using local IndexedDB');
    } finally {
      lastBackendCheckAt = Date.now();
      backendCheckPromise = null;
    }

    return backendAvailable;
  })();

  return backendCheckPromise;
}

// Initialize - check backend availability
checkBackendAvailability();

// Periodically re-check backend availability (every 30 seconds)
setInterval(() => {
  checkBackendAvailability(true);
}, 30000);

// ===== STUDENTS =====

export async function addStudent(student) {
  await checkBackendAvailability();
  
  console.log('📝 Adding student, backend available:', backendAvailable);
  
  if (backendAvailable) {
    try {
      const result = await apiClient.addStudent({
        studentId: student.studentId,
        lastName: student.lastName,
        firstName: student.firstName,
        middleInitial: student.middleInitial,
        yearLevel: student.yearLevel,
        program: student.program,
        email: student.email || '',
      });
      console.log('✅ Student saved to MySQL:', result);
      return result;
    } catch (error) {
      console.error('❌ Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  console.log('💾 Saving to IndexedDB (offline mode)');
  const { addStudent: addStudentLocal } = await import('./database');
  return addStudentLocal(student);
}

export async function getAllStudents() {
  await checkBackendAvailability();
  
  console.log('📋 Getting students, backend available:', backendAvailable);
  
  if (backendAvailable) {
    try {
      const students = await apiClient.getAllStudents();
      console.log('✅ Loaded from MySQL:', students.length, 'students');
      // Convert MySQL snake_case to camelCase
      const mapped = students.map(s => ({
        id: s.id,
        studentId: s.student_id,
        lastName: s.last_name,
        firstName: s.first_name,
        middleInitial: s.middle_initial,
        yearLevel: s.year_level,
        program: s.program,
        email: s.email,
        createdAt: s.created_at,
      }));

      // Cache for offline scanning on this device (best-effort)
      cacheStudentsSnapshot(mapped);

      return mapped;
    } catch (error) {
      console.error('❌ Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  console.log('💾 Loading from IndexedDB (offline mode)');
  const { getAllStudents: getAllStudentsLocal } = await import('./database');
  return getAllStudentsLocal();
}

export async function getStudentByStudentId(studentId) {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const student = await apiClient.getStudentByStudentId(studentId);
      const mapped = {
        id: student.id,
        studentId: student.student_id,
        lastName: student.last_name,
        firstName: student.first_name,
        middleInitial: student.middle_initial,
        yearLevel: student.year_level,
        program: student.program,
        email: student.email,
      };

      // Cache this student for offline scanning (best-effort)
      cacheStudentsSnapshot([mapped]);

      return mapped;
    } catch (error) {
      if (error.message !== 'Student not found') {
        console.error('Backend failed, falling back to IndexedDB:', error);
        backendAvailable = false;
      } else {
        throw error;
      }
    }
  }
  
  // Fallback to IndexedDB
  const { getStudentByStudentId: getStudentLocal } = await import('./database');
  return getStudentLocal(studentId);
}

export async function deleteAllStudents() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const result = await apiClient.deleteAllStudents();
      return result.count;
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { deleteAllStudents: deleteAllLocal } = await import('./database');
  return deleteAllLocal();
}

// ===== EVENTS =====

export async function addEvent(event) {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const response = await apiClient.addEvent({
        name: event.name,
        date: event.date,
        startTime: event.startTime,
        lateThreshold: event.lateThreshold,
        endTime: event.endTime,
        fineAmount: event.fineAmount,
        description: event.description,
      });

      // Keep return shape consistent with IndexedDB addEvent (numeric id)
      if (response && typeof response === 'object' && 'id' in response) {
        return response.id;
      }

      return response;
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { addEvent: addEventLocal } = await import('./database');
  return addEventLocal(event);
}

export async function getAllEvents() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const events = await apiClient.getAllEvents();
      return events.map(e => ({
        id: e.id,
        name: e.name,
        date: e.date,
        startTime: e.start_time,
        lateThreshold: e.late_threshold,
        endTime: e.end_time,
        fineAmount: e.fine_amount,
        description: e.description,
        createdAt: e.created_at,
      }));
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { getAllEvents: getAllEventsLocal } = await import('./database');
  return getAllEventsLocal();
}

export async function deleteEvent(id) {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      return await apiClient.deleteEvent(id);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { deleteEvent: deleteEventLocal } = await import('./database');
  return deleteEventLocal(id);
}

export async function markRemainingStudentsAbsent(eventId) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.markRemainingStudentsAbsent(eventId);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { markRemainingStudentsAbsent: markLocal } = await import('./database');
  return markLocal(eventId);
}

// ===== ATTENDANCE =====

export async function recordAttendance(studentId, type = 'qr', status = 'present', eventId = null, session = 'AM_IN', dateOverride = null) {
  await checkBackendAvailability();
  
  const attendanceDate = dateOverride || new Date().toISOString().split('T')[0];
  const normalizedEventId = eventId && typeof eventId === 'object' ? eventId.id : eventId;
  
  if (backendAvailable) {
    try {
      return await apiClient.recordAttendance({
        studentId,
        eventId: normalizedEventId,
        date: attendanceDate,
        type,
        status,
        session,
      });
    } catch (error) {
      if (error.message === 'Attendance already recorded') {
        throw new Error(eventId ? 'Attendance already recorded for this event' : 'Attendance already recorded for today');
      }
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { recordAttendance: recordLocal } = await import('./database');
  return recordLocal(studentId, type, status, normalizedEventId, session, attendanceDate);
}

export async function getAllAttendance() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const attendance = await apiClient.getAllAttendance();
      return attendance.map(a => ({
        id: a.id,
        studentId: a.student_id,
        eventId: a.event_id,
        date: a.date,
        session: a.session,
        type: a.type,
        status: a.status,
        timestamp: a.timestamp,
      }));
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { getAllAttendance: getAllLocal } = await import('./database');
  return getAllLocal();
}

export async function getStudentAttendance(studentId) {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const attendance = await apiClient.getStudentAttendance(studentId);
      return attendance.map(a => ({
        id: a.id,
        studentId: a.student_id,
        eventId: a.event_id,
        date: a.date,
        session: a.session,
        type: a.type,
        status: a.status,
        timestamp: a.timestamp,
      }));
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { getStudentAttendance: getStudentLocal } = await import('./database');
  return getStudentLocal(studentId);
}

export async function clearAllAttendance() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      return await apiClient.clearAllAttendance();
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { clearAllAttendance: clearLocal } = await import('./database');
  return clearLocal();
}

export async function updateAttendance(attendanceId, updates) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.updateAttendance(attendanceId, updates);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { updateAttendance: updateLocal } = await import('./database');
  return updateLocal(attendanceId, updates);
}

export async function deleteAttendance(attendanceId) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.deleteAttendance(attendanceId);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { deleteAttendance: deleteLocal } = await import('./database');
  return deleteLocal(attendanceId);
}

// ===== FINES =====

export async function recordFine(studentId, amount, reason, date = null, eventId = null) {
  await checkBackendAvailability();
  
  const fineDate = date || new Date().toISOString().split('T')[0];
  
  if (backendAvailable) {
    try {
      return await apiClient.recordFine({
        studentId,
        eventId,
        amount,
        reason,
        date: fineDate,
      });
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { recordFine: recordFineLocal } = await import('./database');
  return recordFineLocal(studentId, amount, reason, date, eventId);
}

export async function getStudentFines(studentId) {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const fines = await apiClient.getStudentFines(studentId);
      return fines.map(f => ({
        id: f.id,
        studentId: f.student_id,
        eventId: f.event_id,
        amount: parseFloat(f.amount),
        reason: f.reason,
        date: f.date,
        paid: Boolean(f.paid),
        paidAt: f.paid_at,
        timestamp: f.timestamp,
      }));
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { getStudentFines: getStudentFinesLocal } = await import('./database');
  return getStudentFinesLocal(studentId);
}

export async function getStudentTotalFines(studentId) {
  const fines = await getStudentFines(studentId);
  return fines
    .filter(f => !f.paid)
    .reduce((total, fine) => total + parseFloat(fine.amount), 0);
}

export async function getAllFines() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const fines = await apiClient.getAllFines();
      return fines.map(f => ({
        id: f.id,
        studentId: f.student_id,
        eventId: f.event_id,
        amount: parseFloat(f.amount),
        reason: f.reason,
        date: f.date,
        paid: Boolean(f.paid),
        paidAt: f.paid_at,
        timestamp: f.timestamp,
      }));
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { getAllFines: getAllFinesLocal } = await import('./database');
  return getAllFinesLocal();
}

export async function clearAllFines() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      return await apiClient.clearAllFines();
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { clearAllFines: clearLocal } = await import('./database');
  return clearLocal();
}

export async function markFineAsPaid(fineId) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.markFineAsPaid(fineId);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { markFineAsPaid: markPaidLocal } = await import('./database');
  return markPaidLocal(fineId);
}

export async function markFineAsUnpaid(fineId) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.markFineAsUnpaid(fineId);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { markFineAsUnpaid: markUnpaidLocal } = await import('./database');
  return markUnpaidLocal(fineId);
}

export async function markAllFinesAsPaid() {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      const fines = await apiClient.getAllFines();
      const unpaid = fines.filter((f) => !f.paid);

      for (const fine of unpaid) {
        await apiClient.markFineAsPaid(fine.id);
      }

      return unpaid.length;
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { markAllFinesAsPaid: markAllLocal } = await import('./database');
  return markAllLocal();
}

export async function updateFine(fineId, updates) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.updateFine(fineId, updates);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { updateFine: updateFineLocal } = await import('./database');
  return updateFineLocal(fineId, updates);
}

export async function deleteFine(fineId) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.deleteFine(fineId);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { deleteFine: deleteFineLocal } = await import('./database');
  return deleteFineLocal(fineId);
}

// ===== FINE RULES =====

export async function getFineRules() {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      const rules = await apiClient.getFineRules();
      return rules.map(r => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
      }));
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { getFineRules: getLocal } = await import('./database');
  return getLocal();
}

export async function updateFineRule(type, amount) {
  await checkBackendAvailability();

  if (backendAvailable) {
    try {
      return await apiClient.updateFineRule(type, amount);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }

  const { updateFineRule: updateLocal } = await import('./database');
  return updateLocal(type, amount);
}

// ===== EXCUSES =====

export async function addExcuse(excuse) {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      return await apiClient.addExcuse({
        studentId: excuse.studentId,
        type: excuse.type,
        startDate: excuse.startDate,
        endDate: excuse.endDate,
        startTime: excuse.startTime,
        endTime: excuse.endTime,
        description: excuse.description,
        fileName: excuse.fileName,
        fileData: excuse.fileData,
      });
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { addExcuse: addExcuseLocal } = await import('./database');
  return addExcuseLocal(excuse);
}

export async function getAllExcuses() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      const excuses = await apiClient.getAllExcuses();
      return excuses.map(e => ({
        id: e.id,
        studentId: e.student_id,
        type: e.type,
        startDate: e.start_date,
        endDate: e.end_date,
        startTime: e.start_time,
        endTime: e.end_time,
        description: e.description,
        fileName: e.file_name,
        fileData: e.file_data,
        approved: Boolean(e.approved),
        uploadedAt: e.uploaded_at,
      }));
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { getAllExcuses: getAllExcusesLocal } = await import('./database');
  return getAllExcusesLocal();
}

export async function deleteExcuse(id) {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      return await apiClient.deleteExcuse(id);
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { deleteExcuse: deleteExcuseLocal } = await import('./database');
  return deleteExcuseLocal(id);
}

export async function clearAllExcuses() {
  await checkBackendAvailability();
  
  if (backendAvailable) {
    try {
      return await apiClient.clearAllExcuses();
    } catch (error) {
      console.error('Backend failed, falling back to IndexedDB:', error);
      backendAvailable = false;
    }
  }
  
  // Fallback to IndexedDB
  const { clearAllExcuses: clearLocal } = await import('./database');
  return clearLocal();
}

// Export the backend availability check
export { backendAvailable, checkBackendAvailability };

// Re-export other functions from original database
export * from './database';
