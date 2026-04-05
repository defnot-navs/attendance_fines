/**
 * Convert 24-hour time format to 12-hour format with AM/PM
 * @param {string} time24 - Time in 24-hour format (HH:MM)
 * @returns {string} Time in 12-hour format (h:MM AM/PM)
 */
export function formatTime12Hour(time24) {
  if (!time24) return '—';
  
  const [hours, minutes] = time24.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return time24;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}
