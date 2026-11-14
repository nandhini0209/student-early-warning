const Alert = require('../models/Alert');
const Student = require('../models/Student');

// @desc    Get all alerts
// @route   GET /api/alerts
// @access  Private
const getAlerts = async (req, res) => {
  try {
    const { status, severity, studentId } = req.query;
    let query = {};

    if (status && status !== 'All') {
      query.status = status;
    }
    if (severity && severity !== 'All') {
      query.severity = severity;
    }

    // Role-based isolation: Students strictly only view their own alerts
    if (req.user && req.user.role === 'student') {
      let ownStudentId = req.user.studentRef;
      if (!ownStudentId) {
        const s = await Student.findOne({ email: req.user.email });
        ownStudentId = s ? s._id : null;
      }
      query.student = ownStudentId;
    } else if (studentId) {
      query.student = studentId;
    }

    const alerts = await Alert.find(query)
      .populate('student', 'name rollNo department riskStatus riskScore attendancePercentage')
      .populate('assignedTo', 'name email role')
      .populate('raisedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manually raise an alert for a student
// @route   POST /api/alerts
// @access  Private (Faculty / Advisor / Admin)
const createAlert = async (req, res) => {
  try {
    const { studentId, triggerType, severity, title, description, assignedTo } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const alert = await Alert.create({
      student: studentId,
      raisedBy: req.user ? req.user._id : null,
      raisedByRole: req.user ? req.user.role.toUpperCase() : 'FACULTY',
      triggerType: triggerType || 'MANUAL_FACULTY_FLAG',
      severity: severity || 'HIGH',
      title,
      description,
      assignedTo: assignedTo || null,
      status: 'OPEN'
    });

    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update alert status / assign / resolve
// @route   PUT /api/alerts/:id
// @access  Private (Advisor / Faculty / Admin)
const updateAlertStatus = async (req, res) => {
  try {
    const { status, assignedTo, resolutionNotes } = req.body;
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    if (status) alert.status = status;
    if (assignedTo) alert.assignedTo = assignedTo;
    if (resolutionNotes) alert.resolutionNotes = resolutionNotes;
    if (status === 'RESOLVED') alert.resolvedAt = new Date();

    await alert.save();
    const updatedAlert = await Alert.findById(alert._id)
      .populate('student', 'name rollNo department riskStatus')
      .populate('assignedTo', 'name email');

    res.json({ success: true, data: updatedAlert, message: 'Alert updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAlerts,
  createAlert,
  updateAlertStatus
};
