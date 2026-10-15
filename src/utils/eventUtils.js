/**
 * Shared helpers for event dates and year-level targeting.
 */

const TARGET_RE = /Target\s*:\s*(\d)(?:st|nd|rd|th)?\s*Year/i;

export const YEAR_LEVELS = [1, 2, 3, 4];

export function ordinalYear(year) {
  const n = Number(year);
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} Year`;
}

/**
 * Parse an event date string ("YYYY-MM-DD", optionally followed by a time) as a LOCAL date.
 * `new Date("2026-10-05")` is parsed as UTC midnight, which shows the previous day in
 * timezones behind UTC. Event dates are calendar dates, so they must not be shifted.
 */
export function parseEventDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatEventDate(value, options) {
  const d = parseEventDate(value);
  if (!d) return '-';
  return d.toLocaleDateString(options ? 'en-US' : undefined, options);
}

/**
 * Year levels an event is restricted to. Empty array = open to every year level.
 * Falls back to the legacy "(Target: 1st Year)" text in the description for events
 * created before targets were stored explicitly.
 */
export function getEventTargetYears(event) {
  const explicit = event?.targetYearLevels ?? event?.target_year_levels;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(Number).filter((n) => Number.isFinite(n));
  }
  const match = `${event?.name || ''} ${event?.description || ''}`.match(TARGET_RE);
  return match ? [Number(match[1])] : [];
}

export function isEventForYear(event, yearLevel) {
  const targets = getEventTargetYears(event);
  return targets.length === 0 || targets.includes(Number(yearLevel));
}

/** Today's date as YYYY-MM-DD in the user's local timezone (toISOString() would use UTC). */
export function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const NAME_YEAR_WORDS = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4 };

/**
 * An event with NO stored year level whose name says it is for one year (e.g.
 * "BSIS-JPCS 1st year REPRESENTATIVE ELECTION") is treated as open to everyone, which charges
 * every year level. Returns the year the name suggests, or null. Never applied automatically.
 */
export function suggestTargetYearFromName(event) {
  const explicit = event?.targetYearLevels ?? event?.target_year_levels;
  if (Array.isArray(explicit) && explicit.length > 0) return null;
  if (TARGET_RE.test(`${event?.name || ''} ${event?.description || ''}`)) return null;
  const match = String(event?.name || '').match(/\b(1st|2nd|3rd|4th|first|second|third|fourth)\s+year/i);
  return match ? NAME_YEAR_WORDS[match[1].toLowerCase()] : null;
}
