const express = require('express');
const router = express.Router();
const {
  getTeacherDashboard,
  getMyStudents,
  updateStudentRecords,
  getStudentPerformanceTrends,
  getTeacherAlerts,
  logGuidanceIntervention,
  completeIntervention,
  getInterventionHistory
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Teacher / Mentor / Faculty / Advisor role protected
router.use(protect, authorize('faculty', 'advisor', 'admin'));

// Dashboard
router.get('/dashboard', getTeacherDashboard);

// Assigned Students
router.get('/my-students', getMyStudents);

// Student Academic & Attendance Entry (Marks, Attendance, Assignments)
router.put('/students/:studentId/records', updateStudentRecords);

// Performance Trends & History
router.get('/students/:studentId/trends', getStudentPerformanceTrends);

// Teacher's Alerts for assigned mentees
router.get('/alerts', getTeacherAlerts);

// Guidance & Interventions
router.post('/interventions', logGuidanceIntervention);
router.put('/interventions/:id/complete', completeIntervention);
router.get('/students/:studentId/intervention-history', getInterventionHistory);

module.exports = router;
