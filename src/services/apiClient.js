// Centralized API client for backend communication
// Default to same-origin /api so it works with the Vite dev proxy (and avoids HTTPS→HTTP mixed-content issues).
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class APIClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    console.log('🔌 API Client initialized with base URL:', this.baseURL);
  }

  async request(endpoint, options = {}) {
    const { timeoutMs = 10000, ...requestOptions } = options;
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...requestOptions.headers,
      },
      mode: 'cors', // Enable CORS
      credentials: 'omit', // Don't send credentials for cross-origin
      signal: controller.signal,
      ...requestOptions,
    };

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get('content-type') || '';

      let rawText = '';
      let data;

      // Some endpoints may return empty bodies (or non-JSON errors).
      if (response.status !== 204) {
        rawText = await response.text();
        if (rawText) {
          if (contentType.includes('application/json')) {
            data = JSON.parse(rawText);
          } else {
            try {
              data = JSON.parse(rawText);
            } catch {
              data = undefined;
            }
          }
        }
      }

      if (!response.ok) {
        const message =
          (data && (data.error || data.message)) ||
          rawText ||
          `API request failed (${response.status})`;
        throw new Error(message);
      }

      return data ?? {};
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout (${timeoutMs}ms)`);
      }
      console.error(`API Error [${endpoint}]:`, error);
      console.error('Full URL:', url);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ===== STUDENTS =====
  
  async addStudent(student) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(student),
    });
  }

  async getAllStudents() {
    return this.request('/students');
  }

  async getStudentByStudentId(studentId) {
    return this.request(`/students/${studentId}`);
  }

  async updateStudent(id, student) {
    return this.request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(student),
    });
  }

  async deleteStudent(id) {
    return this.request(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteAllStudents() {
    return this.request('/students', {
      method: 'DELETE',
    });
  }

  // ===== EVENTS =====

  async addEvent(event) {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async getAllEvents() {
    return this.request('/events');
  }

  async deleteEvent(id) {
    return this.request(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  async markRemainingStudentsAbsent(eventId) {
    return this.request(`/events/${eventId}/mark-absent`, {
      method: 'POST',
    });
  }

  // ===== ATTENDANCE =====

  async recordAttendance(attendance) {
    return this.request('/attendance', {
      method: 'POST',
      body: JSON.stringify(attendance),
    });
  }

  async getAllAttendance() {
    return this.request('/attendance');
  }

  async getStudentAttendance(studentId) {
    return this.request(`/attendance/${studentId}`);
  }

  async deleteAttendance(id) {
    return this.request(`/attendance/${id}`, {
      method: 'DELETE',
    });
  }

  async clearAllAttendance() {
    return this.request('/attendance', {
      method: 'DELETE',
    });
  }

  // ===== FINES =====

  async recordFine(fine) {
    return this.request('/fines', {
      method: 'POST',
      body: JSON.stringify(fine),
    });
  }

  async getStudentFines(studentId) {
    return this.request(`/fines/${studentId}`);
  }

  async getAllFines() {
    return this.request('/fines');
  }

  async getFinesSummary() {
    return this.request('/fines-summary');
  }

  async markFineAsPaid(id) {
    return this.request(`/fines/${id}/pay`, {
      method: 'PUT',
    });
  }

  async clearAllFines() {
    return this.request('/fines', {
      method: 'DELETE',
    });
  }

  // ===== EXCUSES =====

  async addExcuse(excuse) {
    return this.request('/excuses', {
      method: 'POST',
      body: JSON.stringify(excuse),
    });
  }

  async getAllExcuses() {
    return this.request('/excuses');
  }

  async deleteExcuse(id) {
    return this.request(`/excuses/${id}`, {
      method: 'DELETE',
    });
  }

  async clearAllExcuses() {
    return this.request('/excuses', {
      method: 'DELETE',
    });
  }

  // ===== MEMBERSHIP PAYMENTS =====

  async initializeMembershipPayments(data) {
    return this.request('/membership/initialize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAllMembershipPayments() {
    return this.request('/membership');
  }

  async markMembershipAsPaid(id, data) {
    return this.request(`/membership/${id}/pay`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async clearAllMembershipPayments() {
    return this.request('/membership', {
      method: 'DELETE',
    });
  }

  // ===== FINE RULES =====

  async getFineRules() {
    return this.request('/fine-rules');
  }

  async updateFineRule(type, amount) {
    return this.request(`/fine-rules/${type}`, {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
  }

  // ===== HEALTH CHECK =====

  async healthCheck() {
    return this.request('/health', { timeoutMs: 3000 });
  }
}

export const apiClient = new APIClient();
export default apiClient;
