/**
 * Academic term helpers (Philippine school calendar):
 *   Aug - Dec  -> 1st Semester of  <year>-<year+1>
 *   Jan - May  -> 2nd Semester of  <year-1>-<year>
 *   Jun - Jul  -> Summer of        <year-1>-<year>
 */
export function currentAcademicTerm(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan
  if (month >= 7) return { academicYear: `${year}-${year + 1}`, semester: '1st Semester' };
  if (month <= 4) return { academicYear: `${year - 1}-${year}`, semester: '2nd Semester' };
  return { academicYear: `${year - 1}-${year}`, semester: 'Summer' };
}

const STORAGE_KEY = 'membership.term';
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

/** The term the admin last picked on this device, else the current term. */
export function getInitialTerm() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && /^\d{4}-\d{4}$/.test(saved.academicYear) && SEMESTERS.includes(saved.semester)) {
      return saved;
    }
  } catch {
    // storage unavailable: fall through to the computed term
  }
  return currentAcademicTerm();
}

export function rememberTerm(term) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(term));
  } catch {
    // best effort only
  }
}
