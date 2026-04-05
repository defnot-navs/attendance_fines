/**
 * QR Code Parser Utility
 * Extracts Student ID from various QR code formats
 */

/**
 * Parse QR code content to extract Student ID
 * Handles multiple formats:
 * 1. Pure Student ID: "2021-12345"
 * 2. Text containing Student ID: "Student: 2021-12345"
 * 3. JSON format: {"studentId": "2021-12345", ...}
 * 4. URL format: "https://example.com/student/2021-12345"
 */
export function parseQRCode(qrContent) {
  if (!qrContent) {
    throw new Error('QR code content is empty');
  }

  console.log('QR Code Content:', qrContent); // Debug log

  // Handle ampersand-delimited format (StudentID&Name&Department...)
  if (qrContent.includes('&')) {
    const parts = qrContent.split('&');
    const firstPart = parts[0].trim();
    // Check if first part looks like a student ID
    if (/^[A-Za-z0-9-_]{5,15}$/.test(firstPart)) {
      console.log('Extracted from ampersand format:', firstPart);
      return firstPart;
    }
  }

  // Try to parse as JSON first
  try {
    const json = JSON.parse(qrContent);
    if (json.studentId) return json.studentId;
    if (json.id) return json.id;
    if (json.student_id) return json.student_id;
  } catch (e) {
    // Not JSON, continue with other methods
  }

  // Common student ID patterns
  // Matches formats like: 2021-12345, 20211234, 2021_12345
  const patterns = [
    /\b(\d{4}[-_]?\d{4,6})\b/,  // Year-Number format
    /\b(\d{2}[-_]\d{5})\b/,  // Short year format (23-06020)
    /\b([A-Z]{2,4}-?\d{4,6})\b/i,  // Code-Number format
    /\b(\d{8,10})\b/,  // Pure numeric
    /student[:\s]+([A-Za-z0-9-_]+)/i,  // "Student: ID" format
    /id[:\s]+([A-Za-z0-9-_]+)/i  // "ID: ..." format
  ];

  for (const pattern of patterns) {
    const match = qrContent.match(pattern);
    if (match) {
      console.log('Matched pattern:', pattern, 'Result:', match[1]); // Debug log
      return match[1].trim();
    }
  }

  // If no pattern matches, check if the entire content looks like a valid ID
  const trimmed = qrContent.trim();
  if (/^[A-Za-z0-9-_]{5,15}$/.test(trimmed)) {
    console.log('Using entire content as ID:', trimmed); // Debug log
    return trimmed;
  }

  console.error('Failed to parse QR code. Content:', qrContent); // Debug log
  throw new Error(`Could not extract Student ID from QR code. Content: "${qrContent.substring(0, 100)}..."`);
}

/**
 * Validate if a string looks like a valid Student ID
 */
export function isValidStudentId(studentId) {
  if (!studentId || typeof studentId !== 'string') {
    return false;
  }
  
  // Student ID should be 5-15 characters, alphanumeric with hyphens/underscores
  return /^[A-Za-z0-9-_]{5,15}$/.test(studentId.trim());
}

/**
 * Extract Student ID from URL (if QR contains a URL)
 */
export function extractFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Check last path segment
    const lastSegment = pathParts[pathParts.length - 1];
    if (isValidStudentId(lastSegment)) {
      return lastSegment;
    }
    
    // Check query parameters
    const params = new URLSearchParams(urlObj.search);
    for (const key of ['id', 'studentId', 'student_id', 'student']) {
      const value = params.get(key);
      if (value && isValidStudentId(value)) {
        return value;
      }
    }
  } catch (e) {
    // Not a valid URL
  }
  
  return null;
}
