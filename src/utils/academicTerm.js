/**
 * Academic term helpers (Philippine school calendar):
 *   Aug - Dec  -> 1st Semester of  <year>-<year+1>
 *   Jan - May  -> 2nd Semester of  <year-1>-<year>
 *   Jun - Jul  -> Summer of        <year-1>-<year>
 *
 * The authoritative current term is the system-wide setting stored on the server
 * (Settings > Academic Year). This module only provides the calendar fallback and a
 * device-local cache so pages have a sensible value before/without the server.
 */
export const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

export function currentAcademicTerm(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan
  if (month >= 7) return { academicYear: `${year}-${year + 1}`, semester: '1st Semester' };
  if (month <= 4) return { academicYear: `${year - 1}-${year}`, semester: '2nd Semester' };
  return { academicYear: `${year - 1}-${year}`, semester: 'Summer' };
}

export function isValidAcademicYear(value) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(value || ''));
  return Boolean(match) && Number(match[2]) === Number(match[1]) + 1;
}

const CACHE_KEY = 'academicTerm.cache';

/** Last term received from the server on this device, else the calendar term. */
export function getInitialTerm() {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (saved && isValidAcademicYear(saved.academicYear) && SEMESTERS.includes(saved.semester)) {
      return saved;
    }
  } catch {
    // storage unavailable: fall through to the computed term
  }
  return currentAcademicTerm();
}

export function cacheTerm(term) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(term));
  } catch {
    // best effort only
  }
}
