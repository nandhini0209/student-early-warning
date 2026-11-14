const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudentMetrics,
  recalculateAll,
  requestFacultyGuidance,
  deleteStudent
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getStudents)
  .post(protect, authorize('admin', 'faculty'), createStudent);

router.post('/recalculate-all', protect, authorize('admin', 'faculty'), recalculateAll);
router.post('/request-guidance', protect, requestFacultyGuidance);

router.route('/:id')
  .get(protect, getStudentById)
  .delete(protect, authorize('admin'), deleteStudent);

router.put('/:id/metrics', protect, authorize('admin', 'faculty'), updateStudentMetrics);

module.exports = router;
