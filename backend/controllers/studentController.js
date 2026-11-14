const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const AcademicRecord = require('../models/AcademicRecord');
const Alert = require('../models/Alert');
const Intervention = require('../models/Intervention');
const User = require('../models/User');
const { calculateRiskScore, syncStudentAlerts, getActiveThresholds } = require('../utils/riskEngine');

// @desc    Get all students with query filters
// @route   GET /api/students
// @access  Private (Role protected: Students only see their own profile)
const getStudents = async (req, res) => {
  try {
    const { department, riskStatus, semester, search } = req.query;
    let query = {};

    // Privacy & Security Check: Student can ONLY retrieve their own student profile!
    if (req.user && req.user.role === 'student') {
      if (req.user.studentRef) {
        query._id = req.user.studentRef;
      } else {
        query.email = req.user.email;
      }
    } else {
      if (department && department !== 'All') {
        query.department = department;
      }
      if (riskStatus && riskStatus !== 'All') {
        query.riskStatus = riskStatus;
      }
      if (semester && semester !== 'All') {
        query.semester = Number(semester);
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { rollNo: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
    }

    const students = await Student.find(query)
      .populate('mentor', 'name email department role')
      .sort({ riskScore: -1, attendancePercentage: 1 });
    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single student details with academic & alert history
// @route   GET /api/students/:id
// @access  Private (Student role restricted to own ID)
const getStudentById = async (req, res) => {
  try {
    // Privacy & Security Check: If requester is a student, forbid snooping on peers
    if (req.user && req.user.role === 'student') {
      const ownStudentId = req.user.studentRef ? req.user.studentRef.toString() : null;
      if (ownStudentId !== req.params.id) {
        const ownStudent = await Student.findOne({ email: req.user.email });
        if (!ownStudent || ownStudent._id.toString() !== req.params.id) {
          return res.status(403).json({
            success: false,
            message: 'Access Denied: You are only authorized to view your own student records.'
          });
        }
      }
    }

    const student = await Student.findById(req.params.id).populate('mentor', 'name email department role');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const attendanceRecords = await Attendance.find({ student: student._id });
    const academicRecords = await AcademicRecord.find({ student: student._id });
    const alerts = await Alert.find({ student: student._id }).sort({ createdAt: -1 });
    const interventions = await Intervention.find({ student: student._id })
      .populate('counselor', 'name email role department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        student,
        attendanceRecords,
        academicRecords,
        alerts,
        interventions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin / Faculty)
const createStudent = async (req, res) => {
  try {
    const {
      rollNo,
      name,
      email,
      department,
      semester,
      section,
      mentor,
      contactPhone,
      parentPhone,
      attendancePercentage = 85,
      averageInternalPercentage = 75,
      missingAssignments = 0,
      consecutiveAbsences = 0
    } = req.body;

    const exists = await Student.findOne({ rollNo: rollNo.toUpperCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Student with this Roll Number already exists' });
    }

    const thresholds = await getActiveThresholds();
    const { riskScore, riskStatus, recommendedAlerts } = calculateRiskScore({
      attendancePercentage: Number(attendancePercentage),
      averageInternalPercentage: Number(averageInternalPercentage),
      missingAssignments: Number(missingAssignments),
      consecutiveAbsences: Number(consecutiveAbsences)
    }, thresholds);

    const student = await Student.create({
      rollNo: rollNo.toUpperCase(),
      name,
      email,
      department: department || 'Computer Science',
      semester: Number(semester) || 4,
      section: section || 'A',
      mentor: mentor || null,
      contactPhone: contactPhone || '',
      parentPhone: parentPhone || '',
      attendancePercentage: Number(attendancePercentage),
      averageInternalPercentage: Number(averageInternalPercentage),
      missingAssignments: Number(missingAssignments),
      consecutiveAbsences: Number(consecutiveAbsences),
      riskScore,
      riskStatus,
      lastCalculatedAt: new Date()
    });

    // Create default course attendance & academic records so the new student has courses
    const defaultCourses = [
      { code: 'CS401', name: 'Full Stack Development 2' },
      { code: 'CS402', name: 'Database Management Systems' },
      { code: 'CS403', name: 'Design and Analysis of Algorithms' },
      { code: 'CS404', name: 'Computer Networks' }
    ];

    for (const c of defaultCourses) {
      const total = 30;
      let attended = Math.round((Number(attendancePercentage) / 100) * total);
      if (attended > total) attended = total;
      if (attended < 0) attended = 0;

      await Attendance.create({
        student: student._id,
        courseCode: c.code,
        courseName: c.name,
        totalClasses: total,
        attendedClasses: attended,
        consecutiveAbsences: Number(consecutiveAbsences) > 0 ? 1 : 0
      });

      const maxMarks = 50;
      const marks = Math.round((Number(averageInternalPercentage) / 100) * maxMarks);
      await AcademicRecord.create({
        student: student._id,
        courseCode: c.code,
        courseName: c.name,
        internalMarks: marks,
        maxInternalMarks: maxMarks,
        totalAssignments: 5,
        submittedAssignments: Math.max(0, 5 - Number(missingAssignments))
      });
    }

    // Auto-generate alerts if needed
    if (recommendedAlerts.length > 0) {
      await syncStudentAlerts(student._id, recommendedAlerts, student.mentor);
    }

    res.status(201).json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update student metrics and recalculate risk
// @route   PUT /api/students/:id/metrics
// @access  Private (Admin / Faculty)
const updateStudentMetrics = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const {
      attendancePercentage = student.attendancePercentage,
      averageInternalPercentage = student.averageInternalPercentage,
      missingAssignments = student.missingAssignments,
      consecutiveAbsences = student.consecutiveAbsences,
      cgpa = student.cgpa
    } = req.body;

    const thresholds = await getActiveThresholds();
    const { riskScore, riskStatus, recommendedAlerts } = calculateRiskScore({
      attendancePercentage: Number(attendancePercentage),
      averageInternalPercentage: Number(averageInternalPercentage),
      missingAssignments: Number(missingAssignments),
      consecutiveAbsences: Number(consecutiveAbsences)
    }, thresholds);

    student.attendancePercentage = Number(attendancePercentage);
    student.averageInternalPercentage = Number(averageInternalPercentage);
    student.missingAssignments = Number(missingAssignments);
    student.consecutiveAbsences = Number(consecutiveAbsences);
    student.cgpa = Number(cgpa);
    student.riskScore = riskScore;
    student.riskStatus = riskStatus;
    student.lastCalculatedAt = new Date();

    await student.save();

    // Auto-sync alerts
    if (recommendedAlerts.length > 0) {
      await syncStudentAlerts(student._id, recommendedAlerts, student.mentor);
    }

    res.json({ success: true, data: student, message: 'Metrics updated and risk recalculated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Batch recalculate risk scores for all students
// @route   POST /api/students/recalculate-all
// @access  Private (Admin / Faculty)
const recalculateAll = async (req, res) => {
  try {
    const students = await Student.find({});
    const thresholds = await getActiveThresholds();
    let updatedCount = 0;

    for (const student of students) {
      const { riskScore, riskStatus, recommendedAlerts } = calculateRiskScore({
        attendancePercentage: student.attendancePercentage,
        averageInternalPercentage: student.averageInternalPercentage,
        missingAssignments: student.missingAssignments,
        consecutiveAbsences: student.consecutiveAbsences
      }, thresholds);

      student.riskScore = riskScore;
      student.riskStatus = riskStatus;
      student.lastCalculatedAt = new Date();
      await student.save();

      if (recommendedAlerts.length > 0) {
        await syncStudentAlerts(student._id, recommendedAlerts, student.mentor);
      }
      updatedCount++;
    }

    res.json({ success: true, message: `Successfully recalculated risk metrics for ${updatedCount} students` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Student requests guidance or counseling session from their assigned faculty mentor
// @route   POST /api/students/request-guidance
// @access  Private (Student)
const requestFacultyGuidance = async (req, res) => {
  try {
    const { actionType, discussionNotes, urgency } = req.body;

    let student = null;
    if (req.user.studentRef) {
      student = await Student.findById(req.user.studentRef);
    }
    if (!student) {
      student = await Student.findOne({ email: req.user.email });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not linked to user' });
    }

    // Determine counselor: student's assigned mentor or default faculty
    let counselorId = student.mentor;
    if (!counselorId) {
      const faculty = await User.findOne({ role: 'faculty', status: 'active' });
      counselorId = faculty ? faculty._id : null;
    }

    if (!counselorId) {
      return res.status(400).json({ success: false, message: 'No faculty mentor available in your department.' });
    }

    const intervention = await Intervention.create({
      student: student._id,
      counselor: counselorId,
      actionType: actionType || 'ONE_ON_ONE_COUNSELING',
      scheduledDate: new Date(),
      discussionNotes: `Student Guidance Request: ${discussionNotes || 'Student requested appointment with assigned faculty mentor.'}`,
      actionItems: 'Awaiting faculty review & meeting slot confirmation.',
      status: 'SCHEDULED',
      preInterventionRisk: student.riskScore,
      outcome: `Guidance request submitted by student on ${new Date().toLocaleDateString()}.`
    });

    // If urgency is HIGH or CRITICAL, also raise an Alert so the faculty gets a notification
    if (urgency === 'HIGH' || urgency === 'CRITICAL') {
      await Alert.create({
        student: student._id,
        mentor: counselorId,
        assignedTo: counselorId,
        raisedBy: req.user._id,
        raisedByRole: 'STUDENT',
        triggerType: 'MANUAL_FACULTY_FLAG',
        severity: urgency,
        title: `Urgent Student Guidance Request from ${student.name}`,
        description: discussionNotes || 'Student requested high-priority guidance from assigned faculty.',
        status: 'OPEN'
      });
    }

    res.status(201).json({
      success: true,
      data: intervention,
      message: 'Your guidance request has been sent to your assigned Faculty Mentor.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a student and related records
// @route   DELETE /api/students/:id
// @access  Private (Admin)
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Attendance.deleteMany({ student: student._id });
    await AcademicRecord.deleteMany({ student: student._id });
    await Alert.deleteMany({ student: student._id });
    await Intervention.deleteMany({ student: student._id });
    await student.deleteOne();

    res.json({ success: true, message: 'Student and related records deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudentMetrics,
  recalculateAll,
  requestFacultyGuidance,
  deleteStudent
};
