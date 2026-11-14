// Application Controller for Student Early Alert System (SEAS)
// Supporting Strict Admin Capabilities & Teacher/Mentor Monitoring Workflows
document.addEventListener('DOMContentLoaded', async () => {
  // Global State
  const state = {
    activeTab: 'admin-analytics',
    currentUser: null,
    adminData: null,
    teacherData: null,
    students: [],
    teachers: [],
    alerts: [],
    auditLogs: [],
    departments: [],
    classes: [],
    subjects: [],
    thresholds: null,
    selectedStudent: null
  };

  // UI Navigation & Auth Elements
  const appAuth = document.getElementById('app-auth');
  const appAuthenticated = document.getElementById('app-authenticated');
  const authPanelLogin = document.getElementById('auth-panel-login');
  const authPanelRegister = document.getElementById('auth-panel-register');
  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnRegister = document.getElementById('tab-btn-register');

  const navLinks = document.querySelectorAll('.nav-link');
  const navGroupAdmin = document.getElementById('nav-group-admin');
  const navGroupTeacher = document.getElementById('nav-group-teacher');
  const userNameDisplay = document.getElementById('user-name-display');
  const userRoleBadge = document.getElementById('user-role-badge');

  // Toggle between Login and Register tabs on starting screen
  window.toggleAuthTab = function (tab) {
    if (tab === 'login') {
      authPanelLogin.classList.remove('hidden');
      authPanelRegister.classList.add('hidden');
      tabBtnLogin.className = 'py-2.5 rounded-xl bg-white text-indigo-700 shadow-xs transition';
      tabBtnRegister.className = 'py-2.5 rounded-xl text-slate-600 hover:text-slate-900 transition';
    } else {
      authPanelLogin.classList.add('hidden');
      authPanelRegister.classList.remove('hidden');
      tabBtnRegister.className = 'py-2.5 rounded-xl bg-white text-indigo-700 shadow-xs transition';
      tabBtnLogin.className = 'py-2.5 rounded-xl text-slate-600 hover:text-slate-900 transition';
    }
  };

  function setAuthenticatedView(isLoggedIn) {
    if (isLoggedIn) {
      appAuth.classList.add('hidden');
      appAuthenticated.classList.remove('hidden');
    } else {
      appAuth.classList.remove('hidden');
      appAuthenticated.classList.add('hidden');
    }
  }

  // Initialize Session: Show Starting Login Page if not logged in
  async function initAuth() {
    if (!window.api.token) {
      setAuthenticatedView(false);
      return;
    }

    try {
      const res = await window.api.getMe();
      state.currentUser = res.data;
      setAuthenticatedView(true);
      updateRoleUI();

      if (state.currentUser.role === 'admin') {
        switchTab('admin-analytics');
      } else if (state.currentUser.role === 'faculty' || state.currentUser.role === 'advisor') {
        switchTab('teacher-dashboard');
      } else if (state.currentUser.role === 'student') {
        switchTab('student-portal');
      }
    } catch (err) {
      window.api.logout();
      setAuthenticatedView(false);
    }
  }

  // Logout Handler
  window.handleLogout = function () {
    window.api.logout();
    state.currentUser = null;
    setAuthenticatedView(false);
    showToast('Logged out successfully.', 'info');
  };

  // 1-Click Fast Persona Login on Starting Screen
  window.authQuickLogin = async function (email, password) {
    try {
      showToast('Signing in...', 'info');
      const res = await window.api.login(email, password);
      state.currentUser = res.data;
      setAuthenticatedView(true);
      updateRoleUI();

      if (res.data.role === 'admin') switchTab('admin-analytics');
      else if (res.data.role === 'faculty' || res.data.role === 'advisor') switchTab('teacher-dashboard');
      else if (res.data.role === 'student') switchTab('student-portal');

      showToast(`Welcome back, ${res.data.name}!`, 'success');
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    }
  };

  // Manual Login Form Submission
  window.handleManualLogin = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showToast('Please enter both email and password.', 'error');
      return;
    }

    try {
      showToast('Authenticating...', 'info');
      const res = await window.api.login(email, password);
      state.currentUser = res.data;
      setAuthenticatedView(true);
      updateRoleUI();

      if (res.data.role === 'admin') switchTab('admin-analytics');
      else if (res.data.role === 'faculty' || res.data.role === 'advisor') switchTab('teacher-dashboard');
      else if (res.data.role === 'student') switchTab('student-portal');

      showToast(`Signed in successfully as ${res.data.name}`, 'success');
    } catch (err) {
      showToast(err.message || 'Invalid email or password', 'error');
    }
  };

  // Manual Registration (Sign Up) Form Submission
  window.handleManualRegister = async function (e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const department = document.getElementById('reg-dept').value;
    const semester = document.getElementById('reg-semester') ? document.getElementById('reg-semester').value : 4;
    const section = document.getElementById('reg-section') ? document.getElementById('reg-section').value.trim().toUpperCase() : 'A';

    if (!name || !email || !password) {
      showToast('Please complete all required fields.', 'error');
      return;
    }

    try {
      showToast('Creating account & assigning faculty mentor...', 'info');
      const res = await window.api.register({
        name,
        email,
        password,
        role,
        department,
        semester,
        section
      });
      state.currentUser = res.data;
      setAuthenticatedView(true);
      updateRoleUI();

      if (res.data.role === 'admin') switchTab('admin-analytics');
      else if (res.data.role === 'faculty' || res.data.role === 'advisor') switchTab('teacher-dashboard');
      else if (res.data.role === 'student') switchTab('student-portal');

      showToast(`Account created! Welcome, ${res.data.name}`, 'success');
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    }
  };

  // Quick Role Switcher (Inside Dashboard Header)
  window.switchRole = async function (role) {
    try {
      showToast(`Switching to ${role.toUpperCase()} persona...`, 'info');
      let email = 'admin@college.edu';
      if (role === 'faculty') email = 'faculty@college.edu';
      else if (role === 'student') email = 'rahul.sharma@student.edu';

      const res = await window.api.login(email, 'Password@123');
      state.currentUser = res.data;
      setAuthenticatedView(true);
      updateRoleUI();

      if (role === 'admin') {
        switchTab('admin-analytics');
      } else if (role === 'faculty') {
        switchTab('teacher-dashboard');
      } else if (role === 'student') {
        switchTab('student-portal');
      }

      showToast(`Logged in as ${res.data.name} (${res.data.role.toUpperCase()})`, 'success');
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    }
  };

  function updateRoleUI() {
    if (!state.currentUser) return;
    userNameDisplay.textContent = state.currentUser.name;

    const role = state.currentUser.role;
    if (role === 'admin') {
      userRoleBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200';
      userRoleBadge.textContent = 'ADMINISTRATOR';
      navGroupAdmin.classList.remove('hidden');
      navGroupTeacher.classList.add('hidden');
    } else if (role === 'faculty' || role === 'advisor') {
      userRoleBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200';
      userRoleBadge.textContent = 'TEACHER / MENTOR';
      navGroupAdmin.classList.add('hidden');
      navGroupTeacher.classList.remove('hidden');
    } else {
      userRoleBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200';
      userRoleBadge.textContent = 'STUDENT';
      navGroupAdmin.classList.add('hidden');
      navGroupTeacher.classList.add('hidden');
    }
  }

  // Navigation switching
  window.switchTab = function (tabId) {
    state.activeTab = tabId;

    // Highlight nav link
    navLinks.forEach((link) => {
      if (link.dataset.tab === tabId) {
        link.className = 'nav-link w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600 transition';
      } else {
        link.className = 'nav-link w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition';
      }
    });

    // Hide all views
    document.querySelectorAll('main > section').forEach((sec) => sec.classList.add('hidden'));

    // Show active view
    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.remove('hidden');

    refreshActiveView();
  };

  async function refreshActiveView() {
    const tab = state.activeTab;
    if (tab === 'admin-analytics') await loadAdminAnalytics();
    else if (tab === 'admin-teachers') await loadAdminTeachers();
    else if (tab === 'admin-students') await loadAdminStudents();
    else if (tab === 'admin-academics') await loadAdminAcademics();
    else if (tab === 'admin-thresholds') await loadAdminThresholds();
    else if (tab === 'admin-audit') await loadAdminAuditLogs();
    else if (tab === 'teacher-dashboard') await loadTeacherDashboard();
    else if (tab === 'teacher-students') await loadTeacherStudents();
    else if (tab === 'teacher-alerts') await loadTeacherAlerts();
    else if (tab === 'teacher-interventions') await loadTeacherInterventions();
    else if (tab === 'alerts') await loadAllAlerts();
    else if (tab === 'student-portal') await loadStudentPortal();
  }

  // ================= 1. ADMIN FUNCTIONS =================

  async function loadAdminAnalytics() {
    try {
      const res = await window.api.getAdminAnalytics();
      state.adminData = res.data;
      const { counts, departmentRiskStats, teacherCaseload } = res.data;

      document.getElementById('admin-stat-total-students').textContent = counts.totalStudents;
      document.getElementById('admin-stat-active-students').textContent = `${counts.activeStudents} Active`;
      document.getElementById('admin-stat-critical').textContent = counts.criticalCount;
      document.getElementById('admin-stat-teachers').textContent = counts.totalTeachers;
      document.getElementById('admin-stat-depts').textContent = `${counts.totalDepartments} Departments`;
      document.getElementById('admin-stat-audits').textContent = counts.auditLogsCount;

      // Render Admin Charts
      if (window.renderRiskDistributionChart) {
        window.renderRiskDistributionChart('chart-admin-risk', {
          criticalCount: counts.criticalCount,
          moderateCount: counts.moderateCount,
          safeCount: counts.safeCount
        });
      }

      if (window.renderDepartmentChart) {
        window.renderDepartmentChart('chart-admin-dept', departmentRiskStats || []);
      }

      // Render Caseload Table
      const tbody = document.getElementById('admin-caseload-table-body');
      if (tbody) {
        tbody.innerHTML = teacherCaseload
          .map(
            (t) => `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-2.5 px-3 font-semibold text-slate-800">${t.name} <span class="text-[10px] text-slate-400">(${t.role})</span></td>
            <td class="py-2.5 px-3 text-slate-600">${t.department}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${t.status.toUpperCase()}</span>
            </td>
            <td class="py-2.5 px-3 font-bold text-slate-800">${t.assignedStudentCount || 0} students</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded font-bold text-xs ${t.criticalMentees > 0 ? 'bg-red-100 text-red-700' : 'text-slate-500'}">${t.criticalMentees || 0} critical</span>
            </td>
          </tr>
        `
          )
          .join('');
      }
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    }
  }

  async function loadAdminTeachers() {
    try {
      const res = await window.api.getTeachers();
      state.teachers = res.data;
      const tbody = document.getElementById('admin-teachers-table-body');
      if (!tbody) return;

      tbody.innerHTML = res.data
        .map(
          (t) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-bold text-slate-900">${t.name}</td>
          <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">${t.email}</td>
          <td class="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">${t.role}</td>
          <td class="py-3 px-4 text-slate-700">${t.department}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
              ${t.status.toUpperCase()}
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <button onclick="toggleTeacherAccount('${t._id}', '${t.status}')" class="px-3 py-1 text-xs font-semibold rounded-lg border ${
            t.status === 'active' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          }">
              ${t.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>
      `
        )
        .join('');
    } catch (err) {
      showToast('Error loading teachers: ' + err.message, 'error');
    }
  }

  window.toggleTeacherAccount = async function (id, currentStatus) {
    const reason = prompt(`Enter mandatory audit reason to ${currentStatus === 'active' ? 'deactivate' : 'activate'} this account:`);
    if (!reason) return;

    try {
      await window.api.toggleUserStatus(id, reason);
      showToast('Account status updated & logged to audit trail.', 'success');
      loadAdminTeachers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Create Teacher Modal Handlers
  window.openCreateTeacherModal = function () {
    document.getElementById('ct-name').value = '';
    document.getElementById('ct-email').value = '';
    document.getElementById('ct-password').value = 'Password@123';
    document.getElementById('modal-create-teacher').classList.remove('hidden');
  };

  window.closeCreateTeacherModal = function () {
    document.getElementById('modal-create-teacher').classList.add('hidden');
  };

  window.submitCreateTeacher = async function () {
    const name = document.getElementById('ct-name').value.trim();
    const email = document.getElementById('ct-email').value.trim();
    const password = document.getElementById('ct-password').value;
    const role = document.getElementById('ct-role').value;
    const department = document.getElementById('ct-dept').value;

    if (!name || !email) {
      alert('Please fill in teacher Name and Email.');
      return;
    }

    try {
      showToast('Creating new teacher account...', 'info');
      await window.api.createTeacher({ name, email, password, role, department });
      showToast(`Teacher ${name} created successfully!`, 'success');
      closeCreateTeacherModal();
      loadAdminTeachers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Create Student Modal Handlers
  window.openCreateStudentModal = async function () {
    if (state.teachers.length === 0) {
      const res = await window.api.getTeachers();
      state.teachers = res.data;
    }

    const select = document.getElementById('cs-mentor');
    select.innerHTML = `<option value="">Select Mentor (Optional)</option>` +
      state.teachers
        .filter((t) => t.status === 'active')
        .map((t) => `<option value="${t._id}">${t.name} (${t.department})</option>`)
        .join('');

    document.getElementById('cs-roll').value = '';
    document.getElementById('cs-name').value = '';
    document.getElementById('cs-email').value = '';
    document.getElementById('cs-attendance').value = '85';
    document.getElementById('cs-marks').value = '75';
    document.getElementById('cs-missing').value = '0';
    document.getElementById('cs-absences').value = '0';
    document.getElementById('modal-create-student').classList.remove('hidden');
  };

  window.closeCreateStudentModal = function () {
    document.getElementById('modal-create-student').classList.add('hidden');
  };

  window.submitCreateStudent = async function () {
    const rollNo = document.getElementById('cs-roll').value.trim();
    const name = document.getElementById('cs-name').value.trim();
    const email = document.getElementById('cs-email').value.trim();
    const department = document.getElementById('cs-dept').value;
    const semester = document.getElementById('cs-semester').value;
    const section = document.getElementById('cs-section').value.trim();
    const mentor = document.getElementById('cs-mentor').value || null;
    const attendancePercentage = document.getElementById('cs-attendance').value;
    const averageInternalPercentage = document.getElementById('cs-marks').value;
    const missingAssignments = document.getElementById('cs-missing').value;
    const consecutiveAbsences = document.getElementById('cs-absences').value;
    const contactPhone = document.getElementById('cs-contact').value.trim();
    const parentPhone = document.getElementById('cs-parent').value.trim();

    if (!rollNo || !name || !email) {
      alert('Please fill in Roll Number, Name, and Email.');
      return;
    }

    try {
      showToast('Registering student and evaluating early warning risk...', 'info');
      await window.api.createStudent({
        rollNo,
        name,
        email,
        department,
        semester,
        section,
        mentor,
        attendancePercentage,
        averageInternalPercentage,
        missingAssignments,
        consecutiveAbsences,
        contactPhone,
        parentPhone
      });
      showToast(`Student ${name} (${rollNo}) registered & risk evaluated!`, 'success');
      closeCreateStudentModal();
      loadAdminStudents();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Academic Structure Quick Prompts
  window.promptCreateDept = async function () {
    const name = prompt('Enter Department Name (e.g. Mechanical Engineering):');
    if (!name) return;
    const code = prompt('Enter Department Code (e.g. ME):');
    if (!code) return;

    try {
      await window.api.createDepartment({ name, code });
      showToast(`Department ${code} created successfully!`, 'success');
      loadAdminAcademics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.promptCreateClass = async function () {
    const name = prompt('Enter Class Name (e.g. CSE-4C):');
    if (!name) return;
    const sem = prompt('Enter Semester Number (1-8):', '4');

    if (state.departments.length === 0) {
      const res = await window.api.getDepartments();
      state.departments = res.data;
    }
    const deptId = state.departments[0]?._id;

    try {
      await window.api.createClass({ name, department: deptId, semester: Number(sem) || 4, section: 'C' });
      showToast(`Class ${name} created!`, 'success');
      loadAdminAcademics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.promptCreateSubject = async function () {
    const code = prompt('Enter Subject Code (e.g. CS405):');
    if (!code) return;
    const name = prompt('Enter Subject Name (e.g. Cloud Computing):');
    if (!name) return;

    if (state.departments.length === 0) {
      const res = await window.api.getDepartments();
      state.departments = res.data;
    }
    const deptId = state.departments[0]?._id;

    try {
      await window.api.createSubject({ code, name, department: deptId, semester: 4, credits: 3 });
      showToast(`Subject ${code} created!`, 'success');
      loadAdminAcademics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  async function loadAdminStudents() {
    try {
      const res = await window.api.getStudents();
      state.students = res.data;
      const tbody = document.getElementById('admin-students-table-body');
      if (!tbody) return;

      tbody.innerHTML = res.data
        .map((s) => {
          const riskColor = s.riskStatus === 'CRITICAL' ? 'bg-red-100 text-red-700' : s.riskStatus === 'MODERATE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

          return `
          <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-mono font-bold">${s.rollNo}</td>
            <td class="py-3 px-4 font-semibold text-slate-800">${s.name}</td>
            <td class="py-3 px-4 text-slate-600">${s.department}</td>
            <td class="py-3 px-4 text-slate-700">
              ${s.mentor ? `<span class="font-semibold text-indigo-700">${s.mentor.name}</span>` : `<span class="text-slate-400 italic">Unassigned</span>`}
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${riskColor}">${s.riskStatus} (${s.riskScore}/100)</span>
            </td>
            <td class="py-3 px-4 text-right space-x-2">
              <button onclick="openAssignMentorModal('${s._id}', '${s.name}')" class="px-2.5 py-1 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100">
                Assign Mentor
              </button>
              <button onclick="openAdminOverrideModal('${s._id}', '${s.name}', ${s.attendancePercentage}, ${s.averageInternalPercentage})" class="px-2.5 py-1 text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-100">
                Audit Override
              </button>
            </td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      showToast('Error loading students: ' + err.message, 'error');
    }
  }

  // Admin Override Modal
  window.openAdminOverrideModal = function (id, name, att, marks) {
    document.getElementById('ao-student-id').value = id;
    document.getElementById('ao-student-name').textContent = name;
    document.getElementById('ao-attendance').value = att;
    document.getElementById('ao-marks').value = marks;
    document.getElementById('ao-reason').value = '';
    document.getElementById('modal-admin-override').classList.remove('hidden');
  };

  window.closeAdminOverrideModal = function () {
    document.getElementById('modal-admin-override').classList.add('hidden');
  };

  window.submitAdminAcademicOverride = async function () {
    const id = document.getElementById('ao-student-id').value;
    const att = Number(document.getElementById('ao-attendance').value);
    const marks = Number(document.getElementById('ao-marks').value);
    const reason = document.getElementById('ao-reason').value.trim();

    if (!reason || reason.length < 5) {
      alert('Administrative Policy Violation: An explicit, documented audit reason is strictly mandatory to override academic records.');
      return;
    }

    try {
      showToast('Signing & recording administrative audit override...', 'info');
      await window.api.overrideStudentAcademics(id, {
        attendancePercentage: att,
        averageInternalPercentage: marks,
        reason
      });
      showToast('Academic record overridden and signed into immutable audit trail!', 'success');
      closeAdminOverrideModal();
      loadAdminStudents();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Assign Mentor Modal
  window.openAssignMentorModal = async function (id, name) {
    document.getElementById('am-student-id').value = id;
    document.getElementById('am-student-name').textContent = name;

    if (state.teachers.length === 0) {
      const res = await window.api.getTeachers();
      state.teachers = res.data;
    }

    const select = document.getElementById('am-mentor-select');
    select.innerHTML = state.teachers
      .filter((t) => t.status === 'active')
      .map((t) => `<option value="${t._id}">${t.name} (${t.department})</option>`)
      .join('');

    document.getElementById('modal-assign-mentor').classList.remove('hidden');
  };

  window.closeAssignMentorModal = function () {
    document.getElementById('modal-assign-mentor').classList.add('hidden');
  };

  window.submitMentorAssignment = async function () {
    const sid = document.getElementById('am-student-id').value;
    const mid = document.getElementById('am-mentor-select').value;
    const reason = document.getElementById('am-reason').value.trim() || 'Advisor re-allocation';

    try {
      await window.api.assignStudentMentor(sid, mid, reason);
      showToast('Mentor assigned and audit log recorded!', 'success');
      closeAssignMentorModal();
      loadAdminStudents();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Academic Structure
  async function loadAdminAcademics() {
    try {
      const [deptsRes, classesRes, subjectsRes] = await Promise.all([
        window.api.getDepartments(),
        window.api.getClasses(),
        window.api.getSubjects()
      ]);

      document.getElementById('admin-dept-list').innerHTML = deptsRes.data
        .map((d) => `<div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between"><strong>${d.code}</strong> <span>${d.name}</span></div>`)
        .join('');

      document.getElementById('admin-class-list').innerHTML = classesRes.data
        .map((c) => `<div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between"><strong>${c.name}</strong> <span>Sem ${c.semester} (Sec ${c.section})</span></div>`)
        .join('');

      document.getElementById('admin-subject-list').innerHTML = subjectsRes.data
        .map((s) => `
        <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <strong>${s.code}</strong> - ${s.name}
            <span class="block text-[10px] text-indigo-600 font-semibold mt-0.5">Teacher: ${s.assignedTeacher ? s.assignedTeacher.name : 'Unassigned'}</span>
          </div>
        </div>
      `)
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  // Warning Thresholds
  async function loadAdminThresholds() {
    try {
      const res = await window.api.getThresholds();
      const th = res.data;
      document.getElementById('th-att-warning').value = th.attendanceWarning;
      document.getElementById('th-att-critical').value = th.attendanceCritical;
      document.getElementById('th-marks-warning').value = th.marksWarning;
      document.getElementById('th-marks-critical').value = th.marksCritical;
      document.getElementById('th-abs-limit').value = th.consecutiveAbsenceLimit;
      document.getElementById('th-assign-limit').value = th.missingAssignmentLimit;
    } catch (err) {
      console.error(err);
    }
  }

  window.submitThresholdUpdate = async function () {
    const data = {
      attendanceWarning: document.getElementById('th-att-warning').value,
      attendanceCritical: document.getElementById('th-att-critical').value,
      marksWarning: document.getElementById('th-marks-warning').value,
      marksCritical: document.getElementById('th-marks-critical').value,
      consecutiveAbsenceLimit: document.getElementById('th-abs-limit').value,
      missingAssignmentLimit: document.getElementById('th-assign-limit').value,
      reason: document.getElementById('th-reason').value.trim() || 'Threshold tuning'
    };

    try {
      await window.api.updateThresholds(data);
      showToast('Warning thresholds updated institution-wide and audit logged!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Audit Logs
  async function loadAdminAuditLogs() {
    try {
      const res = await window.api.getAuditLogs();
      const tbody = document.getElementById('admin-audit-table-body');
      if (!tbody) return;

      tbody.innerHTML = res.data
        .map((l) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="py-2.5 px-4 font-mono text-slate-500 text-[11px]">${new Date(l.createdAt).toLocaleString()}</td>
          <td class="py-2.5 px-4 font-bold text-slate-800 text-[11px]">${l.action}</td>
          <td class="py-2.5 px-4 text-indigo-700 font-semibold">${l.performedBy ? l.performedBy.name : 'System'} (${l.performedByRole})</td>
          <td class="py-2.5 px-4 text-slate-700">${l.targetStudent ? `${l.targetStudent.name} (${l.targetStudent.rollNo})` : 'N/A'}</td>
          <td class="py-2.5 px-4 text-slate-600 font-mono">${l.fieldModified}</td>
          <td class="py-2.5 px-4 text-slate-800 font-medium">${l.reason}</td>
        </tr>
      `)
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  // ================= 2. TEACHER / MENTOR FUNCTIONS =================

  async function loadTeacherDashboard() {
    try {
      const res = await window.api.getTeacherDashboard();
      state.teacherData = res.data;
      const { summary, subjectsTaught, activeAlerts, pendingFollowUps } = res.data;

      document.getElementById('teacher-stat-assigned').textContent = summary.totalAssigned;
      document.getElementById('teacher-stat-critical').textContent = summary.criticalMentees;
      document.getElementById('teacher-stat-alerts').textContent = summary.activeAlertsCount;
      document.getElementById('teacher-stat-followups').textContent = summary.pendingFollowUpsCount;

      // Subjects Taught
      const subList = document.getElementById('teacher-subjects-list');
      subList.innerHTML = subjectsTaught.length === 0
        ? `<span class="text-slate-400">No subjects currently assigned.</span>`
        : subjectsTaught.map((s) => `<div class="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold">📘 ${s.code} - ${s.name}</div>`).join('');

      // Urgent Mentees Feed
      const menteesRes = await window.api.getMyStudents({ riskStatus: 'CRITICAL' });
      const container = document.getElementById('teacher-urgent-mentees');
      container.innerHTML = menteesRes.data.length === 0
        ? `<div class="p-4 text-center text-slate-400 text-xs">No mentees in critical status currently.</div>`
        : menteesRes.data.map((m) => `
          <div class="p-3.5 rounded-xl border border-red-200 bg-red-50/20 flex items-center justify-between">
            <div>
              <span class="font-bold text-slate-900">${m.name} (${m.rollNo})</span>
              <span class="text-xs text-red-600 block">Attendance: ${m.attendancePercentage.toFixed(1)}% | Internal Avg: ${m.averageInternalPercentage.toFixed(1)}% | Risk: ${m.riskScore}/100</span>
            </div>
            <div class="space-x-2">
              <button onclick="openTeacherRecordModal('${m._id}', '${m.name}')" class="px-3 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg shadow-xs hover:border-indigo-400">
                Update Marks
              </button>
              <button onclick="openGuidanceModal('${m._id}', '${m.name}')" class="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                + Guidance Note
              </button>
            </div>
          </div>
        `).join('');
    } catch (err) {
      console.error('Failed to load teacher dashboard:', err);
    }
  }

  async function loadTeacherStudents() {
    try {
      const search = document.getElementById('teacher-filter-search')?.value.trim();
      const riskStatus = document.getElementById('teacher-filter-risk')?.value;
      const viewType = document.getElementById('teacher-filter-view')?.value;

      const params = {};
      if (search) params.search = search;
      if (riskStatus && riskStatus !== 'All') params.riskStatus = riskStatus;
      if (viewType === 'all') params.filterAll = 'true';

      const res = await window.api.getMyStudents(params);
      const tbody = document.getElementById('teacher-students-table-body');
      if (!tbody) return;

      tbody.innerHTML = res.data.map((s) => {
        const trendBadge = s.performanceTrend === 'IMPROVING'
          ? `<span class="text-emerald-600 font-bold">↗ Improving</span>`
          : s.performanceTrend === 'DECLINING'
          ? `<span class="text-red-600 font-bold">↘ Declining</span>`
          : `<span class="text-slate-500 font-medium">→ Stable</span>`;

        const riskBadge = s.riskStatus === 'CRITICAL'
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">🔴 CRITICAL (${s.riskScore})</span>`
          : s.riskStatus === 'MODERATE'
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">🟡 MODERATE (${s.riskScore})</span>`
          : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">🟢 SAFE (${s.riskScore})</span>`;

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-mono font-bold">${s.rollNo}</td>
            <td class="py-3 px-4">
              <div class="font-bold text-slate-800">${s.name}</div>
              <div class="text-[11px] text-slate-400">${s.department} • Sem ${s.semester}</div>
            </td>
            <td class="py-3 px-4 font-semibold ${s.attendancePercentage < 75 ? 'text-red-600' : 'text-slate-700'}">
              ${s.attendancePercentage.toFixed(1)}%
              ${s.consecutiveAbsences >= 3 ? `<span class="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold ml-1">${s.consecutiveAbsences}d absent</span>` : ''}
            </td>
            <td class="py-3 px-4 font-semibold ${s.averageInternalPercentage < 40 ? 'text-red-600' : 'text-slate-700'}">
              ${s.averageInternalPercentage.toFixed(1)}%
              <span class="text-[10px] text-slate-400 block">${s.missingAssignments} missing hw</span>
            </td>
            <td class="py-3 px-4">${trendBadge}</td>
            <td class="py-3 px-4">${riskBadge}</td>
            <td class="py-3 px-4 text-right space-x-1.5">
              <button onclick="openTeacherRecordModal('${s._id}', '${s.name}')" class="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                Enter Records
              </button>
              <button onclick="openGuidanceModal('${s._id}', '${s.name}')" class="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                + Guidance
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      showToast('Error loading students: ' + err.message, 'error');
    }
  }

  // Teacher Enter Marks & Attendance
  window.openTeacherRecordModal = function (id, name) {
    document.getElementById('tr-student-id').value = id;
    document.getElementById('tr-student-name').textContent = name;
    document.getElementById('modal-teacher-record').classList.remove('hidden');
  };

  window.closeTeacherRecordModal = function () {
    document.getElementById('modal-teacher-record').classList.add('hidden');
  };

  window.submitTeacherRecord = async function () {
    const studentId = document.getElementById('tr-student-id').value;
    const courseCode = document.getElementById('tr-course-code').value;
    const attendedClasses = document.getElementById('tr-attended').value;
    const totalClasses = document.getElementById('tr-total-classes').value;
    const internalMarks = document.getElementById('tr-internal-marks').value;
    const consecutiveAbsences = document.getElementById('tr-consecutive-abs').value;
    const submittedAssignments = document.getElementById('tr-submitted-assign').value;
    const totalAssignments = document.getElementById('tr-total-assign').value;
    const remarks = document.getElementById('tr-remarks').value;

    try {
      showToast('Recording marks and re-evaluating risk score...', 'info');
      await window.api.updateStudentRecords(studentId, {
        courseCode,
        attendedClasses,
        totalClasses,
        internalMarks,
        consecutiveAbsences,
        submittedAssignments,
        totalAssignments,
        remarks
      });
      showToast('Performance record saved & risk score recalculated!', 'success');
      closeTeacherRecordModal();
      loadTeacherStudents();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Teacher Guidance & Follow-up
  window.openGuidanceModal = function (id, name, alertId = null) {
    document.getElementById('gd-student-id').value = id;
    document.getElementById('gd-student-name').textContent = name;
    document.getElementById('gd-alert-id').value = alertId || '';
    document.getElementById('gd-discussion-notes').value = '';
    document.getElementById('gd-action-items').value = '';
    document.getElementById('modal-teacher-guidance').classList.remove('hidden');
  };

  window.closeGuidanceModal = function () {
    document.getElementById('modal-teacher-guidance').classList.add('hidden');
  };

  window.submitGuidanceSession = async function () {
    const studentId = document.getElementById('gd-student-id').value;
    const alertId = document.getElementById('gd-alert-id').value;
    const actionType = document.getElementById('gd-action-type').value;
    const discussionNotes = document.getElementById('gd-discussion-notes').value.trim();
    const actionItems = document.getElementById('gd-action-items').value.trim();
    const followUpDate = document.getElementById('gd-followup-date').value;

    if (!discussionNotes) {
      alert('Please enter guidance & root cause notes.');
      return;
    }

    try {
      showToast('Saving guidance session & follow-up...', 'info');
      await window.api.logGuidanceIntervention({
        studentId,
        alertId: alertId || null,
        actionType,
        discussionNotes,
        actionItems,
        followUpDate
      });
      showToast('Guidance logged and follow-up scheduled successfully!', 'success');
      closeGuidanceModal();
      loadTeacherDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Teacher Alerts with Reasons
  async function loadTeacherAlerts() {
    try {
      const res = await window.api.getTeacherAlerts();
      const container = document.getElementById('teacher-alerts-container');
      if (!container) return;

      container.innerHTML = res.data.length === 0
        ? `<div class="p-8 text-center text-slate-400 text-xs">No active alerts for your assigned mentees.</div>`
        : res.data.map((a) => {
            const sevBg = a.severity === 'CRITICAL' ? 'border-l-4 border-l-red-500 bg-red-50/20' : 'border-l-4 border-l-amber-500 bg-amber-50/20';

            return `
              <div class="p-4 rounded-xl border border-slate-200 bg-white ${sevBg} space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${a.status}</span>
                    <span class="text-xs font-bold text-slate-900">${a.title}</span>
                  </div>
                  <span class="text-[11px] text-slate-400 font-mono">${new Date(a.createdAt).toLocaleDateString()}</span>
                </div>

                <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <strong>Trigger Root Cause:</strong> ${a.description}
                </div>

                <div class="flex items-center justify-between pt-1 text-xs">
                  <span class="text-slate-600">Mentee: <strong>${a.student ? a.student.name : 'Unknown'} (${a.student ? a.student.rollNo : ''})</strong></span>
                  <button onclick="openGuidanceModal('${a.student ? a.student._id : ''}', '${a.student ? a.student.name : ''}', '${a._id}')" class="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs">
                    + Provide Guidance & Follow-up
                  </button>
                </div>
              </div>
            `;
          }).join('');
    } catch (err) {
      console.error(err);
    }
  }

  // Teacher Interventions & Follow-ups
  async function loadTeacherInterventions() {
    try {
      const res = await window.api.getInterventions();
      const container = document.getElementById('teacher-interventions-container');
      if (!container) return;

      container.innerHTML = res.data.length === 0
        ? `<div class="p-8 text-center text-slate-400 text-xs">No guidance interventions logged yet.</div>`
        : res.data.map((item) => {
            const impBadge = item.improvementStatus === 'IMPROVED'
              ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">🟢 IMPROVED (${item.preInterventionRisk} → ${item.postInterventionRisk})</span>`
              : item.improvementStatus === 'DECLINING'
              ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">🔴 DECLINING</span>`
              : `<span class="text-[10px] text-slate-400">Status: ${item.status}</span>`;

            return `
              <div class="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}">${item.status}</span>
                    <strong class="text-sm text-slate-800">${item.actionType}</strong>
                  </div>
                  ${impBadge}
                </div>

                <div class="text-xs text-slate-600">
                  <strong>Mentee:</strong> ${item.student ? `${item.student.name} (${item.student.rollNo})` : 'N/A'} |
                  <strong>Scheduled:</strong> ${new Date(item.scheduledDate).toLocaleDateString()}
                  ${item.followUpDate ? `| <strong class="text-indigo-600">Follow-up:</strong> ${new Date(item.followUpDate).toLocaleDateString()}` : ''}
                </div>

                <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <strong>Discussion Notes:</strong> ${item.discussionNotes || 'None recorded'}
                </div>

                ${item.outcome ? `<div class="text-xs text-emerald-700 font-semibold">Outcome: ${item.outcome}</div>` : ''}

                ${item.status !== 'COMPLETED' ? `
                  <div class="flex justify-end pt-1">
                    <button onclick="promptCompleteIntervention('${item._id}')" class="px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg">
                      Mark Completed & Measure Improvement &rarr;
                    </button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('');
    } catch (err) {
      console.error(err);
    }
  }

  window.promptCompleteIntervention = async function (id) {
    const outcome = prompt('Enter intervention outcome / student agreement details:');
    if (!outcome) return;

    try {
      await window.api.completeTeacherIntervention(id, { outcome });
      showToast('Intervention marked complete! Post-intervention improvement calculated.', 'success');
      loadTeacherInterventions();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ================= 3. ALL ALERTS & STUDENT PORTAL =================

  async function loadAllAlerts() {
    try {
      const res = await window.api.getAlerts();
      const container = document.getElementById('alerts-list-container');
      if (!container) return;

      container.innerHTML = res.data.map((a) => `
        <div class="p-3.5 rounded-xl border border-slate-200 bg-white flex justify-between items-center text-xs">
          <div>
            <span class="font-bold text-slate-900">${a.title}</span>
            <span class="text-slate-500 block">${a.description}</span>
            <span class="text-indigo-600 font-semibold text-[11px]">Student: ${a.student ? a.student.name : 'Unknown'} (${a.student ? a.student.rollNo : ''})</span>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'OPEN' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">${a.status}</span>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }

  const ACTION_TYPE_LABELS = {
    'ONE_ON_ONE_COUNSELING': '1-on-1 Academic Counseling & Recovery Plan',
    'REMEDIAL_CLASS': 'Remedial Class Assignment',
    'PARENT_CONFERENCE': 'Parent & Mentor Conference',
    'PEER_TUTORING': 'Peer Tutoring & Study Pairing',
    'WELLNESS_CHECK': 'Student Wellness & Stress Check',
    'ACADEMIC_PROBATION_WARNING': 'Institutional Academic Advisory Warning'
  };

  function renderStudentPortalDetails(detailData) {
    const s = detailData.student;
    if (!s) return;

    // Student identity
    document.getElementById('portal-student-name').textContent = s.name;
    document.getElementById('portal-student-roll').textContent = s.rollNo;
    document.getElementById('portal-student-dept').textContent = `${s.department} • Semester ${s.semester} • Section ${s.section || 'A'}`;

    // Standing badge
    const badgeEl = document.getElementById('portal-standing-badge');
    if (badgeEl) {
      if (s.riskStatus === 'CRITICAL') {
        badgeEl.textContent = '🔴 Academic Attention Required';
        badgeEl.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30';
      } else if (s.riskStatus === 'MODERATE') {
        badgeEl.textContent = '🟡 Advisory Notice (Recovery Recommended)';
        badgeEl.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30';
      } else {
        badgeEl.textContent = '🟢 Good Academic Standing';
        badgeEl.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
      }
    }

    // Designated Faculty Mentor Details
    state.currentStudentMentor = s.mentor;
    const mentorNameEl = document.getElementById('portal-mentor-name');
    const mentorDeptEl = document.getElementById('portal-mentor-dept');
    const mentorEmailEl = document.getElementById('portal-mentor-email');
    const mentorStatusEl = document.getElementById('portal-mentor-status');

    if (s.mentor) {
      if (mentorNameEl) mentorNameEl.textContent = s.mentor.name || 'Assigned Faculty';
      if (mentorDeptEl) mentorDeptEl.textContent = `${s.mentor.role === 'advisor' ? 'Senior Academic Advisor' : 'Course Teacher & Mentor'} • Dept of ${s.mentor.department || s.department}`;
      if (mentorEmailEl) mentorEmailEl.textContent = s.mentor.email || 'faculty@college.edu';
      if (mentorStatusEl) {
        mentorStatusEl.textContent = '🟢 Active Mentorship';
        mentorStatusEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800';
      }
    } else {
      if (mentorNameEl) mentorNameEl.textContent = 'Department Class Mentor';
      if (mentorDeptEl) mentorDeptEl.textContent = `Dept of ${s.department}`;
      if (mentorEmailEl) mentorEmailEl.textContent = 'faculty@college.edu';
      if (mentorStatusEl) {
        mentorStatusEl.textContent = '⚪ Institutional Allocation';
        mentorStatusEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700';
      }
    }

    // Telemetry Cards
    document.getElementById('portal-risk-score').textContent = `${s.riskScore}/100`;
    document.getElementById('portal-attendance-val').textContent = `${s.attendancePercentage.toFixed(1)}%`;
    document.getElementById('portal-internals-val').textContent = `${s.averageInternalPercentage.toFixed(1)}%`;
    const assignValEl = document.getElementById('portal-assignments-val');
    if (assignValEl) assignValEl.textContent = `${s.missingAssignments || 0} Missing`;

    const statusEl = document.getElementById('portal-risk-status');
    statusEl.textContent = s.riskStatus;
    statusEl.className = s.riskStatus === 'CRITICAL' ? 'font-bold text-red-600' : s.riskStatus === 'MODERATE' ? 'font-bold text-amber-600' : 'font-bold text-emerald-600';

    // Guidance Notes & Action Plan from Faculty
    const guidanceContainer = document.getElementById('portal-guidance-list');
    const guidanceCountEl = document.getElementById('portal-guidance-count');
    const interventions = detailData.interventions || [];

    if (guidanceCountEl) guidanceCountEl.textContent = `${interventions.length} Guidance Session(s)`;

    if (guidanceContainer) {
      if (interventions.length === 0) {
        guidanceContainer.innerHTML = `
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-1">
            <p class="font-bold text-slate-700">No counseling sessions recorded yet.</p>
            <p>Your faculty mentor monitors your metrics continuously. Click "Request Guidance / Counseling" above if you need assistance with coursework or attendance.</p>
          </div>
        `;
      } else {
        guidanceContainer.innerHTML = interventions.map((iv) => {
          const actionLabel = ACTION_TYPE_LABELS[iv.actionType] || iv.actionType || 'Counseling Session';
          const counselorName = iv.counselor ? iv.counselor.name : (s.mentor ? s.mentor.name : 'Faculty Mentor');
          const dateStr = iv.scheduledDate ? new Date(iv.scheduledDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent';
          const followUpStr = iv.followUpDate ? new Date(iv.followUpDate).toLocaleDateString() : null;

          return `
            <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition space-y-2">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center space-x-2">
                  <span class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">💬</span>
                  <div>
                    <h4 class="font-bold text-xs text-slate-800">${actionLabel}</h4>
                    <p class="text-[10px] text-slate-500">Conducted by <strong>${counselorName}</strong> • ${dateStr}</p>
                  </div>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  iv.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                  iv.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                }">
                  ${iv.status || 'SCHEDULED'}
                </span>
              </div>

              ${iv.discussionNotes ? `
                <div class="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100">
                  <span class="font-bold text-indigo-900 block text-[11px] mb-0.5">Faculty Guidance & Discussion Notes:</span>
                  <p class="text-[11px] leading-relaxed">${iv.discussionNotes}</p>
                </div>
              ` : ''}

              ${iv.actionItems ? `
                <div class="text-xs text-slate-700 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                  <span class="font-bold text-amber-900 block text-[11px] mb-0.5">📌 Agreed Action Items for Student:</span>
                  <p class="text-[11px] leading-relaxed text-amber-800 whitespace-pre-line">${iv.actionItems}</p>
                </div>
              ` : ''}

              ${followUpStr ? `
                <div class="text-[10px] text-slate-500 flex items-center space-x-1">
                  <span>📅 Scheduled Follow-Up Review:</span>
                  <strong class="text-slate-700">${followUpStr}</strong>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    // Recovery Recommendations
    const recs = [];
    if (s.attendancePercentage < 75) recs.push(`⚠️ Attendance Deficit Warning: Your overall attendance is ${s.attendancePercentage.toFixed(1)}% (below institutional floor of 75%). Mandatory lab attendance required.`);
    if (s.averageInternalPercentage < 40) recs.push(`📚 Continuous Assessment Alert: Average internal mark is ${s.averageInternalPercentage.toFixed(1)}%. Remedial coaching sessions advised.`);
    if (s.missingAssignments > 0) recs.push(`📝 Assignment Backlog: You have ${s.missingAssignments} unsubmitted assignment(s). Submit immediately to improve continuous evaluation.`);
    if (recs.length === 0) recs.push(`🌟 Excellent Standing! Your attendance (${s.attendancePercentage.toFixed(1)}%) and internal exam scores (${s.averageInternalPercentage.toFixed(1)}%) satisfy all university benchmarks.`);

    document.getElementById('portal-recommendations').innerHTML = recs.map((r) => `<li class="p-2.5 rounded-lg bg-white border border-slate-200 text-xs">${r}</li>`).join('');

    // Course Performance Table
    const attendanceRecords = detailData.attendanceRecords || [];
    const academicRecords = detailData.academicRecords || [];

    document.getElementById('portal-subjects-body').innerHTML = attendanceRecords.length === 0
      ? `<tr><td colspan="6" class="py-3 px-3 text-center text-slate-400">No subject records enrolled yet.</td></tr>`
      : attendanceRecords.map((att) => {
          const acad = academicRecords.find((a) => a.courseCode === att.courseCode) || {
            internalMarks: 0,
            maxInternalMarks: 50,
            percentage: 0,
            submittedAssignments: 5,
            totalAssignments: 5
          };

          const isAttendanceLow = att.percentage < 75;
          const isMarksLow = acad.percentage < 40;
          const isAtRisk = isAttendanceLow || isMarksLow;

          return `
            <tr class="border-b border-slate-100 hover:bg-slate-50/50">
              <td class="py-2.5 px-3">
                <span class="font-bold text-slate-900">${att.courseCode}</span>
                <span class="text-slate-500 block text-[11px]">${att.courseName}</span>
              </td>
              <td class="py-2.5 px-3 font-medium text-slate-700">${att.attendedClasses} / ${att.totalClasses}</td>
              <td class="py-2.5 px-3">
                <span class="font-bold ${isAttendanceLow ? 'text-rose-600' : 'text-emerald-600'}">${att.percentage}%</span>
              </td>
              <td class="py-2.5 px-3 font-medium text-slate-700">
                <span>${acad.internalMarks} / ${acad.maxInternalMarks}</span>
                <span class="text-[11px] text-slate-400"> (${acad.percentage}%)</span>
              </td>
              <td class="py-2.5 px-3 font-medium text-slate-700">
                ${acad.submittedAssignments} / ${acad.totalAssignments}
              </td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                  isAtRisk ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }">
                  ${isAtRisk ? 'Debarment Risk' : 'Eligible'}
                </span>
              </td>
            </tr>
          `;
        }).join('');
  }

  async function loadStudentPortal() {
    try {
      const currentUser = state.currentUser;

      // 1. If currently logged in as a student, display THEIR OWN personal record!
      if (currentUser && currentUser.role === 'student') {
        if (currentUser.studentRef) {
          const studentId = currentUser.studentRef._id || currentUser.studentRef;
          const detail = await window.api.getStudentById(studentId);
          if (detail && detail.data && detail.data.student) {
            renderStudentPortalDetails(detail.data);
            return;
          }
        }

        const emailSearch = await window.api.getStudents({ search: currentUser.email });
        if (emailSearch && emailSearch.data && emailSearch.data.length > 0) {
          const detail = await window.api.getStudentById(emailSearch.data[0]._id);
          renderStudentPortalDetails(detail.data);
          return;
        }

        const nameSearch = await window.api.getStudents({ search: currentUser.name });
        if (nameSearch && nameSearch.data && nameSearch.data.length > 0) {
          const detail = await window.api.getStudentById(nameSearch.data[0]._id);
          renderStudentPortalDetails(detail.data);
          return;
        }
      }

      // 2. If logged in as an Admin or Faculty/Advisor previewing the Student Portal tab:
      const res = await window.api.getStudents();
      if (res.data && res.data.length > 0) {
        const detail = await window.api.getStudentById(res.data[0]._id);
        renderStudentPortalDetails(detail.data);
      }
    } catch (err) {
      console.error('Failed to load student portal:', err);
    }
  }

  // Request Guidance Modal Handlers (Exposed on Window for HTML onclick)
  window.openRequestGuidanceModal = function () {
    const modal = document.getElementById('modal-request-guidance');
    if (!modal) return;
    const mentor = state.currentStudentMentor;
    const nm = document.getElementById('rg-mentor-name');
    const em = document.getElementById('rg-mentor-email');
    if (mentor) {
      if (nm) nm.textContent = mentor.name || 'Assigned Faculty Mentor';
      if (em) em.textContent = mentor.email || 'faculty@college.edu';
    } else {
      if (nm) nm.textContent = 'Designated Faculty Mentor';
      if (em) em.textContent = 'faculty@college.edu';
    }
    modal.classList.remove('hidden');
  };

  window.closeRequestGuidanceModal = function () {
    const modal = document.getElementById('modal-request-guidance');
    if (modal) modal.classList.add('hidden');
  };

  window.submitStudentGuidanceRequest = async function () {
    const actionType = document.getElementById('rg-action-type').value;
    const urgency = document.getElementById('rg-urgency').value;
    const notes = document.getElementById('rg-notes').value.trim();

    if (!notes) {
      showToast('Please enter your query or notes for your faculty mentor.', 'error');
      return;
    }

    try {
      showToast('Submitting guidance request to faculty mentor...', 'info');
      await window.api.requestGuidance({
        actionType,
        urgency,
        discussionNotes: notes
      });

      closeRequestGuidanceModal();
      document.getElementById('rg-notes').value = '';
      showToast('Guidance request sent! Your faculty mentor will review it.', 'success');
      await loadStudentPortal();
    } catch (err) {
      showToast(err.message || 'Failed to submit guidance request', 'error');
    }
  };

  // Toast System
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const colors = {
      info: 'bg-indigo-600 text-white',
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white'
    };

    toast.className = `fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold transition duration-300 z-50 ${colors[type] || colors.info}`;
    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  // Setup Event Listeners for Filters
  document.getElementById('teacher-filter-search')?.addEventListener('input', () => loadTeacherStudents());
  document.getElementById('teacher-filter-risk')?.addEventListener('change', () => loadTeacherStudents());
  document.getElementById('teacher-filter-view')?.addEventListener('change', () => loadTeacherStudents());

  // Start Application
  await initAuth();
});
