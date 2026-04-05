import React, { useRef, useState } from 'react';
import { Users, CheckCircle, XCircle, Calendar, GraduationCap, Upload } from 'lucide-react';
import { processOnlineMeetingAttendance, parseName, matchStudent } from '../utils/nameParser';
import { getAllStudents, recordAttendance, addEvent } from '../db/hybridDatabase';
import { autoGenerateFines } from '../utils/finesCalculator';
import { parseCSV, parseExcel } from '../utils/fileParser';

export default function OnlineMeetingParser() {
  const sessionOptions = [
    { value: 'AM_IN', label: 'AM IN' },
    { value: 'AM_OUT', label: 'AM OUT' },
    { value: 'PM_IN', label: 'PM IN' },
    { value: 'PM_OUT', label: 'PM OUT' },
  ];

  const [attendeeText, setAttendeeText] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [yearLevel, setYearLevel] = useState('all');
  const [selectedSessions, setSelectedSessions] = useState(['AM_IN']);
  const [fineAmount, setFineAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [importedSessionAttendees, setImportedSessionAttendees] = useState(null);
  const fileInputRef = useRef(null);

  const likelyNameHeaders = ['name', 'attendee', 'participant', 'full name'];
  const sessionHeaderMap = {
    AM_IN: ['AMIN', 'AMTIMEIN', 'MORNINGIN'],
    AM_OUT: ['AMOUT', 'AMTIMEOUT', 'MORNINGOUT'],
    PM_IN: ['PMIN', 'PMTIMEIN', 'AFTERNOONIN'],
    PM_OUT: ['PMOUT', 'PMTIMEOUT', 'AFTERNOONOUT'],
  };

  const normalizeHeader = (header) => String(header || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const detectSessionColumns = (rows) => {
    if (!rows || rows.length === 0) return {};

    const firstRow = rows[0] || {};
    const keys = Object.keys(firstRow);
    const detected = {};

    keys.forEach((key) => {
      const normalized = normalizeHeader(key);

      Object.entries(sessionHeaderMap).forEach(([session, aliases]) => {
        const matchedByAlias = aliases.includes(normalized);
        const matchedByPattern =
          (session === 'AM_IN' && normalized.includes('AM') && normalized.includes('IN') && !normalized.includes('OUT')) ||
          (session === 'AM_OUT' && normalized.includes('AM') && normalized.includes('OUT')) ||
          (session === 'PM_IN' && normalized.includes('PM') && normalized.includes('IN') && !normalized.includes('OUT')) ||
          (session === 'PM_OUT' && normalized.includes('PM') && normalized.includes('OUT'));

        if ((matchedByAlias || matchedByPattern) && !detected[session]) {
          detected[session] = key;
        }
      });
    });

    return detected;
  };

  const extractNameFromRow = (row) => {
    if (!row || typeof row !== 'object') return '';

    const entries = Object.entries(row).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
    if (entries.length === 0) return '';

    // Prefer common name-like headers first.
    for (const [key, value] of entries) {
      const normalizedKey = String(key).toLowerCase();
      if (likelyNameHeaders.some((header) => normalizedKey.includes(header))) {
        return String(value).trim();
      }
    }

    // Fall back to first non-empty value.
    return String(entries[0][1]).trim();
  };

  const handleImportFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();
      const parsedRows = lowerName.endsWith('.csv') ? await parseCSV(file) : await parseExcel(file);

      const detectedSessionColumns = detectSessionColumns(parsedRows);
      const detectedSessionKeys = Object.keys(detectedSessionColumns);

      if (detectedSessionKeys.length >= 2) {
        const sessionData = {
          AM_IN: [],
          AM_OUT: [],
          PM_IN: [],
          PM_OUT: [],
        };

        detectedSessionKeys.forEach((session) => {
          const column = detectedSessionColumns[session];
          const names = parsedRows
            .map((row) => (row && row[column] !== undefined ? String(row[column]).trim() : ''))
            .filter((name) => name && !likelyNameHeaders.includes(name.toLowerCase()));

          // Deduplicate while preserving order.
          const seen = new Set();
          sessionData[session] = names.filter((name) => {
            const key = name.toUpperCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });

        const autoSelectedSessions = sessionOptions
          .map((option) => option.value)
          .filter((session) => (sessionData[session] || []).length > 0);

        setImportedSessionAttendees(sessionData);
        setSelectedSessions(autoSelectedSessions.length > 0 ? autoSelectedSessions : ['AM_IN']);

        // Keep textarea populated for visibility/editing (use AM IN if available, else first non-empty session).
        const previewSession = autoSelectedSessions.includes('AM_IN')
          ? 'AM_IN'
          : autoSelectedSessions[0];
        setAttendeeText((sessionData[previewSession] || []).join('\n'));
        setResult(null);

        alert(
          `Imported session columns successfully. Detected sessions: ${autoSelectedSessions.join(', ') || 'none'}. ` +
          'Processing will now use each session column automatically.'
        );
        return;
      }

      const names = parsedRows
        .map(extractNameFromRow)
        .filter((name) => name && !likelyNameHeaders.includes(name.toLowerCase()));

      if (names.length === 0) {
        alert('No attendee names found in file. Please use a column with attendee names.');
        return;
      }

      setAttendeeText(names.join('\n'));
  setImportedSessionAttendees(null);
      setResult(null);
    } catch (error) {
      alert(`Failed to import file: ${error.message}`);
    } finally {
      // Allow selecting the same file again if needed.
      event.target.value = '';
    }
  };

  const toggleSession = (sessionValue) => {
    setSelectedSessions((prev) => {
      if (prev.includes(sessionValue)) {
        // Keep at least one session selected.
        if (prev.length === 1) return prev;
        return prev.filter((value) => value !== sessionValue);
      }

      return [...prev, sessionValue];
    });
  };

  const handleParse = async () => {
    const hasSessionImportData =
      importedSessionAttendees &&
      Object.values(importedSessionAttendees).some((sessionNames) => Array.isArray(sessionNames) && sessionNames.length > 0);

    if (!attendeeText.trim() && !hasSessionImportData) {
      alert('Please enter attendee list');
      return;
    }

    if (!eventTitle.trim()) {
      alert('Please enter event title');
      return;
    }

    if (selectedSessions.length === 0) {
      alert('Please select at least one attendance session');
      return;
    }

    if (fineAmount !== '') {
      const parsedFine = Number(fineAmount);
      if (!Number.isFinite(parsedFine) || parsedFine < 0) {
        alert('Please enter a valid fine amount (0 or higher)');
        return;
      }
    }

    setProcessing(true);
    setResult(null);

    try {
      // Get all students
      let students = await getAllStudents();

      if (students.length === 0) {
        alert('No students in database. Please upload member list first.');
        setProcessing(false);
        return;
      }

      // Filter by year level if not 'all'
      if (yearLevel !== 'all') {
        students = students.filter(s => s.yearLevel === parseInt(yearLevel));
        if (students.length === 0) {
          alert(`No students found for ${yearLevel}${yearLevel === '1' ? 'st' : yearLevel === '2' ? 'nd' : yearLevel === '3' ? 'rd' : 'th'} year.`);
          setProcessing(false);
          return;
        }
      }

      // Create event for this online meeting
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
      const eventFineAmount = fineAmount === '' ? null : Number(fineAmount);
      const targetLabel =
        yearLevel === 'all'
          ? 'All Members'
          : `${yearLevel}${yearLevel === '1' ? 'st' : yearLevel === '2' ? 'nd' : yearLevel === '3' ? 'rd' : 'th'} Year`;
      
      const eventId = await addEvent({
        name: eventTitle.trim(),
        date: today,
        startTime: timeStr,
        endTime: timeStr,
        lateThreshold: 0,
        fineAmount: eventFineAmount,
        description: `Online Meeting Attendance (Target: ${targetLabel})`
      });

      // Record attendance for present students
      let recorded = 0;
      let skipped = 0;
      const invalidEntries = [];
      const presentStudentMap = new Map();
      const absentStudentMap = new Map();

      if (hasSessionImportData) {
        for (const session of selectedSessions) {
          const sessionNames = importedSessionAttendees[session] || [];
          const presentIdsForSession = new Set();

          sessionNames.forEach((name, index) => {
            const parsedName = parseName(name);
            if (!parsedName.isValid) {
              invalidEntries.push({
                lineNumber: index + 1,
                raw: name,
                error: `${session}: ${parsedName.error}`,
              });
              return;
            }

            const matched = matchStudent(parsedName, students);
            if (!matched) {
              invalidEntries.push({
                lineNumber: index + 1,
                raw: name,
                error: `${session}: No matching student found`,
              });
              return;
            }

            presentIdsForSession.add(matched.studentId);
            presentStudentMap.set(matched.studentId, matched);
          });

          for (const student of students) {
            if (presentIdsForSession.has(student.studentId)) {
              try {
                await recordAttendance(student.studentId, 'online', 'present', eventId, session);
                recorded++;
              } catch (err) {
                skipped++;
                console.error('Failed to record:', err.message);
              }
            } else {
              absentStudentMap.set(student.studentId, student);
              try {
                await recordAttendance(student.studentId, 'online', 'absent', eventId, session);
                await autoGenerateFines(student.studentId, eventId, 'absent', {
                  date: today,
                  fineAmount: eventFineAmount,
                  session,
                });
              } catch (err) {
                console.error('Failed to record absence:', err.message);
              }
            }
          }
        }

        const absentRecorded = students.length * selectedSessions.length - recorded - skipped;

        setResult({
          present: Array.from(presentStudentMap.values()),
          absent: Array.from(absentStudentMap.values()),
          invalid: invalidEntries,
          recorded,
          skipped,
          absentRecorded,
          sessionCount: selectedSessions.length,
          selectedSessionLabels: sessionOptions
            .filter((option) => selectedSessions.includes(option.value))
            .map((option) => option.label),
          sourceMode: 'session-file',
        });
      } else {
        // Fallback: one attendee list used for all selected sessions.
        const parsed = processOnlineMeetingAttendance(attendeeText, students);

        for (const student of parsed.present) {
          for (const session of selectedSessions) {
            try {
              await recordAttendance(student.studentId, 'online', 'present', eventId, session);
              recorded++;
            } catch (err) {
              skipped++;
              console.error('Failed to record:', err.message);
            }
          }
        }

        const presentIds = new Set(parsed.present.map(s => s.studentId));
        const absentStudents = students.filter(s => !presentIds.has(s.studentId));

        let absentRecorded = 0;
        for (const student of absentStudents) {
          for (const session of selectedSessions) {
            try {
              await recordAttendance(student.studentId, 'online', 'absent', eventId, session);
              await autoGenerateFines(student.studentId, eventId, 'absent', {
                date: today,
                fineAmount: eventFineAmount,
                session,
              });
              absentRecorded++;
            } catch (err) {
              console.error('Failed to record absence:', err.message);
            }
          }
        }

        setResult({
          present: parsed.present,
          absent: absentStudents,
          invalid: parsed.invalid,
          recorded,
          skipped,
          absentRecorded,
          sessionCount: selectedSessions.length,
          selectedSessionLabels: sessionOptions
            .filter((option) => selectedSessions.includes(option.value))
            .map((option) => option.label),
          sourceMode: 'single-list',
        });
      }
    } catch (error) {
      alert('Error processing attendance: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = () => {
    setAttendeeText('');
    setEventTitle('');
    setYearLevel('all');
    setSelectedSessions(['AM_IN']);
    setFineAmount('');
    setImportedSessionAttendees(null);
    setResult(null);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Users className="w-6 h-6" />
        Online Meeting Attendance
      </h2>

      {/* Event Title Input */}
      <div className="mb-4">
        <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Event Title / Meeting Name
        </label>
        <input
          type="text"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
          placeholder="e.g., Weekly Online Meeting, General Assembly, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={processing}
        />
        <p className="mt-1 text-xs text-gray-500">
          This will appear in the fines breakdown
        </p>
      </div>

      {/* Attendance Sessions */}
      <div className="mb-4">
        <label className="block mb-2 font-medium text-gray-700">
          Attendance Sessions for This Event
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {sessionOptions.map((session) => (
            <label
              key={session.value}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer select-none ${
                selectedSessions.includes(session.value)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSessions.includes(session.value)}
                onChange={() => toggleSession(session.value)}
                disabled={processing || (selectedSessions.length === 1 && selectedSessions.includes(session.value))}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium">{session.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Fines are applied per missed session. Example: selecting 4 sessions applies up to 4x absent fine per absent student.
        </p>
      </div>

      {/* Year Level Filter */}
      <div className="mb-4">
        <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2">
          <GraduationCap className="w-4 h-4" />
          Target Year Level
        </label>
        <select
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={processing}
        >
          <option value="all">All Members</option>
          <option value="1">1st Year Only</option>
          <option value="2">2nd Year Only</option>
          <option value="3">3rd Year Only</option>
          <option value="4">4th Year Only</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Only students from selected year level will be marked for attendance
        </p>
      </div>

      {/* Fine Amount Input */}
      <div className="mb-4">
        <label className="block mb-2 font-medium text-gray-700">
          Absent Fine Amount (Optional)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={fineAmount}
          onChange={(e) => setFineAmount(e.target.value)}
          placeholder="Leave blank to use default absent fine from Settings"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={processing}
        />
        <p className="mt-1 text-xs text-gray-500">
          If set, this amount is used for absent fines in this online meeting.
        </p>
      </div>

      {/* Input Area */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 gap-3">
          <label className="block font-medium text-gray-700">
            Paste Attendee List (One per line)
          </label>
          <button
            type="button"
            onClick={handleImportFileClick}
            disabled={processing}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            Import Excel/CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
        <textarea
          value={attendeeText}
          onChange={(e) => setAttendeeText(e.target.value)}
          placeholder="DELA CRUZ, JUAN A&#10;SANTOS, MARIA BEATRIZ&#10;REYES, PEDRO MAGADIA&#10;ANDINO, JANREY"
          rows={10}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          disabled={processing}
        />
        <p className="mt-2 text-sm text-gray-500">
          Format: LASTNAME, FIRSTNAME [MIDDLE] (comma preferred but optional)
          <br/>
          <span className="text-xs text-gray-400">Tags like (Unverified) are automatically removed. Names without commas will be parsed intelligently.</span>
        </p>
        <p className="mt-1 text-xs text-blue-600">
          You can import `.xlsx`, `.xls`, or `.csv` attendee files. The system will use name/attendee columns automatically.
        </p>
        {importedSessionAttendees && (
          <p className="mt-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 inline-block">
            Session-based import detected. Processing will use AM/PM IN/OUT columns automatically.
          </p>
        )}
        <p className="mt-1 text-xs text-amber-600">
          ⚠️ Last and First names must match EXACTLY with database.
          Middle name/initial is <strong>OPTIONAL</strong> - will match with or without it.
          Names that don't match will be marked as <strong>ABSENT</strong> with fines.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleParse}
          disabled={processing || !attendeeText.trim() || !eventTitle.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Processing...' : 'Process Attendance'}
        </button>
        <button
          onClick={handleClear}
          disabled={processing}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Summary</h3>
            <ul className="space-y-1 text-sm text-blue-700">
              <li>Target: {yearLevel === 'all' ? 'All Members' : `${yearLevel}${yearLevel === '1' ? 'st' : yearLevel === '2' ? 'nd' : yearLevel === '3' ? 'rd' : 'th'} Year Only`}</li>
              <li>Source: {result.sourceMode === 'session-file' ? 'Imported session columns (AM/PM)' : 'Single attendee list'}</li>
              <li>Sessions: {result.selectedSessionLabels?.join(', ')} ({result.sessionCount} total)</li>
              <li>Present: {result.present.length} ({result.recorded} records saved, {result.skipped} skipped)</li>
              <li>Absent: {result.absent.length} ({result.absentRecorded} absence records + fines saved)</li>
              <li>Invalid format: {result.invalid.length}</li>
            </ul>
          </div>

          {/* Present Students */}
          {result.present.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900">
                    Present ({result.present.length})
                  </h3>
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    {result.present.map((student, idx) => (
                      <p key={idx} className="text-sm text-green-700">
                        {student.lastName}, {student.firstName} {student.middleInitial} ({student.studentId})
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Absent Students */}
          {result.absent.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900">
                    Absent ({result.absent.length})
                  </h3>
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    {result.absent.map((student, idx) => (
                      <p key={idx} className="text-sm text-yellow-700">
                        {student.lastName}, {student.firstName} {student.middleInitial} ({student.studentId})
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invalid Names */}
          {result.invalid.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">
                    Invalid Format ({result.invalid.length})
                  </h3>
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    {result.invalid.map((item, idx) => (
                      <p key={idx} className="text-sm text-red-700">
                        Line {item.lineNumber}: {item.raw} - {item.error}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Format Help */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">✅ Flexible Input - Valid Format Examples:</h3>
        <pre className="text-xs text-gray-700 bg-white p-3 rounded border mb-3">
{`DELA CRUZ, JUAN A
SANTOS, MARIA BEATRIZ
REYES JR., PEDRO MAGADIA
O'BRIEN, PATRICK E
HERNANDEZ, LOVELYN M (Unverified)
MANONGSONG JAMELYN
Louise Illut (Unverified)
PAGAO SHENA
Ceejay Cueto`}
        </pre>
        <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 mb-2">
          <strong>⚠️ Matching Rules:</strong><br/>
          • Last Name + First Name: <strong>STRICT</strong> (must match exactly)<br/>
          • Middle Name/Initial: <strong>OPTIONAL</strong> (can be missing, initial, or full name)<br/>
          • Comma: <strong>OPTIONAL</strong> (preferred but system will parse without it)<br/>
          • Examples that WILL match:<br/>
          &nbsp;&nbsp;- Database: "DELA CRUZ, JUAN A" ↔ Input: "DELA CRUZ, JUAN" or "DELA CRUZ JUAN"<br/>
          &nbsp;&nbsp;- Database: "SANTOS, MARIA" ↔ Input: "SANTOS, MARIA BEATRIZ" or "SANTOS MARIA"<br/>
          • Names that don't match will be marked as <strong>ABSENT with fines</strong>.
        </p>
        <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
          <strong>ℹ️ Auto-Cleanup:</strong> Text in parentheses like (Unverified) is automatically removed before parsing.
        </p>
      </div>
    </div>
  );
}
