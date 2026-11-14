const mongoose = require('mongoose');

const interventionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert'
    },
    counselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actionType: {
      type: String,
      enum: [
        'ONE_ON_ONE_COUNSELING',
        'REMEDIAL_CLASS',
        'PARENT_CONFERENCE',
        'PEER_TUTORING',
        'ACADEMIC_PROBATION_WARNING',
        'WELLNESS_CHECK'
      ],
      default: 'ONE_ON_ONE_COUNSELING'
    },
    scheduledDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'],
      default: 'SCHEDULED'
    },
    followUpDate: {
      type: Date,
      default: null
    },
    followUpNotes: {
      type: String,
      default: ''
    },
    followUpCompleted: {
      type: Boolean,
      default: false
    },
    preInterventionRisk: {
      type: Number,
      default: 0
    },
    postInterventionRisk: {
      type: Number,
      default: 0
    },
    improvementStatus: {
      type: String,
      enum: ['IMPROVED', 'STABLE', 'DECLINING', 'PENDING_EVALUATION'],
      default: 'PENDING_EVALUATION'
    },
    discussionNotes: {
      type: String,
      default: ''
    },
    actionItems: {
      type: String,
      default: ''
    },
    outcome: {
      type: String,
      default: 'Awaiting outcome'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Intervention', interventionSchema);
