/**
 * CSV/Excel Parser Utility
 * Handles student list uploads
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Parse CSV file
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // First, get raw data without headers to find the header row
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Find the row that contains the actual headers
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
          const row = rawData[i];
          const rowString = row.join('|').toLowerCase();
          
          // Check if this row contains typical column headers
          if (rowString.includes('student') && rowString.includes('id') ||
              rowString.includes('name') && rowString.includes('program')) {
            headerRowIndex = i;
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          // No header row found, use first row
          headerRowIndex = 0;
        }
        
        // Parse again starting from header row
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        range.s.r = headerRowIndex; // Start from header row
        const newRange = XLSX.utils.encode_range(range);
        
        // Create a new worksheet reference
        const newWorksheet = {};
        Object.keys(worksheet).forEach(key => {
          if (key.startsWith('!')) {
            newWorksheet[key] = worksheet[key];
          } else {
            const cell = XLSX.utils.decode_cell(key);
            if (cell.r >= headerRowIndex) {
              const newCell = XLSX.utils.encode_cell({ r: cell.r - headerRowIndex, c: cell.c });
              newWorksheet[newCell] = worksheet[key];
            }
          }
        });
        newWorksheet['!ref'] = XLSX.utils.encode_range({
          s: { r: 0, c: range.s.c },
          e: { r: range.e.r - headerRowIndex, c: range.e.c }
        });
        
        const jsonData = XLSX.utils.sheet_to_json(newWorksheet, { defval: '' });
        
        // Filter out empty rows
        const filteredData = jsonData.filter(row => {
          const values = Object.values(row);
          return values.some(v => v && String(v).trim() !== '');
        });
        
        resolve(filteredData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validate student data
 * Required fields: Student ID, LASTNAME, FIRSTNAME, MIDDLE INITIAL, YEAR LEVEL, PROGRAM
 */
export function validateStudentData(data) {
  const errors = [];
  const validated = [];

  // Check if data is empty
  if (!data || data.length === 0) {
    errors.push({
      line: 0,
      error: 'File is empty or could not be parsed',
      data: {}
    });
    return { validated, errors };
  }

  // Get column names from first row
  const firstRow = data[0];
  const availableColumns = Object.keys(firstRow);
  
  // If no columns found, add helpful error
  if (availableColumns.length === 0) {
    errors.push({
      line: 0,
      error: 'No columns found in file. Available columns: ' + availableColumns.join(', '),
      data: firstRow
    });
    return { validated, errors };
  }

  // Possible field name variations (case-insensitive matching added)
  const fieldMappings = {
    studentId: [
      'Student ID', 'StudentID', 'ID', 'student_id', 'STUDENT ID', 'Student Id', 
      'student id', 'STUDENTID', 'Id', 'id', 'ID NUMBER', 'ID No', 'ID No.'
    ],
    lastName: [
      'LASTNAME', 'Last Name', 'LastName', 'Surname', 'last_name', 'LAST NAME', 
      'lastname', 'Last name', 'SURNAME'
    ],
    firstName: [
      'FIRSTNAME', 'First Name', 'FirstName', 'Given Name', 'first_name', 'FIRST NAME', 
      'firstname', 'First name', 'GIVENNAME'
    ],
    middleInitial: [
      'MIDDLE INITIAL', 'Middle Initial', 'MiddleInitial', 'MI', 'M.I.', 'middle_initial', 
      'MIDINIT', 'Middle initial', 'mi', 'm.i.'
    ],
    yearLevel: [
      'YEAR LEVEL', 'Year Level', 'YearLevel', 'Year', 'YEAR', 'year_level', 'Level', 
      'year level', 'Yr', 'YR', 'Yr. Level', 'Year Lvl', 'YR LEVEL'
    ],
    program: [
      'PROGRAM', 'Program', 'Course', 'COURSE', 'program', 'Degree', 'course', 'DEGREE'
    ],
    fullName: [
      'Name', 'NAME', 'Full Name', 'FullName', 'FULLNAME', 'full name', 'Student Name', 
      'STUDENT NAME', 'Student name'
    ]
  };

  data.forEach((row, index) => {
    const lineNumber = index + 1;
    const student = {};
    
    // First, check if we have a fullName field
    let hasFullName = false;
    for (const variation of fieldMappings.fullName) {
      if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
        student.fullName = String(row[variation]).trim();
        hasFullName = true;
        break;
      }
    }

    // Try to find and map all other fields
    for (const [key, variations] of Object.entries(fieldMappings)) {
      if (key === 'fullName') continue; // Already processed
      
      let found = false;
      
      for (const variation of variations) {
        if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
          student[key] = String(row[variation]).trim();
          found = true;
          break;
        }
      }

      // If we have fullName, we can skip lastName, firstName, middleInitial requirements
      const isNameField = key === 'lastName' || key === 'firstName' || key === 'middleInitial';
      const canSkip = hasFullName && isNameField;
      
      if (!found && !canSkip) {
        // Add more helpful error message with available columns
        errors.push({
          line: lineNumber,
          error: `Missing required field: ${key}. Available columns in your file: ${availableColumns.join(', ')}`,
          data: row
        });
        return; // Skip this row
      }
    }

    // If we have fullName but not individual name fields, split it
    if (hasFullName && student.fullName && (!student.lastName || !student.firstName)) {
      const nameParts = student.fullName.split(',').map(p => p.trim());
      
      if (nameParts.length >= 2) {
        // Format: "LASTNAME, FIRSTNAME MIDDLENAME"
        student.lastName = nameParts[0];
        const firstAndMiddle = nameParts[1].split(' ');
        student.firstName = firstAndMiddle[0];
        student.middleInitial = firstAndMiddle.length > 1 ? firstAndMiddle[firstAndMiddle.length - 1].charAt(0) : 'X';
      } else {
        // Format: "FIRSTNAME MIDDLENAME LASTNAME" or "FIRSTNAME LASTNAME"
        const parts = student.fullName.split(' ').filter(p => p);
        if (parts.length >= 2) {
          student.firstName = parts[0];
          student.lastName = parts[parts.length - 1];
          student.middleInitial = parts.length > 2 ? parts[1].charAt(0) : 'X';
        } else {
          errors.push({
            line: lineNumber,
            error: `Cannot parse name: ${student.fullName}`,
            data: row
          });
          return;
        }
      }
    }

    // Validate Student ID format
    if (!/^[A-Za-z0-9-_]{5,15}$/.test(student.studentId)) {
      errors.push({
        line: lineNumber,
        error: `Invalid Student ID format: ${student.studentId}`,
        data: row
      });
      return;
    }

    // Validate name fields (letters, spaces, hyphens, periods, common suffixes)
    if (!/^[A-Za-zÑñ\s.\-',]+$/.test(student.lastName)) {
      errors.push({
        line: lineNumber,
        error: `Invalid last name format: ${student.lastName}`,
        data: row
      });
      return;
    }

    if (!/^[A-Za-zÑñ\s.\-',]+$/.test(student.firstName)) {
      errors.push({
        line: lineNumber,
        error: `Invalid first name format: ${student.firstName}`,
        data: row
      });
      return;
    }

    // Validate middle initial (1-2 letters, optional period)
    const mi = student.middleInitial.replace(/\./g, '').trim();
    if (mi && !/^[A-Za-zÑñ]{1,2}$/.test(mi)) {
      errors.push({
        line: lineNumber,
        error: `Invalid middle initial format: ${student.middleInitial}`,
        data: row
      });
      return;
    }

    // Validate year level (1-4)
    const yearLevel = parseInt(student.yearLevel);
    if (isNaN(yearLevel) || yearLevel < 1 || yearLevel > 4) {
      errors.push({
        line: lineNumber,
        error: `Invalid year level: ${student.yearLevel}. Must be 1, 2, 3, or 4`,
        data: row
      });
      return;
    }

    // Validate program (at least 2 characters)
    if (!student.program || student.program.trim().length < 2) {
      errors.push({
        line: lineNumber,
        error: `Invalid or missing program: ${student.program}`,
        data: row
      });
      return;
    }

    // Normalize data
    student.lastName = student.lastName.toUpperCase();
    student.firstName = student.firstName.toUpperCase();
    student.middleInitial = mi.toUpperCase();
    student.yearLevel = yearLevel;
    student.program = student.program.trim().toUpperCase();

    validated.push(student);
  });

  return { validated, errors };
}

/**
 * Check for duplicate Student IDs
 */
export function checkDuplicates(students) {
  const seen = new Set();
  const duplicates = [];

  students.forEach((student, index) => {
    if (seen.has(student.studentId)) {
      duplicates.push({
        studentId: student.studentId,
        line: index + 1
      });
    } else {
      seen.add(student.studentId);
    }
  });

  return duplicates;
}

/**
 * Main function to process uploaded file
 */
export async function processStudentFile(file) {
  let data;

  // Determine file type and parse accordingly
  const fileType = file.name.toLowerCase();
  
  if (fileType.endsWith('.csv')) {
    data = await parseCSV(file);
  } else if (fileType.endsWith('.xlsx') || fileType.endsWith('.xls')) {
    data = await parseExcel(file);
  } else {
    throw new Error('Unsupported file type. Please upload CSV or Excel file.');
  }

  if (!data || data.length === 0) {
    throw new Error('File is empty or could not be parsed');
  }

  // Validate data
  const { validated, errors } = validateStudentData(data);

  // Check for duplicates
  const duplicates = checkDuplicates(validated);

  return {
    students: validated,
    errors,
    duplicates,
    totalRows: data.length,
    validRows: validated.length
  };
}
