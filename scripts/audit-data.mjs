/**
 * Read-only audit of existing data, with optional, backed-up repairs.
 *
 *   node scripts/audit-data.mjs                      report only (changes nothing)
 *   node scripts/audit-data.mjs --fix-duplicates     remove duplicate fines (keeps the paid one, else the oldest)
 *   node scripts/audit-data.mjs --fix-wrong-year     remove UNPAID auto-created absences/fines of students whose
 *                                                    year level an event was not meant for
 *
 * Before any change, every document that would be removed is written to
 * scripts/backups/audit-backup-<timestamp>.json so it can be restored.
 * Needs MONGODB_URI (from .env or the environment).
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const args = new Set(process.argv.slice(2));
const FIX_DUPLICATES = args.has('--fix-duplicates');
const FIX_WRONG_YEAR = args.has('--fix-wrong-year');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

const loose = (name, collection) => mongoose.model(name, new mongoose.Schema({}, { strict: false, collection }));
const Student = loose('Student', 'students');
const Event = loose('Event', 'events');
const Attendance = loose('Attendance', 'attendances');
const Fine = loose('Fine', 'fines');

const TARGET_RE = /Target\s*:\s*(\d)(?:st|nd|rd|th)?\s*Year/i;
const targetsOf = (event) => {
  if (Array.isArray(event.target_year_levels) && event.target_year_levels.length) return event.target_year_levels.map(Number);
  const m = `${event.name || ''} ${event.description || ''}`.match(TARGET_RE);
  return m ? [Number(m[1])] : [];
};

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

const [students, events, fines, attendance] = await Promise.all([
  Student.find().lean(), Event.find().lean(), Fine.find().lean(), Attendance.find().lean(),
]);
const studentById = new Map(students.map((s) => [s.student_id, s]));
const eventById = new Map(events.map((e) => [String(e._id), e]));

const toRemove = { fines: [], attendance: [] };

// 1. Duplicate fines
const groups = new Map();
for (const f of fines) {
  if (!f.event_id) continue;
  const key = [f.student_id, f.event_id, f.reason, f.date].join('|');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(f);
}
const dupGroups = [...groups.values()].filter((g) => g.length > 1);
const dupExtras = [];
for (const g of dupGroups) {
  const keep = g.find((f) => f.paid) || g.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
  g.filter((f) => f !== keep).forEach((f) => dupExtras.push(f));
}
console.log(`\n[1] Duplicate fines: ${dupGroups.length} group(s), ${dupExtras.length} extra record(s), ` +
  `₱${dupExtras.reduce((s, f) => s + Number(f.amount || 0), 0)} double-counted`);
dupExtras.slice(0, 15).forEach((f) => console.log(`    ${f.student_id}  ${f.reason}  ₱${f.amount}  ${f.date}  paid=${!!f.paid}`));
if (FIX_DUPLICATES) toRemove.fines.push(...dupExtras);

// 2. Auto-created records for students outside the event's year level
const wrongFines = fines.filter((f) => {
  const ev = eventById.get(String(f.event_id));
  const st = studentById.get(f.student_id);
  if (!ev || !st || f.paid) return false;
  const t = targetsOf(ev);
  return t.length > 0 && !t.includes(Number(st.year_level));
});
const wrongAtt = attendance.filter((a) => {
  const ev = eventById.get(String(a.event_id));
  const st = studentById.get(a.student_id);
  if (!ev || !st || a.status !== 'absent' || a.type !== 'manual') return false;
  const t = targetsOf(ev);
  return t.length > 0 && !t.includes(Number(st.year_level));
});
console.log(`\n[2] Unpaid fines for a year level the event was not meant for: ${wrongFines.length} ` +
  `(₱${wrongFines.reduce((s, f) => s + Number(f.amount || 0), 0)}); manual absences: ${wrongAtt.length}`);
wrongFines.slice(0, 15).forEach((f) => {
  const st = studentById.get(f.student_id);
  console.log(`    ${f.student_id} (year ${st.year_level})  ${eventById.get(String(f.event_id)).name}  ₱${f.amount}`);
});
if (FIX_WRONG_YEAR) {
  toRemove.fines.push(...wrongFines);
  toRemove.attendance.push(...wrongAtt);
}

// 3. Events whose date may be the upload date (informational only: fix in Events > Edit)
const suspicious = events.filter((e) => e.created_at && String(e.date) === new Date(e.created_at).toISOString().slice(0, 10)
  && /online meeting/i.test(e.description || ''));
console.log(`\n[3] Online-meeting events dated on their upload day (check the real date, fix via Events > Edit): ${suspicious.length}`);
suspicious.slice(0, 15).forEach((e) => console.log(`    ${e.name}  date=${e.date}`));

if (toRemove.fines.length || toRemove.attendance.length) {
  const dir = path.resolve('scripts', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `audit-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(toRemove, null, 2));
  console.log(`\nBackup written: ${file}`);
  const fineIds = [...new Set(toRemove.fines.map((f) => String(f._id)))];
  const attIds = [...new Set(toRemove.attendance.map((a) => String(a._id)))];
  const r1 = fineIds.length ? await Fine.deleteMany({ _id: { $in: fineIds } }) : { deletedCount: 0 };
  const r2 = attIds.length ? await Attendance.deleteMany({ _id: { $in: attIds } }) : { deletedCount: 0 };
  console.log(`Removed ${r1.deletedCount} fine(s) and ${r2.deletedCount} attendance record(s).`);
} else if (!FIX_DUPLICATES && !FIX_WRONG_YEAR) {
  console.log('\nReport only. Nothing was changed.');
}

await mongoose.disconnect();
