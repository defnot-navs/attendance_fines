import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import mongoose from 'mongoose';

dotenv.config();
dotenv.config({ path: 'server/.env' });

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME', 'MONGODB_URI'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const mysqlConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
};

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function toTime(value, fallback = '00:00:00') {
  if (!value) return fallback;
  if (typeof value === 'string') return value.length >= 8 ? value.slice(0, 8) : value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toTimeString().split(' ')[0].slice(0, 8);
}

function toDateTime(value, fallback = null) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

async function main() {
  let mysqlPool;

  try {
    console.log('Connecting to MySQL...');
    mysqlPool = mysql.createPool(mysqlConfig);
    await mysqlPool.query('SELECT 1');

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    const db = mongoose.connection.db;

    const collections = {
      students: db.collection('students'),
      events: db.collection('events'),
      attendances: db.collection('attendances'),
      fines: db.collection('fines'),
      finerules: db.collection('finerules'),
      excuses: db.collection('excuses'),
      membershippayments: db.collection('membershippayments'),
    };

    console.log('Reading MySQL data...');

    const [studentsRows] = await mysqlPool.query('SELECT * FROM students');
    const [eventsRows] = await mysqlPool.query('SELECT * FROM events');
    const [attendanceRows] = await mysqlPool.query('SELECT * FROM attendance');
    const [finesRows] = await mysqlPool.query('SELECT * FROM fines');
    const [fineRulesRows] = await mysqlPool.query('SELECT * FROM fine_rules');
    const [excusesRows] = await mysqlPool.query('SELECT * FROM excuses');
    const [membershipRows] = await mysqlPool.query('SELECT * FROM membership_payments');

    console.log('Clearing Mongo collections...');
    await Promise.all([
      collections.students.deleteMany({}),
      collections.events.deleteMany({}),
      collections.attendances.deleteMany({}),
      collections.fines.deleteMany({}),
      collections.finerules.deleteMany({}),
      collections.excuses.deleteMany({}),
      collections.membershippayments.deleteMany({}),
    ]);

    console.log('Migrating students...');
    const studentDocs = studentsRows.map((s) => ({
      student_id: s.student_id,
      last_name: s.last_name,
      first_name: s.first_name,
      middle_initial: s.middle_initial || '',
      year_level: s.year_level ?? 1,
      program: s.program || '',
      email: s.email || '',
      created_at: toDateTime(s.created_at, new Date()),
      updated_at: toDateTime(s.updated_at, new Date()),
    }));
    if (studentDocs.length > 0) {
      await collections.students.insertMany(studentDocs);
    }

    console.log('Migrating events...');
    const oldEventIdToMongoId = new Map();
    if (eventsRows.length > 0) {
      const eventDocs = eventsRows.map((e) => ({
        name: e.name,
        date: toDateOnly(e.date),
        start_time: toTime(e.start_time),
        late_threshold: toTime(e.late_threshold),
        end_time: toTime(e.end_time),
        fine_amount: e.fine_amount !== null ? Number(e.fine_amount) : null,
        description: e.description || '',
        created_at: toDateTime(e.created_at, new Date()),
      }));

      const insertResult = await collections.events.insertMany(eventDocs);
      eventsRows.forEach((row, idx) => {
        oldEventIdToMongoId.set(String(row.id), String(insertResult.insertedIds[idx]));
      });
    }

    const mapEventId = (mysqlEventId) => {
      if (mysqlEventId === null || mysqlEventId === undefined) return null;
      return oldEventIdToMongoId.get(String(mysqlEventId)) || null;
    };

    console.log('Migrating attendance...');
    const attendanceDocs = attendanceRows.map((a) => ({
      student_id: a.student_id,
      event_id: mapEventId(a.event_id),
      date: toDateOnly(a.date),
      session: a.session || 'AM_IN',
      type: a.type,
      status: a.status,
      timestamp: toDateTime(a.timestamp, new Date()),
    }));
    if (attendanceDocs.length > 0) {
      await collections.attendances.insertMany(attendanceDocs);
    }

    console.log('Migrating fines...');
    const fineDocs = finesRows.map((f) => ({
      student_id: f.student_id,
      event_id: mapEventId(f.event_id),
      amount: Number(f.amount || 0),
      reason: f.reason,
      date: toDateOnly(f.date),
      paid: Boolean(f.paid),
      paid_at: toDateTime(f.paid_at, null),
      timestamp: toDateTime(f.timestamp, new Date()),
    }));
    if (fineDocs.length > 0) {
      await collections.fines.insertMany(fineDocs);
    }

    console.log('Migrating fine rules...');
    const fineRuleDocs = fineRulesRows.map((r) => ({
      type: r.type,
      amount: Number(r.amount || 0),
      updated_at: toDateTime(r.updated_at, new Date()),
    }));
    if (fineRuleDocs.length > 0) {
      await collections.finerules.insertMany(fineRuleDocs);
    }

    console.log('Migrating excuses...');
    const excuseDocs = excusesRows.map((e) => ({
      student_id: e.student_id,
      type: e.type,
      start_date: toDateOnly(e.start_date),
      end_date: toDateOnly(e.end_date),
      start_time: e.start_time ? toTime(e.start_time, null) : null,
      end_time: e.end_time ? toTime(e.end_time, null) : null,
      description: e.description || '',
      file_name: e.file_name || null,
      file_data: e.file_data || null,
      approved: e.approved === null || e.approved === undefined ? true : Boolean(e.approved),
      uploaded_at: toDateTime(e.uploaded_at, new Date()),
    }));
    if (excuseDocs.length > 0) {
      await collections.excuses.insertMany(excuseDocs);
    }

    console.log('Migrating membership payments...');
    const membershipDocs = membershipRows.map((m) => ({
      student_id: m.student_id,
      amount: Number(m.amount || 0),
      paid: Boolean(m.paid),
      paid_at: toDateTime(m.paid_at, null),
      payment_method: m.payment_method || null,
      receipt_number: m.receipt_number || null,
      national_membership: Boolean(m.national_membership),
      national_receipt_number: m.national_receipt_number || null,
      academic_year: m.academic_year,
      semester: m.semester,
      created_at: toDateTime(m.created_at, new Date()),
    }));
    if (membershipDocs.length > 0) {
      await collections.membershippayments.insertMany(membershipDocs);
    }

    console.log('Migration complete.');
    console.log(`Students: ${studentDocs.length}`);
    console.log(`Events: ${eventsRows.length}`);
    console.log(`Attendance: ${attendanceDocs.length}`);
    console.log(`Fines: ${fineDocs.length}`);
    console.log(`Fine rules: ${fineRuleDocs.length}`);
    console.log(`Excuses: ${excuseDocs.length}`);
    console.log(`Membership: ${membershipDocs.length}`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (mysqlPool) {
      await mysqlPool.end();
    }
    await mongoose.disconnect();
  }
}

main();
