const mongoose = require('mongoose');

const thresholdConfigSchema = new mongoose.Schema(
  {
    attendanceWarning: {
      type: Number,
      default: 75,
      min: 50,
      max: 90
    },
    attendanceCritical: {
      type: Number,
      default: 65,
      min: 40,
      max: 80
    },
    marksWarning: {
      type: Number,
      default: 55,
      min: 40,
      max: 75
    },
    marksCritical: {
      type: Number,
      default: 40,
      min: 20,
      max: 55
    },
    consecutiveAbsenceLimit: {
      type: Number,
      default: 3,
      min: 1,
      max: 10
    },
    missingAssignmentLimit: {
      type: Number,
      default: 2,
      min: 1,
      max: 10
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ThresholdConfig', thresholdConfigSchema);
