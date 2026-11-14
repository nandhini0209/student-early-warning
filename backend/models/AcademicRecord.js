const mongoose = require('mongoose');

const academicRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    courseCode: {
      type: String,
      required: true
    },
    courseName: {
      type: String,
      required: true
    },
    internalMarks: {
      type: Number,
      required: true,
      default: 0
    },
    maxInternalMarks: {
      type: Number,
      default: 50
    },
    totalAssignments: {
      type: Number,
      default: 5
    },
    submittedAssignments: {
      type: Number,
      default: 5
    },
    remarks: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

academicRecordSchema.virtual('percentage').get(function () {
  if (!this.maxInternalMarks || this.maxInternalMarks === 0) return 0;
  return Number(((this.internalMarks / this.maxInternalMarks) * 100).toFixed(1));
});

module.exports = mongoose.model('AcademicRecord', academicRecordSchema);
