/**
 * Fines Computation Utility
 * Calculates fines based on attendance records
 */

import { 
  getStudentAttendance, 
  getFineRules, 
  recordFine,
  getStudentFines,
  getAllFines,
} from '../db/hybridDatabase';

/**
 * Calculate fines for a student based on their attendance
 */
export async function calculateStudentFines(studentId) {
  const attendance = await getStudentAttendance(studentId);
  const rules = await getFineRules();
  
  // Convert rules array to map for easy lookup
  const ruleMap = {};
  rules.forEach(rule => {
    ruleMap[rule.type] = rule.amount;
  });

  let totalFines = 0;
  const breakdown = {
    absent: 0,
    late: 0,
    absentCount: 0,
    lateCount: 0
  };

  for (const record of attendance) {
    if (record.status === 'absent') {
      const amount = ruleMap.absent || 0;
      totalFines += amount;
      breakdown.absent += amount;
      breakdown.absentCount++;
    } else if (record.status === 'late') {
      const amount = ruleMap.late || 0;
      totalFines += amount;
      breakdown.late += amount;
      breakdown.lateCount++;
    }
  }

  return {
    totalFines,
    breakdown,
    attendanceCount: attendance.length
  };
}

/**
 * Auto-generate fines from attendance records
 * This should be called after marking absences or late arrivals
 */
export async function autoGenerateFines(studentId, eventId = null, status = 'late', eventMeta = null) {
  const rules = await getFineRules();
  const ruleMap = {};
  rules.forEach(rule => {
    ruleMap[rule.type] = rule.amount;
  });

  const fineDate = (eventMeta && eventMeta.date) || new Date().toISOString().split('T')[0];
  
  let fineAmount = 0;
  let fineReason = '';
  
  // Check if event has custom fine amount
  const eventFineAmount = (eventMeta && Number(eventMeta.fineAmount) > 0)
    ? Number(eventMeta.fineAmount)
    : null;
  
  if (status === 'absent') {
    // Use event-specific fine if available, otherwise use default from settings
    fineAmount = eventFineAmount || ruleMap.absent || 0;
    fineReason = 'Absent';
  } else if (status === 'late') {
    // For late: use 75% of event fine or default late fine from settings
    if (eventFineAmount) {
      fineAmount = eventFineAmount * 0.75;
    } else {
      fineAmount = ruleMap.late || 0;
    }
    fineReason = 'Late Arrival';
  }
  
  if (fineAmount > 0) {
    await recordFine(studentId, fineAmount, fineReason, fineDate, eventId);
  }
}

/**
 * Get fines summary for all students
 */
export async function getAllStudentsFinesSummary(students) {
  const summary = [];
  const allFines = await getAllFines();
  const finesByStudentId = new Map();

  for (const fine of allFines) {
    const key = fine.studentId;
    if (!finesByStudentId.has(key)) {
      finesByStudentId.set(key, []);
    }
    finesByStudentId.get(key).push(fine);
  }

  for (const student of students) {
    const fines = finesByStudentId.get(student.studentId) || [];
    const totalFines = fines.reduce((sum, fine) => sum + fine.amount, 0);
    const paidFines = fines.filter(f => f.paid).reduce((sum, fine) => sum + fine.amount, 0);
    const unpaidFines = fines.filter(f => !f.paid).reduce((sum, fine) => sum + fine.amount, 0);

    summary.push({
      studentId: student.studentId,
      name: `${student.lastName}, ${student.firstName} ${student.middleInitial}`,
      program: student.program || '',
      yearLevel: student.yearLevel || '',
      totalFines,
      paidFines,
      unpaidFines,
      fineCount: fines.length,
      paidCount: fines.filter(f => f.paid).length,
      unpaidCount: fines.filter(f => !f.paid).length
    });
  }

  // Sort by unpaid fines descending (prioritize those who owe)
  return summary.sort((a, b) => b.unpaidFines - a.unpaidFines);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount) {
  return `₱${parseFloat(amount).toFixed(2)}`;
}

/**
 * Get statistics for fines
 */
export function getFinesStatistics(finesSummary) {
  if (!finesSummary || finesSummary.length === 0) {
    return {
      totalFines: 0,
      paidFines: 0,
      unpaidFines: 0,
      averageFines: 0,
      studentsWithFines: 0,
      highestFine: 0,
      totalFineRecords: 0
    };
  }

  const totalFines = finesSummary.reduce((sum, s) => sum + s.totalFines, 0);
  const paidFines = finesSummary.reduce((sum, s) => sum + s.paidFines, 0);
  const unpaidFines = finesSummary.reduce((sum, s) => sum + s.unpaidFines, 0);
  const studentsWithFines = finesSummary.filter(s => s.totalFines > 0).length;
  const highestFine = Math.max(...finesSummary.map(s => s.totalFines));
  const totalFineRecords = finesSummary.reduce((sum, s) => sum + s.fineCount, 0);

  return {
    totalFines,
    paidFines,
    unpaidFines,
    averageFines: totalFines / finesSummary.length,
    studentsWithFines,
    highestFine,
    totalFineRecords
  };
}
