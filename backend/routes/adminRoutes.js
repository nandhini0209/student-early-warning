const express = require('express');
const router = express.Router();
const {
  getAdminAnalytics,
  getTeachers,
  createTeacher,
  toggleUserStatus,
  getDepartments,
  createDepartment,
  getClasses,
  createClass,
  getSubjects,
  createSubject,
  assignSubjectTeacher,
  assignStudentMentor,
  getThresholds,
  updateThresholds,
  overrideStudentAcademics,
  getAuditLogs
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All Admin routes require 'admin' role
router.use(protect, authorize('admin'));

// Analytics
router.get('/analytics', getAdminAnalytics);

// Teachers & Users Management
router.get('/teachers', getTeachers);
router.post('/teachers', createTeacher);
router.put('/users/:id/toggle-status', toggleUserStatus);

// Departments
router.route('/departments')
  .get(getDepartments)
  .post(createDepartment);

// Classes
router.route('/classes')
  .get(getClasses)
  .post(createClass);

// Subjects
router.route('/subjects')
  .get(getSubjects)
  .post(createSubject);
router.post('/subjects/assign-teacher', assignSubjectTeacher);

// Mentor Assignment
router.post('/students/assign-mentor', assignStudentMentor);

// Warning Thresholds Configuration
router.route('/thresholds')
  .get(getThresholds)
  .put(updateThresholds);

// Academic Records Override with MANDATORY Audit Trail
router.put('/students/:id/override-academics', overrideStudentAcademics);

// Audit Logs Viewer
router.get('/audit-logs', getAuditLogs);

module.exports = router;
