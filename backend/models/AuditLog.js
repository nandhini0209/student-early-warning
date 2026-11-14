const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'ACADEMIC_RECORD_OVERRIDE',
        'ATTENDANCE_OVERRIDE',
        'ACCOUNT_STATUS_CHANGE',
        'MENTOR_ASSIGNMENT',
        'THRESHOLD_CONFIG_CHANGE',
        'STUDENT_DELETION'
      ]
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedByRole: {
      type: String,
      default: 'admin'
    },
    targetStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null
    },
    entityType: {
      type: String,
      required: true
    },
    fieldModified: {
      type: String,
      required: true
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    reason: {
      type: String,
      required: [true, 'An explicit audit reason is strictly mandatory for administrative overrides']
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
