const User = require('../models/User');
const Student = require('../models/Student');
const Department = require('../models/Department');
const ClassRoom = require('../models/ClassRoom');
const Subject = require('../models/Subject');
const Alert = require('../models/Alert');
const Intervention = require('../models/Intervention');
const ThresholdConfig = require('../models/ThresholdConfig');
const AuditLog = require('../models/AuditLog');
const { calculateRiskScore, syncStudentAlerts, getActiveThresholds } = require('../utils/riskEngine');

// 1. INSTITUTION-WIDE ANALYTICS & DASHBOARD
const getAdminAnalytics = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const activeStudents = await Student.countDocuments({ status: 'active' });
    const totalTeachers = await User.countDocuments({ role: 'faculty' });
    const totalAdvisors = await User.countDocuments({ role: 'advisor' });
    const totalDepartments = await Department.countDocuments();
    const totalClasses = await ClassRoom.countDocuments();
    const totalSubjects = await Subject.countDocuments();

    const criticalCount = await Student.countDocuments({ riskStatus: 'CRITICAL' });
    const moderateCount = await Student.countDocuments({ riskStatus: 'MODERATE' });
    const safeCount = await Student.countDocuments({ riskStatus: 'SAFE' });

    const openAlerts = await Alert.countDocuments({ status: 'OPEN' });
    const inProgressAlerts = await Alert.countDocuments({ status: 'IN_PROGRESS' });
    const resolvedAlerts = await Alert.countDocuments({ status: 'RESOLVED' });

    const interventionsCount = await Intervention.countDocuments();
    const auditLogsCount = await AuditLog.countDocuments();

    // Department-wise risk breakdown
    const departmentRiskStats = await Student.aggregate([
      {
        $group: {
          _id: '$department',
          totalStudents: { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ['$riskStatus', 'CRITICAL'] }, 1, 0] } },
          moderate: { $sum: { $cond: [{ $eq: ['$riskStatus', 'MODERATE'] }, 1, 0] } },
          safe: { $sum: { $cond: [{ $eq: ['$riskStatus', 'SAFE'] }, 1, 0] } },
          avgAttendance: { $avg: '$attendancePercentage' },
          avgInternals: { $avg: '$averageInternalPercentage' }
        }
      },
      { $sort: { critical: -1 } }
    ]);

    // Teacher mentor caseload
    const teacherCaseload = await User.find({ role: { $in: ['faculty', 'advisor'] } })
      .select('name email role department status')
      .lean();

    for (const t of teacherCaseload) {
      t.assignedStudentCount = await Student.countDocuments({ mentor: t._id });
      t.criticalMentees = await Student.countDocuments({ mentor: t._id, riskStatus: 'CRITICAL' });
    }

    res.json({
      success: true,
      data: {
        counts: {
          totalStudents,
          activeStudents,
          totalTeachers,
          totalAdvisors,
          totalDepartments,
          totalClasses,
          totalSubjects,
          criticalCount,
          moderateCount,
          safeCount,
          openAlerts,
          inProgressAlerts,
          resolvedAlerts,
          interventionsCount,
          auditLogsCount
        },
        departmentRiskStats,
        teacherCaseload
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. TEACHER & USER MANAGEMENT
const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: { $in: ['faculty', 'advisor'] } })
      .populate('assignedSubjects', 'code name')
      .populate('departmentRef', 'name code')
      .select('-password')
      .sort({ name: 1 });
    res.json({ success: true, count: teachers.length, data: teachers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTeacher = async (req, res) => {
  try {
    const { name, email, password, role, department, departmentRef } = req.body;
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await User.create({
      name,
      email,
      password: password || 'Password@123',
      role: role || 'faculty',
      department: department || 'Computer Science',
      departmentRef: departmentRef || null,
      status: 'active'
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousStatus = user.status;
    user.status = status || (user.status === 'active' ? 'inactive' : 'active');
    await user.save();

    // Audit log account activation/deactivation
    await AuditLog.create({
      action: 'ACCOUNT_STATUS_CHANGE',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      entityType: 'User',
      fieldModified: 'status',
      oldValue: previousStatus,
      newValue: user.status,
      reason: reason || `Administrative status toggle to ${user.status}`
    });

    res.json({
      success: true,
      data: user,
      message: `Account status updated to ${user.status}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. DEPARTMENT MANAGEMENT
const getDepartments = async (req, res) => {
  try {
    const depts = await Department.find().populate('headOfDepartment', 'name email');
    res.json({ success: true, data: depts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const dept = await Department.create(req.body);
    res.status(201).json({ success: true, data: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. CLASS / SECTION MANAGEMENT
const getClasses = async (req, res) => {
  try {
    const classes = await ClassRoom.find()
      .populate('department', 'name code')
      .populate('classTeacher', 'name email');
    res.json({ success: true, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createClass = async (req, res) => {
  try {
    const newClass = await ClassRoom.create(req.body);
    res.status(201).json({ success: true, data: newClass });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. SUBJECT MANAGEMENT & TEACHER ASSIGNMENT
const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find()
      .populate('department', 'name code')
      .populate('assignedTeacher', 'name email');
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSubject = async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const assignSubjectTeacher = async (req, res) => {
  try {
    const { subjectId, teacherId } = req.body;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    subject.assignedTeacher = teacherId;
    await subject.save();

    // Link subject in teacher's assignedSubjects array
    await User.findByIdAndUpdate(teacherId, {
      $addToSet: { assignedSubjects: subjectId }
    });

    res.json({ success: true, data: subject, message: 'Teacher assigned to subject successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. STUDENT MENTOR ASSIGNMENT
const assignStudentMentor = async (req, res) => {
  try {
    const { studentIds, mentorId, reason } = req.body;
    if (!mentorId) return res.status(400).json({ success: false, message: 'Mentor ID is required' });

    const mentor = await User.findById(mentorId);
    if (!mentor) return res.status(404).json({ success: false, message: 'Mentor not found' });

    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];

    for (const sid of ids) {
      const student = await Student.findById(sid);
      if (student) {
        const oldMentor = student.mentor;
        student.mentor = mentorId;
        await student.save();

        await AuditLog.create({
          action: 'MENTOR_ASSIGNMENT',
          performedBy: req.user._id,
          performedByRole: req.user.role,
          targetStudent: student._id,
          entityType: 'Student',
          fieldModified: 'mentor',
          oldValue: oldMentor,
          newValue: mentorId,
          reason: reason || `Assigned to mentor ${mentor.name}`
        });
      }
    }

    res.json({ success: true, message: `Successfully assigned ${ids.length} student(s) to mentor ${mentor.name}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. CONFIGURABLE WARNING THRESHOLDS
const getThresholds = async (req, res) => {
  try {
    const thresholds = await getActiveThresholds();
    res.json({ success: true, data: thresholds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateThresholds = async (req, res) => {
  try {
    const {
      attendanceWarning,
      attendanceCritical,
      marksWarning,
      marksCritical,
      consecutiveAbsenceLimit,
      missingAssignmentLimit,
      reason
    } = req.body;

    const previous = await getActiveThresholds();

    const config = await ThresholdConfig.create({
      attendanceWarning: Number(attendanceWarning),
      attendanceCritical: Number(attendanceCritical),
      marksWarning: Number(marksWarning),
      marksCritical: Number(marksCritical),
      consecutiveAbsenceLimit: Number(consecutiveAbsenceLimit),
      missingAssignmentLimit: Number(missingAssignmentLimit),
      updatedBy: req.user._id
    });

    await AuditLog.create({
      action: 'THRESHOLD_CONFIG_CHANGE',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      entityType: 'ThresholdConfig',
      fieldModified: 'allThresholds',
      oldValue: previous,
      newValue: config,
      reason: reason || 'Institutional early warning threshold update'
    });

    res.json({ success: true, data: config, message: 'Institutional warning thresholds updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. MANDATORY AUDIT TRAIL ACADEMIC OVERRIDE
// Admin must NOT modify a student's academic records without an appropriate audit trail!
const overrideStudentAcademics = async (req, res) => {
  try {
    const { id } = req.params;
    const { attendancePercentage, averageInternalPercentage, reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Administrative policy violation: An explicit, documented audit reason is mandatory for modifying student academic records.'
      });
    }

    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const oldAttendance = student.attendancePercentage;
    const oldMarks = student.averageInternalPercentage;

    if (attendancePercentage !== undefined) student.attendancePercentage = Number(attendancePercentage);
    if (averageInternalPercentage !== undefined) student.averageInternalPercentage = Number(averageInternalPercentage);

    const thresholds = await getActiveThresholds();
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

    // RECORD FORMAL AUDIT LOG
    const log = await AuditLog.create({
      action: 'ACADEMIC_RECORD_OVERRIDE',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      targetStudent: student._id,
      entityType: 'Student',
      fieldModified: 'attendance & marks',
      oldValue: { attendancePercentage: oldAttendance, averageInternalPercentage: oldMarks },
      newValue: { attendancePercentage: student.attendancePercentage, averageInternalPercentage: student.averageInternalPercentage },
      reason: reason.trim()
    });

    res.json({
      success: true,
      data: student,
      auditLogId: log._id,
      message: 'Academic record overridden with formal audit trail verification'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. AUDIT LOGS RETRIEVAL
const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('performedBy', 'name email role')
      .populate('targetStudent', 'name rollNo department')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAdminAnalytics,
  getTeachers,
  createTeacher,
  toggleUserStatus,
  getDepartments,
  createDepartment,
  getClasses,
  createClass,
  getSubjects,
  createSubject,
  assignSubjectTeacher,
  assignStudentMentor,
  getThresholds,
  updateThresholds,
  overrideStudentAcademics,
  getAuditLogs
};
