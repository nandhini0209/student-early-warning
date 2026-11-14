const express = require('express');
const router = express.Router();
const {
  getInterventions,
  createIntervention,
  updateIntervention
} = require('../controllers/interventionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getInterventions)
  .post(protect, authorize('admin', 'faculty', 'advisor'), createIntervention);

router.route('/:id')
  .put(protect, authorize('admin', 'faculty', 'advisor'), updateIntervention);

module.exports = router;
