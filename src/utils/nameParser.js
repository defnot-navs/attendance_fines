/**
 * Online Meeting Name Parser Utility
 * Parses attendee names from online meeting text
 * Valid format: LASTNAME, FIRSTNAME MIDINIT
 */

/**
 * Parse a single name line
 * Expected format: LASTNAME, FIRSTNAME MIDINIT
 * Returns: { lastName, firstName, middleInitial, isValid }
 */
export function parseName(nameLine) {
  if (!nameLine || typeof nameLine !== 'string') {
    return { isValid: false, error: 'Empty name' };
  }

  // FLEXIBLE: Remove (Unverified) or any text in parentheses
  let cleanedLine = nameLine.replace(/\s*\([^)]*\)/g, '');
  
  // Trim and normalize whitespace - FLEXIBLE: allow multiple spaces, tabs, etc.
  const normalized = cleanedLine.trim().replace(/\s+/g, ' ');

  let lastName, firstNamePart;

  // Check for comma (preferred separator)
  if (normalized.includes(',')) {
    // Split by comma - FLEXIBLE: handle multiple commas by taking first and rest
    const firstCommaIndex = normalized.indexOf(',');
    lastName = normalized.substring(0, firstCommaIndex).trim();
    firstNamePart = normalized.substring(firstCommaIndex + 1).trim();
  } else {
    // NO COMMA: Try to parse intelligently (FIRSTNAME LASTNAME or LASTNAME FIRSTNAME format)
    // Assume format: LASTNAME FIRSTNAME MIDDLE or FIRSTNAME MIDDLE LASTNAME
    // Since we can't tell which is which without comma, we'll try:
    // - If all caps at start: likely LASTNAME FIRSTNAME
    // - Otherwise: likely FIRSTNAME LASTNAME
    const parts = normalized.split(/\s+/);
    
    if (parts.length < 2) {
      return { 
        isValid: false, 
        error: 'Invalid format - not enough name parts',
        raw: nameLine
      };
    }

    // Check if first word is all uppercase (likely LASTNAME)
    const firstIsUpper = parts[0] === parts[0].toUpperCase() && /^[A-Z]/.test(parts[0]);
    const secondIsUpper = parts.length > 1 && parts[1] === parts[1].toUpperCase() && /^[A-Z]/.test(parts[1]);
    
    if (firstIsUpper && parts.length >= 2) {
      // Likely "LASTNAME FIRSTNAME [MIDDLE]" format
      lastName = parts[0];
      firstNamePart = parts.slice(1).join(' ');
    } else {
      // Likely "Firstname Lastname" or "Firstname Middle Lastname" format
      // Take last part as last name, rest as first name
      lastName = parts[parts.length - 1];
      firstNamePart = parts.slice(0, -1).join(' ');
    }
  }

  // Validate last name - FLEXIBLE: accept letters, spaces, hyphens, periods, apostrophes, commas (JR., SR., III, etc.)
  if (!lastName || !/^[A-Za-zÑñ\s.\-',]+$/.test(lastName)) {
    return { 
      isValid: false, 
      error: 'Invalid last name',
      raw: nameLine
    };
  }

  // Split first name part - FLEXIBLE: handle various formats
  const nameParts = firstNamePart.trim().split(/\s+/).filter(p => p.length > 0);
  
  // FLEXIBLE: Accept names with or without middle initial/name
  let firstName, middleInitial;
  
  if (nameParts.length < 1) {
    return { 
      isValid: false, 
      error: 'Missing first name',
      raw: nameLine
    };
  } else if (nameParts.length === 1) {
    // Only first name, no middle initial (e.g., "ANDINO, JANREY")
    firstName = nameParts[0];
    middleInitial = ''; // Empty middle initial
  } else {
    // Has both first name and middle name/initial
    // Last part is middle initial/name, rest is first name
    firstName = nameParts.slice(0, -1).join(' ');
    middleInitial = nameParts[nameParts.length - 1];
  }

  // Validate first name - FLEXIBLE: accept letters, spaces, hyphens, periods, apostrophes
  if (!firstName || !/^[A-Za-zÑñ\s.\-']+$/.test(firstName)) {
    return { 
      isValid: false, 
      error: 'Invalid first name',
      raw: nameLine
    };
  }

  // Validate middle initial - FLEXIBLE: accept any length (can be full middle name or initial)
  // Allow empty middle initial as well
  if (middleInitial) {
    const miNormalized = middleInitial.replace(/\./g, '');
    if (miNormalized && !/^[A-Za-zÑñ\s.\-']+$/.test(miNormalized)) {
      return { 
        isValid: false, 
        error: 'Invalid middle name/initial',
        raw: nameLine
      };
    }
    middleInitial = miNormalized.toUpperCase();
  }

  return {
    isValid: true,
    lastName: lastName.toUpperCase(),
    firstName: firstName.toUpperCase(),
    middleInitial: middleInitial || '', // Empty string if no middle initial
    raw: nameLine
  };
}

/**
 * Parse multiple names from text (one per line)
 * Returns array of parsed results
 */
export function parseAttendeeList(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split by newlines and filter empty lines
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return lines.map((line, index) => ({
    lineNumber: index + 1,
    ...parseName(line)
  }));
}

/**
 * Normalize name for strict comparison
 * Remove extra spaces, periods, apostrophes, but keep structure
 */
function normalizeForComparison(str) {
  if (!str) return '';
  // Remove periods, apostrophes, commas, hyphens, extra spaces
  // Convert to uppercase for case-insensitive comparison
  return str
    .toUpperCase()
    .replace(/[.,'\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match parsed name against student database
 * STRICT COMPARISON on last and first names
 * OPTIONAL middle initial - matches if both have same MI, OR if either is missing/empty
 */
export function matchStudent(parsedName, students) {
  if (!parsedName.isValid) {
    return null;
  }

  // Normalize parsed name components
  const normalizedParsedLastName = normalizeForComparison(parsedName.lastName);
  const normalizedParsedFirstName = normalizeForComparison(parsedName.firstName);
  const normalizedParsedMI = normalizeForComparison(parsedName.middleInitial);

  // Find STRICT match on last + first name, OPTIONAL middle initial
  const match = students.find(student => {
    const normalizedStudentLastName = normalizeForComparison(student.lastName);
    const normalizedStudentFirstName = normalizeForComparison(student.firstName);
    const normalizedStudentMI = normalizeForComparison(student.middleInitial);

    // Last name and first name MUST match exactly
    const lastNameMatch = normalizedStudentLastName === normalizedParsedLastName;
    const firstNameMatch = normalizedStudentFirstName === normalizedParsedFirstName;

    // Middle initial is OPTIONAL:
    // - If both have middle initial, they must match
    // - If either is missing/empty, consider it a match
    const middleInitialMatch = 
      !normalizedParsedMI || // Input has no middle initial
      !normalizedStudentMI || // Database has no middle initial
      normalizedStudentMI === normalizedParsedMI || // Both have same middle initial
      normalizedStudentMI.startsWith(normalizedParsedMI) || // DB has full name, input has initial
      normalizedParsedMI.startsWith(normalizedStudentMI); // Input has full name, DB has initial

    return lastNameMatch && firstNameMatch && middleInitialMatch;
  });

  return match || null;
}

/**
 * Process online meeting attendance
 * Returns: { present: [], absent: [], invalid: [] }
 */
export function processOnlineMeetingAttendance(text, students) {
  const parsed = parseAttendeeList(text);
  
  const result = {
    present: [],
    absent: [],
    invalid: []
  };

  for (const parsedName of parsed) {
    if (!parsedName.isValid) {
      result.invalid.push(parsedName);
      continue;
    }

    const student = matchStudent(parsedName, students);
    
    if (student) {
      result.present.push({
        ...student,
        parsedName: parsedName.raw
      });
    } else {
      result.absent.push(parsedName);
    }
  }

  return result;
}

/**
 * Validate name format without matching against database
 */
export function validateNameFormat(nameLine) {
  const parsed = parseName(nameLine);
  return parsed.isValid;
}
