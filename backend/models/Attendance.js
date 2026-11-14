const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    courseCode: {
      type: String,
      required: true,
      trim: true
    },
    courseName: {
      type: String,
      required: true
    },
    totalClasses: {
      type: Number,
      required: true,
      default: 0
    },
    attendedClasses: {
      type: Number,
      required: true,
      default: 0
    },
    consecutiveAbsences: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for calculating percentage
attendanceSchema.virtual('percentage').get(function () {
  if (!this.totalClasses || this.totalClasses === 0) return 100;
  return Number(((this.attendedClasses / this.totalClasses) * 100).toFixed(1));
});

module.exports = mongoose.model('Attendance', attendanceSchema);
