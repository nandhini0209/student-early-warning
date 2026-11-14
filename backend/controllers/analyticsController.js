const Student = require('../models/Student');
const Alert = require('../models/Alert');
const Intervention = require('../models/Intervention');

// @desc    Get dashboard summary statistics & analytics
// @route   GET /api/analytics/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const criticalCount = await Student.countDocuments({ riskStatus: 'CRITICAL' });
    const moderateCount = await Student.countDocuments({ riskStatus: 'MODERATE' });
    const safeCount = await Student.countDocuments({ riskStatus: 'SAFE' });

    const openAlertsCount = await Alert.countDocuments({ status: 'OPEN' });
    const inProgressAlertsCount = await Alert.countDocuments({ status: 'IN_PROGRESS' });
    const resolvedAlertsCount = await Alert.countDocuments({ status: 'RESOLVED' });

    const scheduledInterventions = await Intervention.countDocuments({ status: 'SCHEDULED' });
    const completedInterventions = await Intervention.countDocuments({ status: 'COMPLETED' });

    // Aggregate average attendance & internal marks
    const averages = await Student.aggregate([
      {
        $group: {
          _id: null,
          avgAttendance: { $avg: '$attendancePercentage' },
          avgInternals: { $avg: '$averageInternalPercentage' },
          avgRiskScore: { $avg: '$riskScore' }
        }
      }
    ]);

    // Risk distribution by Department
    const departmentDistribution = await Student.aggregate([
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          critical: {
            $sum: { $cond: [{ $eq: ['$riskStatus', 'CRITICAL'] }, 1, 0] }
          },
          moderate: {
            $sum: { $cond: [{ $eq: ['$riskStatus', 'MODERATE'] }, 1, 0] }
          },
          safe: {
            $sum: { $cond: [{ $eq: ['$riskStatus', 'SAFE'] }, 1, 0] }
          },
          avgAttendance: { $avg: '$attendancePercentage' }
        }
      },
      { $sort: { critical: -1 } }
    ]);

    // Top recent critical alerts
    const recentAlerts = await Alert.find({ status: { $in: ['OPEN', 'IN_PROGRESS'] } })
      .populate('student', 'name rollNo department riskStatus riskScore')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents,
          criticalCount,
          moderateCount,
          safeCount,
          openAlertsCount,
          inProgressAlertsCount,
          resolvedAlertsCount,
          scheduledInterventions,
          completedInterventions,
          avgAttendance: averages.length ? Number(averages[0].avgAttendance.toFixed(1)) : 0,
          avgInternals: averages.length ? Number(averages[0].avgInternals.toFixed(1)) : 0,
          avgRiskScore: averages.length ? Number(averages[0].avgRiskScore.toFixed(1)) : 0
        },
        departmentDistribution,
        recentAlerts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats };
