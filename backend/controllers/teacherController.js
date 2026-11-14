const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AcademicRecord = require('../models/AcademicRecord');
const Alert = require('../models/Alert');
const Intervention = require('../models/Intervention');
const Subject = require('../models/Subject');
const { calculateRiskScore, syncStudentAlerts, getActiveThresholds } = require('../utils/riskEngine');

// 1. TEACHER / MENTOR DASHBOARD
const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user._id;

    // Students mentored by this teacher
    const assignedStudents = await Student.find({ mentor: teacherId });
    const assignedStudentIds = assignedStudents.map((s) => s._id);

    const totalAssigned = assignedStudents.length;
    const criticalMentees = assignedStudents.filter((s) => s.riskStatus === 'CRITICAL').length;
    const moderateMentees = assignedStudents.filter((s) => s.riskStatus === 'MODERATE').length;
    const safeMentees = assignedStudents.filter((s) => s.riskStatus === 'SAFE').length;

    // Alerts for assigned mentees
    const activeAlerts = await Alert.find({
      student: { $in: assignedStudentIds },
      status: { $in: ['OPEN', 'IN_PROGRESS'] }
    })
      .populate('student', 'name rollNo department riskStatus attendancePercentage')
      .sort({ createdAt: -1 });

    // Pending Interventions & Scheduled Follow-ups
    const pendingFollowUps = await Intervention.find({
      counselor: teacherId,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }
    })
      .populate('student', 'name rollNo riskStatus')
      .sort({ followUpDate: 1, scheduledDate: 1 });

    // Subjects taught by this teacher
    const subjectsTaught = await Subject.find({ assignedTeacher: teacherId })
      .populate('department', 'name code');

    // Mentee cohort average metrics
    let avgAttendance = 0;
    let avgInternals = 0;
    if (totalAssigned > 0) {
      const sumAtt = assignedStudents.reduce((acc, s) => acc + s.attendancePercentage, 0);
      const sumMarks = assignedStudents.reduce((acc, s) => acc + s.averageInternalPercentage, 0);
      avgAttendance = Number((sumAtt / totalAssigned).toFixed(1));
      avgInternals = Number((sumMarks / totalAssigned).toFixed(1));
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalAssigned,
          criticalMentees,
          moderateMentees,
          safeMentees,
          activeAlertsCount: activeAlerts.length,
          pendingFollowUpsCount: pendingFollowUps.length,
          avgAttendance,
          avgInternals
        },
        subjectsTaught,
        activeAlerts: activeAlerts.slice(0, 5),
        pendingFollowUps: pendingFollowUps.slice(0, 5)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. VIEW ASSIGNED STUDENTS (Search & Filter)
const getMyStudents = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { search, riskStatus, semester, filterAll } = req.query;

    let query = {};
    // If teacher wants to see only their assigned mentees, or all students if filterAll === 'true'
    if (filterAll !== 'true') {
      query.mentor = teacherId;
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
        { rollNo: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await Student.find(query)
      .populate('mentor', 'name email')
      .sort({ riskScore: -1, attendancePercentage: 1 });

    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. ENTER / UPDATE MARKS & ATTENDANCE & RECORD ASSIGNMENT PERFORMANCE
const updateStudentRecords = async (req, res) => {
  try {
    const { studentId } = req.params;
    const {
      courseCode,
      courseName,
      attendedClasses,
      totalClasses,
      consecutiveAbsences,
      internalMarks,
      maxInternalMarks,
      submittedAssignments,
      totalAssignments,
      remarks
    } = req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // 1. Update or create Attendance record
    if (courseCode) {
      let attRecord = await Attendance.findOne({ student: studentId, courseCode });
      if (!attRecord) {
        attRecord = new Attendance({
          student: studentId,
          courseCode,
          courseName: courseName || courseCode,
          totalClasses: Number(totalClasses) || 30,
          attendedClasses: Number(attendedClasses) || 0
        });
      } else {
        if (totalClasses !== undefined) attRecord.totalClasses = Number(totalClasses);
        if (attendedClasses !== undefined) attRecord.attendedClasses = Number(attendedClasses);
        if (consecutiveAbsences !== undefined) attRecord.consecutiveAbsences = Number(consecutiveAbsences);
      }
      attRecord.lastUpdated = new Date();
      await attRecord.save();

      // 2. Update or create Academic Record
      let acadRecord = await AcademicRecord.findOne({ student: studentId, courseCode });
      if (!acadRecord) {
        acadRecord = new AcademicRecord({
          student: studentId,
          courseCode,
          courseName: courseName || courseCode,
          internalMarks: Number(internalMarks) || 0,
          maxInternalMarks: Number(maxInternalMarks) || 50,
          submittedAssignments: Number(submittedAssignments) || 5,
          totalAssignments: Number(totalAssignments) || 5,
          remarks: remarks || ''
        });
      } else {
        if (internalMarks !== undefined) acadRecord.internalMarks = Number(internalMarks);
        if (maxInternalMarks !== undefined) acadRecord.maxInternalMarks = Number(maxInternalMarks);
        if (submittedAssignments !== undefined) acadRecord.submittedAssignments = Number(submittedAssignments);
        if (totalAssignments !== undefined) acadRecord.totalAssignments = Number(totalAssignments);
        if (remarks) acadRecord.remarks = remarks;
      }
      await acadRecord.save();
    }

    // 3. Aggregate all courses for student to recalculate overall metrics
    const allAttendance = await Attendance.find({ student: studentId });
    const allAcademics = await AcademicRecord.find({ student: studentId });

    let aggregateAttendance = 100;
    if (allAttendance.length > 0) {
      const totalAttended = allAttendance.reduce((acc, a) => acc + a.attendedClasses, 0);
      const totalPossible = allAttendance.reduce((acc, a) => acc + a.totalClasses, 0);
      aggregateAttendance = totalPossible > 0 ? Number(((totalAttended / totalPossible) * 100).toFixed(1)) : 100;
    }

    let aggregateInternals = 80;
    let missingAssignmentsCount = 0;
    if (allAcademics.length > 0) {
      let sumPct = 0;
      for (const rec of allAcademics) {
        const pct = rec.maxInternalMarks > 0 ? (rec.internalMarks / rec.maxInternalMarks) * 100 : 0;
        sumPct += pct;
        missingAssignmentsCount += Math.max(0, rec.totalAssignments - rec.submittedAssignments);
      }
      aggregateInternals = Number((sumPct / allAcademics.length).toFixed(1));
    }

    // Determine performance trend (Improving vs Declining)
    const previousRisk = student.riskScore;
    const thresholds = await getActiveThresholds();
    const { riskScore, riskStatus, recommendedAlerts } = calculateRiskScore({
      attendancePercentage: aggregateAttendance,
      averageInternalPercentage: aggregateInternals,
      missingAssignments: missingAssignmentsCount,
      consecutiveAbsences: Number(consecutiveAbsences) || student.consecutiveAbsences
    }, thresholds);

    if (riskScore < previousRisk - 5) {
      student.performanceTrend = 'IMPROVING';
    } else if (riskScore > previousRisk + 5) {
      student.performanceTrend = 'DECLINING';
    } else {
      student.performanceTrend = 'STABLE';
    }

    student.attendancePercentage = aggregateAttendance;
    student.averageInternalPercentage = aggregateInternals;
    student.missingAssignments = missingAssignmentsCount;
    if (consecutiveAbsences !== undefined) student.consecutiveAbsences = Number(consecutiveAbsences);
    student.riskScore = riskScore;
    student.riskStatus = riskStatus;
    student.lastCalculatedAt = new Date();
    await student.save();

    // Auto-sync alerts
    if (recommendedAlerts.length > 0) {
      await syncStudentAlerts(student._id, recommendedAlerts, student.mentor);
    }

    res.json({
      success: true,
      data: student,
      message: 'Student marks, attendance, and assignment metrics recorded. Risk score updated.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. PERFORMANCE TRENDS & HISTORY
const getStudentPerformanceTrends = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const attendanceRecords = await Attendance.find({ student: studentId });
    const academicRecords = await AcademicRecord.find({ student: studentId });
    const alerts = await Alert.find({ student: studentId }).sort({ createdAt: -1 });
    const interventions = await Intervention.find({ student: studentId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        student,
        trend: student.performanceTrend,
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

// 5. RECEIVE ALERTS FOR ASSIGNED STUDENTS WITH DETAILED REASONS
const getTeacherAlerts = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const assignedStudents = await Student.find({ mentor: teacherId }).select('_id');
    const assignedStudentIds = assignedStudents.map((s) => s._id);

    const alerts = await Alert.find({
      student: { $in: assignedStudentIds }
    })
      .populate('student', 'name rollNo department riskStatus riskScore attendancePercentage averageInternalPercentage missingAssignments consecutiveAbsences')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. GUIDANCE & INTERVENTIONS: ADD NOTES, SCHEDULE FOLLOW-UP, MARK COMPLETE, MONITOR IMPROVEMENT
const logGuidanceIntervention = async (req, res) => {
  try {
    const {
      studentId,
      alertId,
      actionType,
      discussionNotes,
      actionItems,
      followUpDate
    } = req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const intervention = await Intervention.create({
      student: studentId,
      alert: alertId || null,
      counselor: req.user._id,
      actionType: actionType || 'ONE_ON_ONE_COUNSELING',
      discussionNotes,
      actionItems,
      scheduledDate: new Date(),
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      status: 'SCHEDULED',
      preInterventionRisk: student.riskScore
    });

    if (alertId) {
      await Alert.findByIdAndUpdate(alertId, {
        status: 'IN_PROGRESS',
        assignedTo: req.user._id
      });
    }

    res.status(201).json({ success: true, data: intervention, message: 'Guidance session logged & follow-up scheduled.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const completeIntervention = async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, followUpNotes, studentFeedback } = req.body;

    const intervention = await Intervention.findById(id).populate('student');
    if (!intervention) return res.status(404).json({ success: false, message: 'Intervention not found' });

    intervention.status = 'COMPLETED';
    intervention.outcome = outcome || 'Counseling completed. Student agreed on recovery milestones.';
    if (followUpNotes) intervention.followUpNotes = followUpNotes;
    if (studentFeedback) intervention.studentFeedback = studentFeedback;

    // Monitor student improvement: compare current risk with preInterventionRisk
    if (intervention.student) {
      const currentRisk = intervention.student.riskScore;
      intervention.postInterventionRisk = currentRisk;

      if (currentRisk < intervention.preInterventionRisk - 5) {
        intervention.improvementStatus = 'IMPROVED';
      } else if (currentRisk > intervention.preInterventionRisk + 5) {
        intervention.improvementStatus = 'DECLINING';
      } else {
        intervention.improvementStatus = 'STABLE';
      }
    }

    await intervention.save();

    // If linked to an alert, mark alert as resolved
    if (intervention.alert) {
      await Alert.findByIdAndUpdate(intervention.alert, {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: intervention.outcome
      });
    }

    res.json({
      success: true,
      data: intervention,
      message: 'Intervention marked as completed. Improvement metric recorded.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getInterventionHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const history = await Intervention.find({ student: studentId })
      .populate('counselor', 'name email role')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTeacherDashboard,
  getMyStudents,
  updateStudentRecords,
  getStudentPerformanceTrends,
  getTeacherAlerts,
  logGuidanceIntervention,
  completeIntervention,
  getInterventionHistory
};
