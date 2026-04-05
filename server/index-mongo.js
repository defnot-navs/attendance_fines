import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let dbReady = false;

const studentSchema = new mongoose.Schema(
  {
    student_id: { type: String, required: true, unique: true, index: true },
    last_name: { type: String, required: true },
    first_name: { type: String, required: true },
    middle_initial: { type: String, default: '' },
    year_level: { type: Number, default: 1 },
    program: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: String, required: true },
    start_time: { type: String, required: true },
    late_threshold: { type: String, required: true },
    end_time: { type: String, required: true },
    fine_amount: { type: Number, default: null },
    description: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

const attendanceSchema = new mongoose.Schema(
  {
    student_id: { type: String, required: true, index: true },
    event_id: { type: String, default: null, index: true },
    date: { type: String, required: true, index: true },
    session: { type: String, default: 'AM_IN', index: true },
    type: { type: String, enum: ['qr', 'online', 'manual'], required: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const fineSchema = new mongoose.Schema(
  {
    student_id: { type: String, required: true, index: true },
    event_id: { type: String, default: null, index: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    date: { type: String, required: true, index: true },
    paid: { type: Boolean, default: false },
    paid_at: { type: Date, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const fineRuleSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    updated_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const excuseSchema = new mongoose.Schema(
  {
    student_id: { type: String, required: true, index: true },
    type: { type: String, required: true },
    start_date: { type: String, required: true },
    end_date: { type: String, required: true },
    start_time: { type: String, default: null },
    end_time: { type: String, default: null },
    description: { type: String, default: '' },
    file_name: { type: String, default: null },
    file_data: { type: String, default: null },
    approved: { type: Boolean, default: true },
    uploaded_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const membershipSchema = new mongoose.Schema(
  {
    student_id: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    paid_at: { type: Date, default: null },
    payment_method: { type: String, default: null },
    receipt_number: { type: String, default: null },
    national_membership: { type: Boolean, default: false },
    national_receipt_number: { type: String, default: null },
    academic_year: { type: String, required: true },
    semester: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Student = mongoose.model('Student', studentSchema);
const Event = mongoose.model('Event', eventSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Fine = mongoose.model('Fine', fineSchema);
const FineRule = mongoose.model('FineRule', fineRuleSchema);
const Excuse = mongoose.model('Excuse', excuseSchema);
const MembershipPayment = mongoose.model('MembershipPayment', membershipSchema);

const toId = (value) => String(value);

const mapStudent = (doc) => ({
  id: toId(doc._id),
  student_id: doc.student_id,
  last_name: doc.last_name,
  first_name: doc.first_name,
  middle_initial: doc.middle_initial,
  year_level: doc.year_level,
  program: doc.program,
  email: doc.email,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
});

const mapEvent = (doc) => ({
  id: toId(doc._id),
  name: doc.name,
  date: doc.date,
  start_time: doc.start_time,
  late_threshold: doc.late_threshold,
  end_time: doc.end_time,
  fine_amount: doc.fine_amount,
  description: doc.description,
  created_at: doc.created_at,
});

const mapAttendance = (doc) => ({
  id: toId(doc._id),
  student_id: doc.student_id,
  event_id: doc.event_id,
  date: doc.date,
  session: doc.session,
  type: doc.type,
  status: doc.status,
  timestamp: doc.timestamp,
});

const mapFine = (doc) => ({
  id: toId(doc._id),
  student_id: doc.student_id,
  event_id: doc.event_id,
  amount: doc.amount,
  reason: doc.reason,
  date: doc.date,
  paid: doc.paid,
  paid_at: doc.paid_at,
  timestamp: doc.timestamp,
});

const mapExcuse = (doc) => ({
  id: toId(doc._id),
  student_id: doc.student_id,
  type: doc.type,
  start_date: doc.start_date,
  end_date: doc.end_date,
  start_time: doc.start_time,
  end_time: doc.end_time,
  description: doc.description,
  file_name: doc.file_name,
  file_data: doc.file_data,
  approved: doc.approved,
  uploaded_at: doc.uploaded_at,
});

const mapMembership = (doc, student) => ({
  id: toId(doc._id),
  student_id: doc.student_id,
  amount: doc.amount,
  paid: doc.paid,
  paid_at: doc.paid_at,
  payment_method: doc.payment_method,
  receipt_number: doc.receipt_number,
  national_membership: doc.national_membership,
  national_receipt_number: doc.national_receipt_number,
  academic_year: doc.academic_year,
  semester: doc.semester,
  created_at: doc.created_at,
  last_name: student?.last_name,
  first_name: student?.first_name,
  middle_initial: student?.middle_initial,
  year_level: student?.year_level,
  program: student?.program,
});

function formatErrorMessage(error, fallback) {
  const message =
    (error && typeof error.message === 'string' && error.message.trim()) ||
    (error && typeof error.code === 'string' && error.code.trim()) ||
    fallback;
  return message;
}

function ensureDb(req, res, next) {
  if (!dbReady) return res.status(503).json({ error: 'Database not available' });
  next();
}

async function initDatabase() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    dbReady = true;
    console.log('✅ Connected to MongoDB');

    await FineRule.updateOne(
      { type: 'absent' },
      { $setOnInsert: { amount: 50, updated_at: new Date() } },
      { upsert: true }
    );
    await FineRule.updateOne(
      { type: 'late' },
      { $setOnInsert: { amount: 20, updated_at: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    dbReady = false;
    console.error('❌ Database connection failed:', error.message);
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', ensureDb);

// ===== STUDENTS =====
app.post('/api/students', async (req, res) => {
  const { studentId, lastName, firstName, middleInitial, yearLevel, program, email } = req.body;

  try {
    await Student.create({
      student_id: studentId,
      last_name: lastName,
      first_name: firstName,
      middle_initial: middleInitial,
      year_level: yearLevel || 1,
      program: program || '',
      email: email || '',
    });
    res.json({ success: true, studentId });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ error: `Student ID ${studentId} already exists` });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const rows = await Student.find().sort({ last_name: 1, first_name: 1 }).lean();
    const mappedRows = rows
      .map((row) => {
        try {
          return mapStudent(row);
        } catch (mapError) {
          console.error('Failed to map student row:', mapError, row);
          return null;
        }
      })
      .filter(Boolean);

    res.json(mappedRows);
  } catch (error) {
    console.error('GET /api/students failed:', error);
    res.status(500).json({ error: formatErrorMessage(error, 'Failed to fetch students') });
  }
});

app.get('/api/students/:studentId', async (req, res) => {
  try {
    const student = await Student.findOne({ student_id: req.params.studentId }).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    try {
      res.json(mapStudent(student));
    } catch (mapError) {
      // Fallback response shape to avoid a hard failure on malformed records.
      console.error('Failed to map student record:', mapError, student);
      res.json({
        id: toId(student._id),
        student_id: student.student_id,
        last_name: student.last_name || '',
        first_name: student.first_name || '',
        middle_initial: student.middle_initial || '',
        year_level: student.year_level || 1,
        program: student.program || '',
        email: student.email || '',
        created_at: student.created_at || null,
        updated_at: student.updated_at || null,
      });
    }
  } catch (error) {
    console.error(`GET /api/students/${req.params.studentId} failed:`, error);
    res.status(500).json({ error: formatErrorMessage(error, 'Failed to fetch student') });
  }
});

app.put('/api/students/:id', async (req, res) => {
  const { lastName, firstName, middleInitial, yearLevel, program } = req.body;
  try {
    await Student.findByIdAndUpdate(req.params.id, {
      $set: {
        last_name: lastName,
        first_name: firstName,
        middle_initial: middleInitial,
        year_level: yearLevel,
        program,
      },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.json({ success: true });

    await Promise.all([
      Student.findByIdAndDelete(req.params.id),
      Attendance.deleteMany({ student_id: student.student_id }),
      Fine.deleteMany({ student_id: student.student_id }),
      Excuse.deleteMany({ student_id: student.student_id }),
      MembershipPayment.deleteMany({ student_id: student.student_id }),
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/students', async (req, res) => {
  try {
    const count = await Student.countDocuments();
    await Promise.all([
      Student.deleteMany({}),
      Attendance.deleteMany({}),
      Fine.deleteMany({}),
      Excuse.deleteMany({}),
      MembershipPayment.deleteMany({}),
    ]);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== EVENTS =====
app.post('/api/events', async (req, res) => {
  const { name, date, startTime, lateThreshold, endTime, fineAmount, description } = req.body;
  try {
    const created = await Event.create({
      name,
      date,
      start_time: startTime,
      late_threshold: lateThreshold,
      end_time: endTime,
      fine_amount: fineAmount ?? null,
      description,
    });

    res.json({ success: true, id: toId(created._id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const rows = await Event.find().sort({ date: -1, start_time: -1 }).lean();
    res.json(rows.map(mapEvent));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events/:id/mark-absent', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const absentRule = await FineRule.findOne({ type: 'absent' }).lean();
    const absentFineAmount = absentRule ? Number(absentRule.amount) : 0;

    const allStudents = await Student.find({}, { student_id: 1 }).lean();
    const existingAttendance = await Attendance.find({ event_id: req.params.id }, { student_id: 1 }).lean();
    const existingSet = new Set(existingAttendance.map(a => a.student_id));

    const studentsToMark = allStudents
      .map(s => s.student_id)
      .filter(studentId => !existingSet.has(studentId));

    let markedCount = 0;
    for (const studentId of studentsToMark) {
      await Attendance.create({
        student_id: studentId,
        event_id: req.params.id,
        date: event.date,
        session: 'AM_IN',
        type: 'manual',
        status: 'absent',
      });

      if (absentFineAmount > 0) {
        await Fine.create({
          student_id: studentId,
          event_id: req.params.id,
          amount: absentFineAmount,
          reason: `Absent - ${event.name}`,
          date: event.date,
        });
      }

      markedCount++;
    }

    res.json({ success: true, markedCount, eventName: event.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ATTENDANCE =====
app.post('/api/attendance', async (req, res) => {
  const { studentId, eventId, date, type, status, session } = req.body;
  const rawEventId = eventId && typeof eventId === 'object' ? eventId.id : eventId;
  const normalizedEventId = rawEventId === null || rawEventId === undefined || rawEventId === '' ? null : String(rawEventId);
  const attendanceSession = session || 'AM_IN';

  try {
    const existing = await Attendance.findOne({
      student_id: studentId,
      date,
      session: attendanceSession,
      event_id: normalizedEventId,
    }).lean();

    if (existing) {
      return res.status(409).json({ error: 'Attendance already recorded' });
    }

    await Attendance.create({
      student_id: studentId,
      event_id: normalizedEventId,
      date,
      session: attendanceSession,
      type,
      status,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const rows = await Attendance.find().sort({ timestamp: -1 }).limit(1000).lean();
    res.json(rows.map(mapAttendance));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attendance/:studentId', async (req, res) => {
  try {
    const rows = await Attendance.find({ student_id: req.params.studentId }).sort({ date: -1 }).lean();
    res.json(rows.map(mapAttendance));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/attendance/:id', async (req, res) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/attendance', async (req, res) => {
  try {
    await Attendance.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== FINES =====
app.post('/api/fines', async (req, res) => {
  const { studentId, eventId, amount, reason, date } = req.body;
  try {
    const created = await Fine.create({
      student_id: studentId,
      event_id: eventId ?? null,
      amount: Number(amount),
      reason,
      date,
    });

    res.json({ success: true, id: toId(created._id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fines/:studentId', async (req, res) => {
  try {
    const rows = await Fine.find({ student_id: req.params.studentId }).sort({ date: -1 }).lean();
    res.json(rows.map(mapFine));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fines', async (req, res) => {
  try {
    const rows = await Fine.find().sort({ date: -1 }).lean();
    res.json(rows.map(mapFine));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/fines/:id/pay', async (req, res) => {
  try {
    await Fine.findByIdAndUpdate(req.params.id, { $set: { paid: true, paid_at: new Date() } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fines', async (req, res) => {
  try {
    await Fine.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fines-summary', async (req, res) => {
  try {
    const students = await Student.find().lean();
    const fines = await Fine.find().lean();

    const byStudent = new Map();
    for (const fine of fines) {
      if (!byStudent.has(fine.student_id)) byStudent.set(fine.student_id, []);
      byStudent.get(fine.student_id).push(fine);
    }

    const rows = students
      .map((s) => {
        const studentFines = byStudent.get(s.student_id) || [];
        const total = studentFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
        const unpaid = studentFines
          .filter(f => !f.paid)
          .reduce((sum, f) => sum + Number(f.amount || 0), 0);

        return {
          student_id: s.student_id,
          id: toId(s._id),
          last_name: s.last_name,
          first_name: s.first_name,
          middle_initial: s.middle_initial,
          year_level: s.year_level,
          program: s.program,
          total_fines: total,
          unpaid_fines: unpaid,
          fine_count: studentFines.length,
        };
      })
      .filter(r => r.total_fines > 0)
      .sort((a, b) => b.total_fines - a.total_fines);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== EXCUSES =====
app.post('/api/excuses', async (req, res) => {
  const { studentId, type, startDate, endDate, startTime, endTime, description, fileName, fileData } = req.body;
  try {
    const created = await Excuse.create({
      student_id: studentId,
      type,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      description,
      file_name: fileName,
      file_data: fileData,
    });
    res.json({ success: true, id: toId(created._id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/excuses', async (req, res) => {
  try {
    const rows = await Excuse.find().sort({ uploaded_at: -1 }).lean();
    res.json(rows.map(mapExcuse));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/excuses/:id', async (req, res) => {
  try {
    await Excuse.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/excuses', async (req, res) => {
  try {
    await Excuse.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== MEMBERSHIP =====
app.post('/api/membership/initialize', async (req, res) => {
  const { academicYear, semester, amount } = req.body;

  try {
    const students = await Student.find({}, { student_id: 1 }).lean();

    for (const student of students) {
      await MembershipPayment.updateOne(
        { student_id: student.student_id },
        {
          $set: {
            student_id: student.student_id,
            amount: Number(amount),
            academic_year: academicYear,
            semester,
          },
          $setOnInsert: { created_at: new Date() },
        },
        { upsert: true }
      );
    }

    res.json({ success: true, count: students.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/membership', async (req, res) => {
  try {
    const [payments, students] = await Promise.all([
      MembershipPayment.find().lean(),
      Student.find().lean(),
    ]);

    const studentMap = new Map(students.map(s => [s.student_id, s]));
    const rows = payments
      .map(p => mapMembership(p, studentMap.get(p.student_id)))
      .sort((a, b) => {
        const left = `${a.last_name || ''}${a.first_name || ''}`;
        const right = `${b.last_name || ''}${b.first_name || ''}`;
        return left.localeCompare(right);
      });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/membership/:id/pay', async (req, res) => {
  const { paymentMethod, receiptNumber, nationalMembership, nationalReceiptNumber } = req.body;

  try {
    await MembershipPayment.findByIdAndUpdate(req.params.id, {
      $set: {
        paid: true,
        paid_at: new Date(),
        payment_method: paymentMethod,
        receipt_number: receiptNumber,
        national_membership: nationalMembership,
        national_receipt_number: nationalReceiptNumber,
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/membership', async (req, res) => {
  try {
    await MembershipPayment.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== FINE RULES =====
app.get('/api/fine-rules', async (req, res) => {
  try {
    const rows = await FineRule.find().sort({ type: 1 }).lean();
    res.json(rows.map(r => ({ id: toId(r._id), type: r.type, amount: r.amount, updated_at: r.updated_at })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/fine-rules/:type', async (req, res) => {
  const { amount } = req.body;

  try {
    await FineRule.updateOne(
      { type: req.params.type },
      { $set: { amount: Number(amount), updated_at: new Date() } },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initDatabase().then(() => {
  if (!dbReady) {
    console.error('❌ Mongo server startup aborted: database is not connected.');
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mongo server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  });
});

export default app;
