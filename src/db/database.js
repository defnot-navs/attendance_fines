import Dexie from 'dexie';

/**
 * IndexedDB Database Schema
 * This is the offline-first storage layer
 */
export class AttendanceDatabase extends Dexie {
  constructor() {
    super('AttendanceFinesDB');
    
    this.version(15).stores({
      // Students/Members table - added yearLevel, program, and email
      students: '++id, &studentId, lastName, firstName, middleInitial, yearLevel, program, email',
      
      // Events table - added fineAmount for custom event fines
      events: '++id, name, date, startTime, lateThreshold, endTime, fineAmount, description, createdAt',
      
      // Attendance records - added compound index for studentId+date and eventId
      attendance: '++id, studentId, eventId, date, session, [studentId+date], [studentId+date+session], [studentId+eventId+session], type, timestamp, status, synced',
      
      // Fines records - added paid status
      fines: '++id, studentId, eventId, amount, reason, date, timestamp, paid, paidAt, synced',
      
      // Fine rules configuration
      fineRules: '++id, type, amount',
      
      // Excuses/COE documents
      excuses: '++id, studentId, type, startDate, endDate, startTime, endTime, description, fileName, fileData, uploadedAt, approved',
      
      // Membership payments - added national membership fields
      membershipPayments: '++id, &studentId, amount, paid, paidAt, paymentMethod, receiptNumber, nationalMembership, nationalReceiptNumber, academicYear, semester, createdAt, synced',
      
      // Sync queue for offline changes
      syncQueue: '++id, table, action, data, timestamp, synced'
    });

    this.students = this.table('students');
    this.events = this.table('events');
    this.attendance = this.table('attendance');
    this.fines = this.table('fines');
    this.fineRules = this.table('fineRules');
    this.excuses = this.table('excuses');
    this.membershipPayments = this.table('membershipPayments');
    this.syncQueue = this.table('syncQueue');
  }
}

// Create singleton instance
export const db = new AttendanceDatabase();

/**
 * Initialize default fine rules if none exist
 */
export async function initializeFineRules() {
  const count = await db.fineRules.count();
  
  if (count === 0) {
    await db.fineRules.bulkAdd([
      { type: 'absent', amount: 50 },
      { type: 'late', amount: 20 }
    ]);
  }
}

/**
 * Initialize sample event with attendance and fines
 */
export async function initializeSampleData() {
  try {
    // Check if sample event already exists
    const eventCount = await db.events.count();
    if (eventCount > 0) return; // Don't add if events already exist

    // Check if we have students
    const studentCount = await db.students.count();
    if (studentCount === 0) return; // Need students first

    // Create sample event
    const today = new Date();
    const eventDate = today.toISOString().split('T')[0];
    
    const eventId = await db.events.add({
      name: 'Weekly General Assembly',
      date: eventDate,
      startTime: '08:00',
      lateThreshold: '08:15',
      endTime: '10:00',
      description: 'Sample event - Weekly mandatory meeting for all members',
      createdAt: new Date().toISOString()
    });

    // Get first 5 students
    const students = await db.students.limit(5).toArray();
    
    if (students.length > 0) {
      // Add sample attendance records
      const attendanceRecords = [];
      const fineRecords = [];
      
      // Student 1: Present (no fine)
      if (students[0]) {
        attendanceRecords.push({
          studentId: students[0].studentId,
          eventId: eventId,
          date: eventDate,
          type: 'qr',
          timestamp: new Date().toISOString(),
          status: 'present',
          synced: false
        });
      }
      
      // Student 2: Late (75% fine)
      if (students[1]) {
        attendanceRecords.push({
          studentId: students[1].studentId,
          eventId: eventId,
          date: eventDate,
          type: 'qr',
          timestamp: new Date().toISOString(),
          status: 'late',
          synced: false
        });
        
        fineRecords.push({
          studentId: students[1].studentId,
          eventId: eventId,
          amount: 37.50, // 75% of 50
          reason: 'Late Arrival (75% of absent fine)',
          date: eventDate,
          timestamp: new Date().toISOString(),
          synced: false
        });
      }
      
      // Student 3: Absent (full fine)
      if (students[2]) {
        attendanceRecords.push({
          studentId: students[2].studentId,
          eventId: eventId,
          date: eventDate,
          type: 'manual',
          timestamp: new Date().toISOString(),
          status: 'absent',
          synced: false
        });
        
        fineRecords.push({
          studentId: students[2].studentId,
          eventId: eventId,
          amount: 50.00,
          reason: 'Absent',
          date: eventDate,
          timestamp: new Date().toISOString(),
          synced: false
        });
      }
      
      // Student 4: Present (no fine)
      if (students[3]) {
        attendanceRecords.push({
          studentId: students[3].studentId,
          eventId: eventId,
          date: eventDate,
          type: 'qr',
          timestamp: new Date().toISOString(),
          status: 'present',
          synced: false
        });
      }
      
      // Student 5: Late (75% fine)
      if (students[4]) {
        attendanceRecords.push({
          studentId: students[4].studentId,
          eventId: eventId,
          date: eventDate,
          type: 'manual',
          timestamp: new Date().toISOString(),
          status: 'late',
          synced: false
        });
        
        fineRecords.push({
          studentId: students[4].studentId,
          eventId: eventId,
          amount: 37.50,
          reason: 'Late Arrival (75% of absent fine)',
          date: eventDate,
          timestamp: new Date().toISOString(),
          synced: false
        });
      }
      
      // Add all records
      if (attendanceRecords.length > 0) {
        await db.attendance.bulkAdd(attendanceRecords);
      }
      
      if (fineRecords.length > 0) {
        await db.fines.bulkAdd(fineRecords);
      }
      
      console.log('Sample event data initialized successfully!');
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

/**
 * Add student to database
 */
export async function addStudent(student) {
  try {
    const id = await db.students.add({
      studentId: student.studentId,
      lastName: student.lastName.toUpperCase(),
      firstName: student.firstName.toUpperCase(),
      middleInitial: student.middleInitial.toUpperCase(),
      yearLevel: student.yearLevel,
      program: student.program ? student.program.toUpperCase() : '',
      email: student.email || '',
      createdAt: new Date().toISOString()
    });
    
    // Add to sync queue
    await db.syncQueue.add({
      table: 'students',
      action: 'add',
      data: student,
      timestamp: new Date().toISOString(),
      synced: false
    });
    
    return id;
  } catch (error) {
    if (error.name === 'ConstraintError') {
      throw new Error(`Student ID ${student.studentId} already exists`);
    }
    throw error;
  }
}

/**
 * Get student by Student ID
 */
export async function getStudentByStudentId(studentId) {
  return await db.students.where('studentId').equals(studentId).first();
}

/**
 * Get all students
 */
export async function getAllStudents() {
  return await db.students.toArray();
}

/**
 * Delete all students and their related records (attendance, fines, excuses)
 * @returns {Promise<number>} Number of students deleted
 */
export async function deleteAllStudents() {
  try {
    // Get count before deletion
    const count = await db.students.count();
    
    // Delete all related records first
    await db.attendance.clear();
    await db.fines.clear();
    await db.excuses.clear();
    
    // Delete all students
    await db.students.clear();
    
    return count;
  } catch (error) {
    console.error('Error deleting all students:', error);
    throw error;
  }
}

/**
 * Record attendance
 */
export async function recordAttendance(studentId, type = 'qr', status = 'present', eventId = null, session = 'AM_IN') {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if already recorded for this event (or today if no event)
  let existing;
  if (eventId) {
    existing = await db.attendance
      .where('[studentId+eventId+session]')
      .equals([studentId, eventId, session])
      .first();
  } else {
    existing = await db.attendance
      .where('[studentId+date+session]')
      .equals([studentId, today, session])
      .first();
  }
  
  if (existing) {
    throw new Error(eventId ? 'Attendance already recorded for this event' : 'Attendance already recorded for today');
  }
  
  const record = {
    studentId,
    eventId,
    date: today,
    session,
    type, // 'qr' or 'online' or 'manual'
    timestamp: new Date().toISOString(),
    status, // 'present', 'late', 'absent'
    synced: false
  };
  
  const id = await db.attendance.add(record);
  
  // Add to sync queue
  await db.syncQueue.add({
    table: 'attendance',
    action: 'add',
    data: record,
    timestamp: new Date().toISOString(),
    synced: false
  });
  
  return id;
}

/**
 * Get attendance for a student
 */
export async function getStudentAttendance(studentId) {
  return await db.attendance
    .where('studentId')
    .equals(studentId)
    .reverse()
    .sortBy('date');
}

/**
 * Get all attendance records
 */
export async function getAllAttendance() {
  return await db.attendance.reverse().sortBy('timestamp');
}

/**
 * Delete a single attendance record by ID
 */
export async function deleteAttendance(attendanceId) {
  return await db.attendance.delete(attendanceId);
}

/**
 * Clear all attendance records
 */
export async function clearAllAttendance() {
  return await db.attendance.clear();
}

/**
 * Record a fine
 */
export async function recordFine(studentId, amount, reason, date = null, eventId = null) {
  const record = {
    studentId,
    eventId,
    amount: parseFloat(amount),
    reason,
    date: date || new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    paid: false,
    paidAt: null,
    synced: false
  };
  
  const id = await db.fines.add(record);
  
  // Add to sync queue
  await db.syncQueue.add({
    table: 'fines',
    action: 'add',
    data: record,
    timestamp: new Date().toISOString(),
    synced: false
  });
  
  return id;
}

/**
 * Get fines for a student
 */
export async function getStudentFines(studentId) {
  return await db.fines
    .where('studentId')
    .equals(studentId)
    .reverse()
    .sortBy('date');
}

/**
 * Get total fines for a student
 */
export async function getStudentTotalFines(studentId) {
  const fines = await getStudentFines(studentId);
  return fines
    .filter(fine => !fine.paid)
    .reduce((total, fine) => total + fine.amount, 0);
}

/**
 * Cache Student Portal data for offline viewing.
 *
 * This writes directly to IndexedDB and does NOT enqueue anything for sync.
 * Intended for read-only snapshots pulled from the server.
 */
export async function cacheStudentPortalSnapshot({ student, attendance = [], fines = [], events = [] }) {
  if (!student || !student.studentId) return;

  const normalizedStudent = {
    studentId: String(student.studentId).trim(),
    lastName: (student.lastName || '').toUpperCase(),
    firstName: (student.firstName || '').toUpperCase(),
    middleInitial: (student.middleInitial || '').toUpperCase(),
    yearLevel: student.yearLevel,
    program: student.program ? String(student.program).toUpperCase() : '',
    email: student.email || '',
    createdAt: student.createdAt || new Date().toISOString(),
  };

  await db.transaction('rw', db.students, db.events, db.attendance, db.fines, async () => {
    // Upsert student by unique &studentId
    await db.students.put(normalizedStudent);

    // Upsert events by id so eventId relationships remain consistent offline
    if (Array.isArray(events) && events.length > 0) {
      const normalizedEvents = events
        .filter(e => e && (e.id !== undefined && e.id !== null))
        .map(e => ({
          id: e.id,
          name: e.name,
          date: e.date,
          startTime: e.startTime ?? null,
          lateThreshold: e.lateThreshold ?? null,
          endTime: e.endTime ?? null,
          fineAmount: e.fineAmount ?? null,
          description: e.description ?? '',
          createdAt: e.createdAt ?? new Date().toISOString(),
        }));
      if (normalizedEvents.length > 0) {
        await db.events.bulkPut(normalizedEvents);
      }
    }

    // Replace previously cached (synced=true) snapshots for this student only.
    // This avoids touching locally-created offline records (synced=false).
    await db.attendance.where('studentId').equals(normalizedStudent.studentId).and(r => r.synced === true).delete();
    await db.fines.where('studentId').equals(normalizedStudent.studentId).and(r => r.synced === true).delete();

    if (Array.isArray(attendance) && attendance.length > 0) {
      const normalizedAttendance = attendance
        .filter(a => a && a.studentId)
        .map(a => ({
          studentId: a.studentId,
          eventId: a.eventId ?? null,
          date: a.date,
          session: a.session ?? 'AM_IN',
          type: a.type,
          timestamp: a.timestamp || new Date().toISOString(),
          status: a.status,
          synced: true,
        }));
      if (normalizedAttendance.length > 0) {
        await db.attendance.bulkAdd(normalizedAttendance);
      }
    }

    if (Array.isArray(fines) && fines.length > 0) {
      const normalizedFines = fines
        .filter(f => f && f.studentId)
        .map(f => ({
          studentId: f.studentId,
          eventId: f.eventId ?? null,
          amount: parseFloat(f.amount),
          reason: f.reason,
          date: f.date,
          timestamp: f.timestamp || new Date().toISOString(),
          paid: Boolean(f.paid),
          paidAt: f.paidAt ?? null,
          synced: true,
        }));
      if (normalizedFines.length > 0) {
        await db.fines.bulkAdd(normalizedFines);
      }
    }
  });
}

/**
 * Get all fines
 */
export async function getAllFines() {
  return await db.fines.toArray();
}

/**
 * Mark a fine as paid
 */
export async function markFineAsPaid(fineId) {
  try {
    await db.fines.update(fineId, {
      paid: true,
      paidAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error marking fine as paid:', error);
    throw error;
  }
}

/**
 * Mark a fine as unpaid
 */
export async function markFineAsUnpaid(fineId) {
  try {
    await db.fines.update(fineId, {
      paid: false,
      paidAt: null
    });
    return true;
  } catch (error) {
    console.error('Error marking fine as unpaid:', error);
    throw error;
  }
}

/**
 * Update fine details
 */
export async function updateFine(fineId, updates) {
  try {
    const patch = {};
    if (updates.amount !== undefined) {
      patch.amount = parseFloat(updates.amount);
    }
    if (updates.reason !== undefined) {
      patch.reason = String(updates.reason);
    }
    if (updates.date !== undefined) {
      patch.date = String(updates.date);
    }

    await db.fines.update(fineId, patch);
    return true;
  } catch (error) {
    console.error('Error updating fine:', error);
    throw error;
  }
}

/**
 * Delete a single fine
 */
export async function deleteFine(fineId) {
  try {
    await db.fines.delete(fineId);
    return true;
  } catch (error) {
    console.error('Error deleting fine:', error);
    throw error;
  }
}

/**
 * Mark all fines as paid
 */
export async function markAllFinesAsPaid() {
  try {
    const allFines = await db.fines.toArray();
    const paidAt = new Date().toISOString();
    
    await db.fines.toCollection().modify(fine => {
      fine.paid = true;
      fine.paidAt = paidAt;
    });
    
    return allFines.length;
  } catch (error) {
    console.error('Error marking all fines as paid:', error);
    throw error;
  }
}

/**
 * Clear all fines (delete them completely)
 */
export async function clearAllFines() {
  try {
    const count = await db.fines.count();
    await db.fines.clear();
    return count;
  } catch (error) {
    console.error('Error clearing all fines:', error);
    throw error;
  }
}

/**
 * Membership Payment Functions
 */

/**
 * Initialize membership payment records for all students
 */
export async function initializeMembershipPayments(academicYear, semester, amount) {
  try {
    const students = await db.students.toArray();
    const existingPayments = await db.membershipPayments
      .where('academicYear').equals(academicYear)
      .and(payment => payment.semester === semester)
      .toArray();
    
    const existingStudentIds = new Set(existingPayments.map(p => p.studentId));
    
    const newPayments = students
      .filter(s => !existingStudentIds.has(s.studentId))
      .map(student => ({
        studentId: student.studentId,
        amount: amount,
        paid: false,
        paidAt: null,
        paymentMethod: null,
        receiptNumber: null,
        academicYear: academicYear,
        semester: semester,
        createdAt: new Date().toISOString(),
        synced: false
      }));
    
    if (newPayments.length > 0) {
      await db.membershipPayments.bulkAdd(newPayments);
    }
    
    return newPayments.length;
  } catch (error) {
    console.error('Error initializing membership payments:', error);
    throw error;
  }
}

/**
 * Mark a membership payment as paid
 */
export async function markMembershipAsPaid(paymentId, paymentMethod, receiptNumber, nationalMembership = false, nationalReceiptNumber = null) {
  try {
    await db.membershipPayments.update(paymentId, {
      paid: true,
      paidAt: new Date().toISOString(),
      paymentMethod: paymentMethod || 'Cash',
      receiptNumber: receiptNumber || null,
      nationalMembership: nationalMembership || false,
      nationalReceiptNumber: nationalReceiptNumber || null
    });
    return true;
  } catch (error) {
    console.error('Error marking membership as paid:', error);
    throw error;
  }
}

/**
 * Mark a membership payment as unpaid
 */
export async function markMembershipAsUnpaid(paymentId) {
  try {
    await db.membershipPayments.update(paymentId, {
      paid: false,
      paidAt: null,
      paymentMethod: null,
      receiptNumber: null,
      nationalMembership: false,
      nationalReceiptNumber: null
    });
    return true;
  } catch (error) {
    console.error('Error marking membership as unpaid:', error);
    throw error;
  }
}

/**
 * Clear all membership payments
 */
export async function clearAllMembershipPayments() {
  try {
    const count = await db.membershipPayments.count();
    await db.membershipPayments.clear();
    return count;
  } catch (error) {
    console.error('Error clearing membership payments:', error);
    throw error;
  }
}

/**
 * Get all membership payments with student info
 */
export async function getAllMembershipPayments(academicYear = null, semester = null) {
  try {
    let payments = await db.membershipPayments.toArray();
    
    if (academicYear) {
      payments = payments.filter(p => p.academicYear === academicYear);
    }
    if (semester) {
      payments = payments.filter(p => p.semester === semester);
    }
    
    const students = await db.students.toArray();
    const studentMap = {};
    students.forEach(s => {
      studentMap[s.studentId] = s;
    });
    
    return payments.map(payment => {
      const student = studentMap[payment.studentId] || {};
      return {
        ...payment,
        name: student.id ? `${student.lastName}, ${student.firstName} ${student.middleInitial}` : 'Unknown',
        program: student.program || '-',
        yearLevel: student.yearLevel || '-'
      };
    });
  } catch (error) {
    console.error('Error getting membership payments:', error);
    throw error;
  }
}

/**
 * Get fine rules
 */
export async function getFineRules() {
  return await db.fineRules.toArray();
}

/**
 * Update fine rule
 */
export async function updateFineRule(type, amount) {
  const rule = await db.fineRules.where('type').equals(type).first();
  
  if (rule) {
    await db.fineRules.update(rule.id, { amount: parseFloat(amount) });
  } else {
    await db.fineRules.add({ type, amount: parseFloat(amount) });
  }
}

/**
 * Clear all data (admin reset)
 */
export async function clearAllData() {
  await db.students.clear();
  await db.attendance.clear();
  await db.fines.clear();
  await db.syncQueue.clear();
}

/**
 * Get sync queue items
 */
export async function getSyncQueue() {
  try {
    return await db.syncQueue.where('synced').equals(false).toArray();
  } catch (error) {
    // If no items exist or table is empty, return empty array
    console.warn('getSyncQueue error:', error);
    return [];
  }
}

/**
 * Add event
 */
export async function addEvent(eventData) {
  const event = {
    name: eventData.name,
    date: eventData.date,
    startTime: eventData.startTime || null,
    lateThreshold: eventData.lateThreshold || null,
    endTime: eventData.endTime || null,
    fineAmount: eventData.fineAmount || null,
    description: eventData.description || '',
    createdAt: new Date().toISOString()
  };
  
  return await db.events.add(event);
}

/**
 * Get all events
 */
export async function getAllEvents() {
  return await db.events.orderBy('date').reverse().toArray();
}

/**
 * Get event by ID
 */
export async function getEventById(id) {
  return await db.events.get(id);
}

/**
 * Delete event
 */
export async function deleteEvent(id) {
  await db.events.delete(id);
}

/**
 * Mark remaining students as absent for an event
 * This is called after the event's end time has passed
 */
export async function markRemainingStudentsAbsent(eventId) {
  try {
    // Get the event
    const event = await getEventById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Get all students
    const allStudents = await getAllStudents();
    
    // Get all attendance records for this event
    const eventAttendance = await db.attendance
      .where('eventId')
      .equals(eventId)
      .toArray();
    
    // Get student IDs who already have attendance recorded
    const recordedStudentIds = new Set(eventAttendance.map(a => a.studentId));
    
    // Find students who haven't been marked
    const absentStudents = allStudents.filter(s => !recordedStudentIds.has(s.studentId));
    
    // Get the absent fine rule
    const absentFineRule = await getFineRules().then(rules => 
      rules.find(r => r.type === 'absent')
    );
    
    let markedCount = 0;
    
    // Mark each absent student and create fines
    for (const student of absentStudents) {
      // Record absent attendance
      await recordAttendance(student.studentId, 'manual', 'absent', eventId);
      
      // Record fine if rule exists
      if (absentFineRule && absentFineRule.amount > 0) {
        await recordFine(
          student.studentId,
          absentFineRule.amount,
          `Absent - ${event.name}`,
          event.date,
          eventId
        );
      }
      
      markedCount++;
    }
    
    return {
      success: true,
      markedCount,
      eventName: event.name
    };
  } catch (error) {
    console.error('Error marking absent students:', error);
    throw error;
  }
}

/**
 * Mark sync queue item as synced
 */
export async function markAsSynced(id) {
  await db.syncQueue.update(id, { synced: true });
}

/**
 * Add excuse/COE document
 */
export async function addExcuse(excuseData) {
  const excuse = {
    studentId: excuseData.studentId,
    type: excuseData.type, // 'COE', 'OJT', 'Medical', 'Other'
    startDate: excuseData.startDate,
    endDate: excuseData.endDate,
    startTime: excuseData.startTime || null,
    endTime: excuseData.endTime || null,
    description: excuseData.description || '',
    fileName: excuseData.fileName || null,
    fileData: excuseData.fileData || null, // Base64 encoded file
    uploadedAt: new Date().toISOString(),
    approved: excuseData.approved !== undefined ? excuseData.approved : true
  };
  
  const id = await db.excuses.add(excuse);
  
  // Auto-mark conflicting events as excused
  await autoMarkExcusedAttendance(excuseData.studentId, excuse.startDate, excuse.endDate, excuse.startTime, excuse.endTime);
  
  return id;
}

/**
 * Get all excuses for a student
 */
export async function getStudentExcuses(studentId) {
  return await db.excuses.where('studentId').equals(studentId).toArray();
}

/**
 * Get all excuses
 */
export async function getAllExcuses() {
  return await db.excuses.toArray();
}

/**
 * Delete excuse
 */
export async function deleteExcuse(id) {
  await db.excuses.delete(id);
}

/**
 * Clear all excuses
 */
export async function clearAllExcuses() {
  return await db.excuses.clear();
}

/**
 * Manually mark attendance as excused
 */
export async function markAttendanceAsExcused(attendanceId, reason = 'Manual excuse') {
  await db.attendance.update(attendanceId, { 
    status: 'excused',
    excuseReason: reason
  });
  
  // Remove any associated fines for this attendance
  const attendance = await db.attendance.get(attendanceId);
  if (attendance) {
    await db.fines
      .where({ studentId: attendance.studentId, eventId: attendance.eventId })
      .delete();
  }
}

/**
 * Auto-mark attendance as excused based on excuse date/time conflicts
 */
async function autoMarkExcusedAttendance(studentId, startDate, endDate, startTime, endTime) {
  try {
    // Get all events within the excuse date range
    const allEvents = await getAllEvents();
    const conflictingEvents = allEvents.filter(event => {
      const eventDate = event.date;
      
      // Check if event date falls within excuse range
      if (eventDate >= startDate && eventDate <= endDate) {
        // If times are specified, check time overlap
        if (startTime && endTime && event.startTime && event.endTime) {
          // Check if event time overlaps with excuse time
          return !(event.endTime < startTime || event.startTime > endTime);
        }
        return true; // Date matches, no time specified
      }
      return false;
    });
    
    // Mark attendance as excused for conflicting events
    for (const event of conflictingEvents) {
      // Check if attendance record exists
      const existingAttendance = await db.attendance
        .where({ studentId, eventId: event.id })
        .toArray();
      
      if (existingAttendance.length > 0) {
        // Update all existing session records to excused
        for (const record of existingAttendance) {
          await db.attendance.update(record.id, {
            status: 'excused',
            excuseReason: 'Auto-excused due to approved excuse document'
          });
        }

        // Remove fines
        await db.fines
          .where({ studentId, eventId: event.id })
          .delete();
      } else {
        // Create excused attendance record
        await recordAttendance(studentId, 'manual', 'excused', event.id);
      }
    }
    
    return conflictingEvents.length;
  } catch (error) {
    console.error('Error auto-marking excused attendance:', error);
    throw error;
  }
}

/**
 * Check if student has valid excuse for a date/time
 */
export async function hasValidExcuse(studentId, eventDate, eventStartTime = null, eventEndTime = null) {
  const excuses = await db.excuses
    .where('studentId')
    .equals(studentId)
    .and(excuse => excuse.approved)
    .toArray();
  
  for (const excuse of excuses) {
    // Check date range
    if (eventDate >= excuse.startDate && eventDate <= excuse.endDate) {
      // If times are specified, check time overlap
      if (eventStartTime && eventEndTime && excuse.startTime && excuse.endTime) {
        if (!(eventEndTime < excuse.startTime || eventStartTime > excuse.endTime)) {
          return { valid: true, excuse };
        }
      } else {
        return { valid: true, excuse };
      }
    }
  }
  
  return { valid: false };
}

