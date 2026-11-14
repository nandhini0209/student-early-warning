const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    rollNo: {
      type: String,
      required: [true, 'Roll Number is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Student email is required'],
      lowercase: true,
      trim: true
    },
    department: {
      type: String,
      required: true,
      default: 'Computer Science'
    },
    departmentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    classRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClassRoom',
      default: null
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
      default: 4
    },
    section: {
      type: String,
      default: 'A'
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    performanceTrend: {
      type: String,
      enum: ['IMPROVING', 'STABLE', 'DECLINING'],
      default: 'STABLE'
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    contactPhone: {
      type: String,
      default: ''
    },
    parentPhone: {
      type: String,
      default: ''
    },
    // Early Alert Calculated Metrics
    riskStatus: {
      type: String,
      enum: ['SAFE', 'MODERATE', 'CRITICAL'],
      default: 'SAFE'
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    attendancePercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    cgpa: {
      type: Number,
      default: 8.0,
      min: 0,
      max: 10.0
    },
    consecutiveAbsences: {
      type: Number,
      default: 0
    },
    missingAssignments: {
      type: Number,
      default: 0
    },
    averageInternalPercentage: {
      type: Number,
      default: 80
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
