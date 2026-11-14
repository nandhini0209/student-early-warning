const Alert = require('../models/Alert');
const ThresholdConfig = require('../models/ThresholdConfig');

// Default fallback configuration
const DEFAULT_THRESHOLDS = {
  attendanceWarning: 75,
  attendanceCritical: 65,
  marksWarning: 55,
  marksCritical: 40,
  consecutiveAbsenceLimit: 3,
  missingAssignmentLimit: 2
};

/**
 * Loads active thresholds from DB or returns defaults
 */
async function getActiveThresholds() {
  try {
    const config = await ThresholdConfig.findOne().sort({ updatedAt: -1 });
    if (config) {
      return {
        attendanceWarning: config.attendanceWarning,
        attendanceCritical: config.attendanceCritical,
        marksWarning: config.marksWarning,
        marksCritical: config.marksCritical,
        consecutiveAbsenceLimit: config.consecutiveAbsenceLimit,
        missingAssignmentLimit: config.missingAssignmentLimit
      };
    }
  } catch (err) {
    console.warn('[ThresholdConfig] Using default thresholds:', err.message);
  }
  return DEFAULT_THRESHOLDS;
}

/**
 * Calculates the early warning composite risk score for a student.
 */
function calculateRiskScore({
  attendancePercentage = 100,
  averageInternalPercentage = 100,
  missingAssignments = 0,
  totalAssignments = 5,
  consecutiveAbsences = 0
}, customThresholds = null) {
  const thresholds = customThresholds || DEFAULT_THRESHOLDS;

  // 1. Attendance Penalty (0 - 100)
  let attendancePenalty = 0;
  if (attendancePercentage < thresholds.attendanceCritical) {
    attendancePenalty = Math.min(100, 60 + (thresholds.attendanceCritical - attendancePercentage) * 2.5);
  } else if (attendancePercentage < thresholds.attendanceWarning) {
    attendancePenalty = 30 + (thresholds.attendanceWarning - attendancePercentage) * 3.0;
  } else if (attendancePercentage < 85) {
    attendancePenalty = (85 - attendancePercentage) * 1.5;
  }

  // 2. Academic Performance Penalty (0 - 100)
  let academicPenalty = 0;
  if (averageInternalPercentage < thresholds.marksCritical) {
    academicPenalty = Math.min(100, 60 + (thresholds.marksCritical - averageInternalPercentage) * 2.5);
  } else if (averageInternalPercentage < thresholds.marksWarning) {
    academicPenalty = 25 + (thresholds.marksWarning - averageInternalPercentage) * 2.0;
  }

  // 3. Assignment Submission Penalty (0 - 100)
  let assignmentPenalty = 0;
  if (totalAssignments > 0) {
    const missingRatio = Math.min(1, missingAssignments / totalAssignments);
    assignmentPenalty = missingRatio * 100;
  }

  // 4. Consecutive Absences Penalty (0 - 100)
  let absencePenalty = 0;
  if (consecutiveAbsences >= thresholds.consecutiveAbsenceLimit + 1) {
    absencePenalty = 100;
  } else if (consecutiveAbsences >= thresholds.consecutiveAbsenceLimit) {
    absencePenalty = 70;
  } else if (consecutiveAbsences >= 2) {
    absencePenalty = 40;
  }

  // Composite Weighted Risk Calculation (0 - 100)
  const compositeScore = Math.round(
    0.40 * attendancePenalty +
    0.35 * academicPenalty +
    0.15 * assignmentPenalty +
    0.10 * absencePenalty
  );

  // Determine Categorical Status
  let riskStatus = 'SAFE';
  if (
    compositeScore >= 60 ||
    attendancePercentage < thresholds.attendanceCritical ||
    averageInternalPercentage < thresholds.marksCritical
  ) {
    riskStatus = 'CRITICAL';
  } else if (
    compositeScore >= 35 ||
    attendancePercentage < thresholds.attendanceWarning ||
    missingAssignments >= thresholds.missingAssignmentLimit
  ) {
    riskStatus = 'MODERATE';
  }

  // Recommended Automated Alerts to trigger with explicit root causes
  const recommendedAlerts = [];
  if (attendancePercentage < thresholds.attendanceCritical) {
    recommendedAlerts.push({
      triggerType: 'ATTENDANCE_CRITICAL',
      severity: 'CRITICAL',
      title: `Critical Attendance Deficit (${attendancePercentage.toFixed(1)}%)`,
      description: `Student attendance is critically low at ${attendancePercentage.toFixed(1)}% (below institutional floor of ${thresholds.attendanceCritical}%). High risk of exam debarment.`
    });
  } else if (attendancePercentage < thresholds.attendanceWarning) {
    recommendedAlerts.push({
      triggerType: 'ATTENDANCE_CRITICAL',
      severity: 'HIGH',
      title: `Low Attendance Warning (${attendancePercentage.toFixed(1)}%)`,
      description: `Student attendance has dropped to ${attendancePercentage.toFixed(1)}%, falling below the mandatory ${thresholds.attendanceWarning}% requirement.`
    });
  }

  if (averageInternalPercentage < thresholds.marksCritical) {
    recommendedAlerts.push({
      triggerType: 'POOR_INTERNAL_MARKS',
      severity: 'CRITICAL',
      title: `Critical Assessment Failure (${averageInternalPercentage.toFixed(1)}%)`,
      description: `Average internal examination mark is ${averageInternalPercentage.toFixed(1)}%, failing minimum institutional benchmark (${thresholds.marksCritical}%).`
    });
  } else if (averageInternalPercentage < thresholds.marksWarning) {
    recommendedAlerts.push({
      triggerType: 'POOR_INTERNAL_MARKS',
      severity: 'HIGH',
      title: `Sub-Par Academic Performance (${averageInternalPercentage.toFixed(1)}%)`,
      description: `Average continuous assessment is ${averageInternalPercentage.toFixed(1)}%, triggering early advisory warning.`
    });
  }

  if (consecutiveAbsences >= thresholds.consecutiveAbsenceLimit) {
    recommendedAlerts.push({
      triggerType: 'CONSECUTIVE_ABSENCE',
      severity: 'HIGH',
      title: `Chronic Consecutive Absences (${consecutiveAbsences} days)`,
      description: `Student has recorded ${consecutiveAbsences} continuous days of absence without prior mentor authorization.`
    });
  }

  if (missingAssignments >= thresholds.missingAssignmentLimit) {
    recommendedAlerts.push({
      triggerType: 'MISSING_ASSIGNMENTS',
      severity: 'MEDIUM',
      title: `Continuous Evaluation Backlog (${missingAssignments} missing)`,
      description: `Student has accumulated ${missingAssignments} overdue assignment submissions.`
    });
  }

  return {
    riskScore: Math.min(100, Math.max(0, compositeScore)),
    riskStatus,
    breakdown: {
      attendancePenalty: Math.round(attendancePenalty),
      academicPenalty: Math.round(academicPenalty),
      assignmentPenalty: Math.round(assignmentPenalty),
      absencePenalty: Math.round(absencePenalty)
    },
    recommendedAlerts
  };
}

/**
 * Auto syncs alerts for a student in MongoDB
 */
async function syncStudentAlerts(studentId, recommendedAlerts, mentorId = null) {
  for (const item of recommendedAlerts) {
    const existing = await Alert.findOne({
      student: studentId,
      triggerType: item.triggerType,
      status: { $in: ['OPEN', 'IN_PROGRESS'] }
    });

    if (!existing) {
      await Alert.create({
        student: studentId,
        mentor: mentorId,
        raisedByRole: 'SYSTEM',
        triggerType: item.triggerType,
        severity: item.severity,
        title: item.title,
        description: item.description,
        status: 'OPEN'
      });
    }
  }
}

module.exports = {
  calculateRiskScore,
  syncStudentAlerts,
  getActiveThresholds,
  DEFAULT_THRESHOLDS
};
