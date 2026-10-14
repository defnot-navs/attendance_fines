import React, { useMemo, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, Download, CheckCircle, AlertTriangle, UserPlus, Loader2 } from 'lucide-react';
import { getAllStudents, addStudent, saveMembershipPayment, markMembershipAsPaid } from '../db/hybridDatabase';
import { parseMembershipFile, downloadTemplate } from '../utils/membershipImport';
import { parseName } from '../utils/nameParser';
import { formatCurrency } from '../utils/finesCalculator';
import { notify } from '../utils/toast';

const CONCURRENCY = 4;

const key = (v) => String(v ?? '').toUpperCase().replace(/[^A-ZÑ]/g, '');

// Matches pasted lines (Student ID or "LASTNAME, FIRSTNAME MI") against registered students.
function matchPastedNames(text, studentMap) {
  const all = Array.from(studentMap.values());
  const rows = new Map();
  const unmatched = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    let student = studentMap.get(line);
    if (!student) {
      const p = parseName(line);
      if (p.isValid) {
        let hits = all.filter((s) => key(s.lastName) === key(p.lastName) && key(s.firstName) === key(p.firstName));
        if (hits.length > 1 && p.middleInitial) {
          const narrowed = hits.filter((s) => key(s.middleInitial)[0] === key(p.middleInitial)[0]);
          if (narrowed.length) hits = narrowed;
        }
        if (hits.length === 1) student = hits[0];
      }
    }
    if (student) rows.set(String(student.studentId), { studentId: String(student.studentId), lastName: student.lastName, firstName: student.firstName, middleInitial: student.middleInitial || '', yearLevel: null, program: '', email: '', paid: null, amount: null, paymentMethod: '', receiptNumber: '', nationalMembership: false, nationalReceiptNumber: '' });
    else unmatched.push(line);
  }
  return { rows: Array.from(rows.values()), skipped: 0, columns: [], unmatched };
}

async function runPool(items, worker, onProgress) {
  let next = 0;
  let done = 0;
  const results = new Array(items.length);
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await worker(items[i]) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
      done += 1;
      onProgress(done);
    }
  });
  await Promise.all(runners);
  return results;
}

export default function MembershipImportModal({ payments, academicYear, semester, membershipAmount, masterlist = false, onClose, onDone }) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { rows, skipped }
  const [students, setStudents] = useState(null);
  const [defaultPaid, setDefaultPaid] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const [mode, setMode] = useState('file'); // file | paste
  const [pasteText, setPasteText] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setParsed(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const [result, existing] = await Promise.all([parseMembershipFile(file), getAllStudents()]);
      if (result.rows.length === 0) throw new Error('No rows with a Student ID were found in this file.');
      setStudents(new Map(existing.map((s) => [String(s.studentId), s])));
      setParsed(result);
    } catch (err) {
      setError(err.message || 'Could not read the file.');
    } finally {
      setParsing(false);
    }
  };

  const handlePaste = async () => {
    setError(null);
    setParsed(null);
    try {
      const existing = await getAllStudents();
      const map = new Map(existing.map((s) => [String(s.studentId), s]));
      const result = matchPastedNames(pasteText, map);
      if (result.rows.length === 0) throw new Error('No pasted names matched a registered student.');
      setStudents(map);
      setParsed(result);
    } catch (err) {
      setError(err.message || 'Could not read the pasted names.');
    }
  };

  // Classify every row so the user can review before anything is written.
  const plan = useMemo(() => {
    if (!parsed || !students) return null;
    const paymentByStudent = new Map(payments.map((p) => [String(p.studentId), p]));

    const items = parsed.rows.map((row) => {
      const paid = masterlist ? false : row.paid === null ? defaultPaid : row.paid;
      const knownStudent = students.has(row.studentId);
      const canCreateStudent = !knownStudent && row.lastName && row.firstName;
      const existing = paymentByStudent.get(row.studentId);

      let action;
      if (!knownStudent && !canCreateStudent) action = 'notFound';
      else if (existing?.paid) action = 'alreadyPaid';
      else if (existing && !paid) action = 'noChange';
      else if (existing && paid) action = 'markPaid';
      else action = 'create';

      return { row, paid, action, newStudent: !!canCreateStudent };
    });

    const count = (a) => items.filter((i) => i.action === a).length;
    return {
      items,
      create: count('create'),
      markPaid: count('markPaid'),
      alreadyPaid: count('alreadyPaid'),
      noChange: count('noChange'),
      notFound: count('notFound'),
      newStudents: items.filter((i) => i.newStudent && i.action !== 'notFound').length,
      actionable: items.filter((i) => i.action === 'create' || i.action === 'markPaid').length,
    };
  }, [parsed, students, payments, defaultPaid, masterlist]);

  const handleImport = async () => {
    if (!plan || plan.actionable === 0) return;
    setImporting(true);
    setProgress(0);

    const todo = plan.items.filter((i) => i.action === 'create' || i.action === 'markPaid');
    const paymentByStudent = new Map(payments.map((p) => [String(p.studentId), p]));

    const results = await runPool(
      todo,
      async ({ row, paid, action, newStudent }) => {
        if (newStudent) {
          await addStudent({
            studentId: row.studentId,
            lastName: row.lastName,
            firstName: row.firstName,
            middleInitial: row.middleInitial || '',
            yearLevel: row.yearLevel || 1,
            program: row.program || '',
            email: row.email || '',
          });
        }
        if (action === 'markPaid') {
          const existing = paymentByStudent.get(row.studentId);
          await markMembershipAsPaid(
            existing.id,
            row.paymentMethod || 'Cash',
            row.receiptNumber || '',
            row.nationalMembership,
            row.nationalReceiptNumber || null
          );
        } else {
          const now = new Date().toISOString();
          await saveMembershipPayment({
            studentId: row.studentId,
            amount: row.amount ?? membershipAmount,
            paid,
            paidAt: paid ? now : null,
            paymentMethod: paid ? row.paymentMethod || 'Cash' : null,
            receiptNumber: row.receiptNumber || null,
            nationalMembership: row.nationalMembership,
            nationalReceiptNumber: row.nationalReceiptNumber || null,
            academicYear,
            semester,
            createdAt: now,
            synced: false,
          });
        }
      },
      setProgress
    );

    const failed = results.filter((r) => !r.ok);
    setImporting(false);
    const succeeded = results.length - failed.length;
    if (failed.length) {
      console.error('Membership import failures:', failed.map((f) => f.error));
      notify(
        `Imported ${succeeded} of ${results.length} records. ${failed.length} failed: ${failed[0].error?.message || 'unknown error'}`,
        'warning'
      );
    } else {
      notify(`Imported ${succeeded} membership record${succeeded === 1 ? '' : 's'} successfully.`, 'success');
    }
    await onDone();
    if (!failed.length) onClose();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const Stat = ({ label, value, tone }) => (
    <div className={`rounded-xl border p-3 text-center ${tone}`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-white z-10 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><FileSpreadsheet className="w-5 h-5" /></div>
            <div>
              <h3 id="import-title" className="font-bold text-slate-900">{masterlist ? 'Import Masterlist (Unpaid)' : 'Import Membership Payments'}</h3>
              <p className="text-xs text-slate-500">{academicYear} · {semester} · {formatCurrency(membershipAmount)} default fee</p>
            </div>
          </div>
          <button onClick={onClose} disabled={importing} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex gap-2 text-sm">
            {[['file', 'Upload CSV / Excel'], ['paste', 'Paste names']].map(([m, label]) => (
              <button key={m} type="button" onClick={() => { setMode(m); setParsed(null); setError(null); }}
                className={`px-3 py-1.5 rounded-lg font-medium ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                placeholder={'One per line, e.g. DELA CRUZ, JUAN A  or  2024-00456'}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={handlePaste} disabled={!pasteText.trim()}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium disabled:opacity-50">
                Match names
              </button>
              {parsed?.unmatched?.length > 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  {parsed.unmatched.length} line(s) not matched: {parsed.unmatched.slice(0, 10).join('; ')}{parsed.unmatched.length > 10 ? '…' : ''}
                </p>
              )}
            </div>
          )}

          {/* Drop zone */}
          {mode === 'file' && (<>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !importing && inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            {parsing ? (
              <Loader2 className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
            ) : (
              <Upload className="w-8 h-8 mx-auto text-blue-500" />
            )}
            <p className="mt-2 font-medium text-slate-800">
              {fileName ? fileName : 'Drop a CSV or Excel file here, or click to browse'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Required column: <strong>Student ID</strong>. Optional: Status, Payment Method, Receipt Number, National
              Membership, Amount, and name columns to register unknown students.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <Download className="w-4 h-4" /> Download CSV template
          </button>
          </>)}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {/* Preview */}
          {plan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="New payments" value={plan.create} tone="bg-blue-50 border-blue-200 text-blue-700" />
                <Stat label="Mark as paid" value={plan.markPaid} tone="bg-emerald-50 border-emerald-200 text-emerald-700" />
                <Stat label="Already paid" value={plan.alreadyPaid + plan.noChange} tone="bg-slate-50 border-slate-200 text-slate-600" />
                <Stat label="Not found" value={plan.notFound} tone="bg-red-50 border-red-200 text-red-700" />
              </div>

              {plan.newStudents > 0 && (
                <p className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  {plan.newStudents} student{plan.newStudents === 1 ? '' : 's'} not yet registered will be added from the name columns.
                </p>
              )}
              {plan.notFound > 0 && (
                <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {plan.notFound} Student ID{plan.notFound === 1 ? ' is' : 's are'} not registered and have no name columns, so
                  they will be skipped. Upload members first, or include Last Name and First Name columns.
                </p>
              )}
              {parsed.skipped > 0 && (
                <p className="text-xs text-slate-500">{parsed.skipped} row(s) without a Student ID were ignored.</p>
              )}

              {!masterlist && !parsed.columns.includes('status') && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={defaultPaid} onChange={(e) => setDefaultPaid(e.target.checked)} />
                  No Status column found: treat every listed student as <strong>Paid</strong>
                </label>
              )}

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-left">
                        <th className="px-3 py-2">Student ID</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.items.slice(0, 200).map(({ row, action, paid }) => {
                        const known = students.get(row.studentId);
                        const name = known
                          ? `${known.lastName}, ${known.firstName}`
                          : row.lastName ? `${row.lastName}, ${row.firstName}` : '—';
                        const label = {
                          create: paid ? 'Add as Paid' : 'Add as Unpaid',
                          markPaid: 'Mark as Paid',
                          alreadyPaid: 'Already paid',
                          noChange: 'No change',
                          notFound: 'Not found',
                        }[action];
                        const cls = {
                          create: 'text-blue-700',
                          markPaid: 'text-emerald-700',
                          alreadyPaid: 'text-slate-500',
                          noChange: 'text-slate-500',
                          notFound: 'text-red-600',
                        }[action];
                        return (
                          <tr key={row.studentId} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 whitespace-nowrap">{row.studentId}</td>
                            <td className="px-3 py-1.5">{name}</td>
                            <td className={`px-3 py-1.5 font-medium whitespace-nowrap ${cls}`}>{label}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {plan.items.length > 200 && (
                  <p className="text-xs text-slate-500 px-3 py-2 border-t border-slate-100">
                    Showing the first 200 of {plan.items.length} rows. All rows will be imported.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!plan || plan.actionable === 0 || importing}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Importing {progress}/{plan.actionable}…</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Import {plan ? plan.actionable : 0} record{plan?.actionable === 1 ? '' : 's'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
