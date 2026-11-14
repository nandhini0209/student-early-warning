const express = require('express');
const router = express.Router();
const {
  getAlerts,
  createAlert,
  updateAlertStatus
} = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getAlerts)
  .post(protect, authorize('admin', 'faculty', 'advisor'), createAlert);

router.route('/:id')
  .put(protect, authorize('admin', 'faculty', 'advisor'), updateAlertStatus);

module.exports = router;
