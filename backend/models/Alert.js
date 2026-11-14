const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    raisedByRole: {
      type: String,
      default: 'SYSTEM'
    },
    triggerType: {
      type: String,
      enum: [
        'ATTENDANCE_CRITICAL', // Attendance < 75%
        'POOR_INTERNAL_MARKS', // Marks < 40%
        'CONSECUTIVE_ABSENCE', // 3 or more consecutive absences
        'MISSING_ASSIGNMENTS', // >= 2 missing assignments
        'COMPOSITE_HIGH_RISK', // Risk score >= 70
        'MANUAL_FACULTY_FLAG'  // Manual behavioral or academic concern
      ],
      required: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'],
      default: 'OPEN'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    },
    resolutionNotes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
