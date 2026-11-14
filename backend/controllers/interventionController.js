const Intervention = require('../models/Intervention');
const Alert = require('../models/Alert');
const Student = require('../models/Student');

// @desc    Get all interventions
// @route   GET /api/interventions
// @access  Private (Role-isolated)
const getInterventions = async (req, res) => {
  try {
    const { status, studentId } = req.query;
    let query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    // Role-based isolation: Students strictly only view their own guidance sessions
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

    const interventions = await Intervention.find(query)
      .populate('student', 'name rollNo department riskStatus riskScore')
      .populate('counselor', 'name email role department')
      .populate('alert', 'title triggerType severity status')
      .sort({ scheduledDate: -1 });

    res.json({ success: true, count: interventions.length, data: interventions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Schedule / Log a new intervention
// @route   POST /api/interventions
// @access  Private (Advisor / Faculty / Admin)
const createIntervention = async (req, res) => {
  try {
    const { studentId, alertId, actionType, scheduledDate, discussionNotes, actionItems } = req.body;

    const intervention = await Intervention.create({
      student: studentId,
      alert: alertId || null,
      counselor: req.user ? req.user._id : req.body.counselorId,
      actionType,
      scheduledDate: scheduledDate || new Date(),
      discussionNotes: discussionNotes || '',
      actionItems: actionItems || '',
      status: 'SCHEDULED'
    });

    // If linked to an alert, set alert status to IN_PROGRESS
    if (alertId) {
      await Alert.findByIdAndUpdate(alertId, {
        status: 'IN_PROGRESS',
        assignedTo: req.user ? req.user._id : undefined
      });
    }

    res.status(201).json({ success: true, data: intervention });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update intervention details or outcome
// @route   PUT /api/interventions/:id
// @access  Private (Advisor / Faculty / Admin)
const updateIntervention = async (req, res) => {
  try {
    const { status, discussionNotes, actionItems, outcome } = req.body;
    const intervention = await Intervention.findById(req.params.id);

    if (!intervention) {
      return res.status(404).json({ success: false, message: 'Intervention not found' });
    }

    if (status) intervention.status = status;
    if (discussionNotes) intervention.discussionNotes = discussionNotes;
    if (actionItems) intervention.actionItems = actionItems;
    if (outcome) intervention.outcome = outcome;

    await intervention.save();

    // If marked as COMPLETED and has an associated alert, offer closing alert
    if (status === 'COMPLETED' && intervention.alert) {
      await Alert.findByIdAndUpdate(intervention.alert, {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: `Intervention completed: ${outcome || 'Action items agreed with student.'}`
      });
    }

    res.json({ success: true, data: intervention, message: 'Intervention updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getInterventions,
  createIntervention,
  updateIntervention
};
