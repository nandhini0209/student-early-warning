// API Client for Student Early Alert System (Production-Ready)
// Intelligently supports both unified production deployment and local multi-port dev
const isLocalSeparateDev = (
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  window.location.port !== '5000' &&
  window.location.port !== ''
);
const API_BASE = isLocalSeparateDev
  ? 'http://localhost:5000/api'
  : '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('seas_jwt_token') || null;
    this.currentUser = JSON.parse(localStorage.getItem('seas_user') || 'null');
  }

  setSession(token, user) {
    this.token = token;
    this.currentUser = user;
    if (token) {
      localStorage.setItem('seas_jwt_token', token);
      localStorage.setItem('seas_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('seas_jwt_token');
      localStorage.removeItem('seas_user');
    }
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = this.getHeaders();

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {})
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'API request failed');
      }
      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // --- Auth Endpoints ---
  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.success && res.data.token) {
      this.setSession(res.data.token, res.data);
    }
    return res;
  }

  async register(userData) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (res.success && res.data.token) {
      this.setSession(res.data.token, res.data);
    }
    return res;
  }

  logout() {
    this.setSession(null, null);
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // --- Common Dashboard Analytics ---
  async getDashboardStats() {
    return this.request('/analytics/dashboard');
  }

  // --- ADMIN CAPABILITIES ---
  async getAdminAnalytics() {
    return this.request('/admin/analytics');
  }

  async getTeachers() {
    return this.request('/admin/teachers');
  }

  async createTeacher(teacherData) {
    return this.request('/admin/teachers', {
      method: 'POST',
      body: JSON.stringify(teacherData)
    });
  }

  async toggleUserStatus(userId, reason) {
    return this.request(`/admin/users/${userId}/toggle-status`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    });
  }

  async getDepartments() {
    return this.request('/admin/departments');
  }

  async createDepartment(data) {
    return this.request('/admin/departments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getClasses() {
    return this.request('/admin/classes');
  }

  async createClass(data) {
    return this.request('/admin/classes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getSubjects() {
    return this.request('/admin/subjects');
  }

  async createSubject(data) {
    return this.request('/admin/subjects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async assignSubjectTeacher(subjectId, teacherId) {
    return this.request('/admin/subjects/assign-teacher', {
      method: 'POST',
      body: JSON.stringify({ subjectId, teacherId })
    });
  }

  async assignStudentMentor(studentIds, mentorId, reason) {
    return this.request('/admin/students/assign-mentor', {
      method: 'POST',
      body: JSON.stringify({ studentIds, mentorId, reason })
    });
  }

  async getThresholds() {
    return this.request('/admin/thresholds');
  }

  async updateThresholds(thresholdData) {
    return this.request('/admin/thresholds', {
      method: 'PUT',
      body: JSON.stringify(thresholdData)
    });
  }

  // Admin MUST have audit reason to override academic record!
  async overrideStudentAcademics(studentId, overrideData) {
    return this.request(`/admin/students/${studentId}/override-academics`, {
      method: 'PUT',
      body: JSON.stringify(overrideData)
    });
  }

  async getAuditLogs() {
    return this.request('/admin/audit-logs');
  }

  // --- TEACHER / MENTOR CAPABILITIES ---
  async getTeacherDashboard() {
    return this.request('/teacher/dashboard');
  }

  async getMyStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/teacher/my-students${query ? `?${query}` : ''}`);
  }

  async updateStudentRecords(studentId, recordData) {
    return this.request(`/teacher/students/${studentId}/records`, {
      method: 'PUT',
      body: JSON.stringify(recordData)
    });
  }

  async getStudentPerformanceTrends(studentId) {
    return this.request(`/teacher/students/${studentId}/trends`);
  }

  async getTeacherAlerts() {
    return this.request('/teacher/alerts');
  }

  async logGuidanceIntervention(data) {
    return this.request('/teacher/interventions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async completeTeacherIntervention(id, data) {
    return this.request(`/teacher/interventions/${id}/complete`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getInterventionHistory(studentId) {
    return this.request(`/teacher/students/${studentId}/intervention-history`);
  }

  // --- General Student Endpoints ---
  async getStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/students${query ? `?${query}` : ''}`);
  }

  async getStudentById(id) {
    return this.request(`/students/${id}`);
  }

  async createStudent(studentData) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
  }

  async deleteStudent(id) {
    return this.request(`/students/${id}`, {
      method: 'DELETE'
    });
  }

  // --- Alerts & Interventions ---
  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/alerts${query ? `?${query}` : ''}`);
  }

  async updateAlert(id, updateData) {
    return this.request(`/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async getInterventions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/interventions${query ? `?${query}` : ''}`);
  }

  // Student guidance request to assigned faculty mentor
  async requestGuidance(guidanceData) {
    return this.request('/students/request-guidance', {
      method: 'POST',
      body: JSON.stringify(guidanceData)
    });
  }
}

window.api = new ApiClient();
