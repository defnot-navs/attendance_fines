/**
 * Membership payment import: parses a CSV / Excel file into normalized rows.
 * Only a Student ID column is required; everything else is optional.
 */
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const ALIASES = {
  studentId: ['studentid', 'studentno', 'studentnumber', 'idnumber', 'idno', 'id'],
  lastName: ['lastname', 'surname', 'lname'],
  firstName: ['firstname', 'givenname', 'fname'],
  middleInitial: ['middleinitial', 'mi', 'middlename'],
  yearLevel: ['yearlevel', 'year'],
  program: ['program', 'course'],
  email: ['email', 'emailaddress'],
  status: ['status', 'paymentstatus', 'paid'],
  amount: ['amount', 'fee', 'membershipfee'],
  paymentMethod: ['paymentmethod', 'method', 'mode', 'modeofpayment'],
  receiptNumber: ['receiptnumber', 'receiptno', 'receipt', 'orno'],
  nationalMembership: ['nationalmembership', 'national'],
  nationalReceiptNumber: ['nationalreceiptnumber', 'nationalreceiptno', 'nationalreceipt'],
};

const normalizeHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const TRUE_WORDS = new Set(['paid', 'yes', 'y', 'true', '1', 'x', '✓', '✔', 'complete', 'completed']);
const FALSE_WORDS = new Set(['unpaid', 'no', 'n', 'false', '0', 'pending', 'notpaid', '']);

export const TEMPLATE_CSV =
  'Student ID,Last Name,First Name,Middle Initial,Year Level,Program,Email,Status,Payment Method,Receipt Number,National Membership,National Receipt Number\n' +
  '2024-00123,DELA CRUZ,JUAN,A,2,BSIS,juan@example.com,Paid,Cash,0001,No,\n' +
  '2024-00456,SANTOS,MARIA,B,3,BSIS,,Unpaid,,,No,\n';

function readSheetRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }));
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function readCsvRows(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject,
    });
  });
}

// Finds the header row (within the first 15 rows) that contains a Student ID column.
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).map(normalizeHeader);
    if (cells.some((c) => ALIASES.studentId.includes(c))) return i;
  }
  return -1;
}

function buildColumnMap(headerCells) {
  const map = {};
  const normalized = headerCells.map(normalizeHeader);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    // earlier aliases are more specific, so honor alias order
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

const clean = (v) => String(v ?? '').trim();

function parseBool(value) {
  const v = clean(value).toLowerCase();
  if (TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  return null; // unrecognized
}

function parseAmount(value) {
  const n = parseFloat(clean(value).replace(/[₱,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * @returns {Promise<{rows: object[], skipped: number, columns: string[]}>}
 */
export async function parseMembershipFile(file) {
  const name = file.name.toLowerCase();
  let raw;
  if (name.endsWith('.csv')) raw = await readCsvRows(file);
  else if (name.endsWith('.xlsx') || name.endsWith('.xls')) raw = await readSheetRows(file);
  else throw new Error('Unsupported file type. Please upload a CSV or Excel (.xlsx / .xls) file.');

  if (!raw || raw.length === 0) throw new Error('The file is empty.');

  const headerIndex = findHeaderRow(raw);
  if (headerIndex === -1) {
    throw new Error('Could not find a "Student ID" column. Check the header row or download the template.');
  }

  const columnMap = buildColumnMap(raw[headerIndex]);
  const get = (row, field) => (columnMap[field] === undefined ? '' : clean(row[columnMap[field]]));

  const byStudent = new Map();
  let skipped = 0;

  for (const row of raw.slice(headerIndex + 1)) {
    if (!row || row.every((c) => clean(c) === '')) continue;
    const studentId = get(row, 'studentId');
    if (!studentId) {
      skipped += 1;
      continue;
    }

    const hasStatusColumn = columnMap.status !== undefined;
    const statusValue = hasStatusColumn ? parseBool(get(row, 'status')) : null;

    byStudent.set(studentId, {
      studentId,
      lastName: get(row, 'lastName'),
      firstName: get(row, 'firstName'),
      middleInitial: get(row, 'middleInitial').slice(0, 1),
      yearLevel: parseInt(get(row, 'yearLevel'), 10) || null,
      program: get(row, 'program'),
      email: get(row, 'email'),
      paid: statusValue, // null = not specified, caller applies the default
      amount: parseAmount(get(row, 'amount')),
      paymentMethod: get(row, 'paymentMethod'),
      receiptNumber: get(row, 'receiptNumber'),
      nationalMembership: parseBool(get(row, 'nationalMembership')) === true,
      nationalReceiptNumber: get(row, 'nationalReceiptNumber'),
    });
  }

  return {
    rows: Array.from(byStudent.values()), // duplicates inside the file collapse to the last occurrence
    skipped,
    columns: Object.keys(columnMap),
  };
}

export function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'membership-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
