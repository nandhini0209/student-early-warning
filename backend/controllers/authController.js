const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const AcademicRecord = require('../models/AcademicRecord');
const Intervention = require('../models/Intervention');
const { calculateRiskScore, getActiveThresholds } = require('../utils/riskEngine');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'early_alert_jwt_secret_key_fsd2_2026', {
    expiresIn: '7d'
  });
};

// Helper to assign a faculty mentor for a student
const findFacultyMentor = async (department) => {
  let mentor = await User.findOne({
    role: { $in: ['faculty', 'advisor'] },
    department: new RegExp(department || 'Computer Science', 'i'),
    status: 'active'
  });
  if (!mentor) {
    mentor = await User.findOne({ role: { $in: ['faculty', 'advisor'] }, status: 'active' });
  }
  return mentor;
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, password, department, semester, section } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    // Prevent privilege escalation: Admin accounts CANNOT be created via public self-registration
    if (req.body.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Security Policy: Administrator accounts cannot be registered publicly. Please contact the Institution Dean.'
      });
    }

    const allowedRoles = ['faculty', 'advisor', 'student'];
    const role = allowedRoles.includes(req.body.role) ? req.body.role : 'student';

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    let studentRef = null;

    // If registering as a student, automatically link or create their Student academic profile
    if (role === 'student') {
      let student = await Student.findOne({ email });
      if (!student) {
        student = await Student.findOne({ name: new RegExp('^' + name.trim() + '$', 'i') });
      }

      if (!student) {
        const count = await Student.countDocuments();
        const rollNo = `21CS${String(count + 1).padStart(3, '0')}`;
        const thresholds = await getActiveThresholds();
        const { riskScore, riskStatus } = calculateRiskScore({
          attendancePercentage: 88.0,
          averageInternalPercentage: 80.0,
          missingAssignments: 0,
          consecutiveAbsences: 0
        }, thresholds);

        // Intelligently assign an active faculty mentor
        const mentorUser = await findFacultyMentor(department);

        student = await Student.create({
          rollNo,
          name: name.trim(),
          email: email.trim(),
          department: department || 'Computer Science',
          semester: Number(semester) || 4,
          section: section || 'A',
          mentor: mentorUser ? mentorUser._id : null,
          attendancePercentage: 88.0,
          averageInternalPercentage: 80.0,
          riskScore,
          riskStatus,
          status: 'active'
        });

        // Initialize default courses for the new student
        const defaultCourses = [
          { code: 'CS401', name: 'Full Stack Development 2' },
          { code: 'CS402', name: 'Database Management Systems' },
          { code: 'CS403', name: 'Design and Analysis of Algorithms' },
          { code: 'CS404', name: 'Computer Networks' }
        ];

        for (const c of defaultCourses) {
          await Attendance.create({
            student: student._id,
            courseCode: c.code,
            courseName: c.name,
            totalClasses: 30,
            attendedClasses: 27
          });

          await AcademicRecord.create({
            student: student._id,
            courseCode: c.code,
            courseName: c.name,
            internalMarks: 40,
            maxInternalMarks: 50,
            submittedAssignments: 5,
            totalAssignments: 5
          });
        }

        // Create an official onboarding guidance record so student immediately sees who their mentor is!
        if (mentorUser) {
          await Intervention.create({
            student: student._id,
            counselor: mentorUser._id,
            actionType: 'ONE_ON_ONE_COUNSELING',
            scheduledDate: new Date(),
            discussionNotes: `Welcome to the Student Early Alert & Retention System! ${mentorUser.name} has been assigned as your Faculty Mentor. Your initial attendance and internal marks baseline has been registered.`,
            actionItems: '1. Maintain minimum 75% attendance floor\n2. Review continuous evaluation schedule\n3. Connect with faculty mentor during office hours for semester guidance',
            status: 'IN_PROGRESS',
            preInterventionRisk: student.riskScore,
            outcome: `Faculty mentor ${mentorUser.name} assigned upon student registration.`
          });
        }
      }

      studentRef = student._id;
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      department: department || 'Computer Science',
      studentRef
    });

    const populatedUser = await User.findById(user._id).populate({
      path: 'studentRef',
      populate: { path: 'mentor', select: 'name email department role' }
    });

    res.status(201).json({
      success: true,
      data: {
        _id: populatedUser._id,
        name: populatedUser.name,
        email: populatedUser.email,
        role: populatedUser.role,
        department: populatedUser.department,
        studentRef: populatedUser.studentRef,
        token: generateToken(populatedUser._id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    let user = await User.findOne({ email })
      .populate({
        path: 'studentRef',
        populate: { path: 'mentor', select: 'name email department role' }
      })
      .populate('assignedSubjects');

    if (!user) {
      console.warn(`[Login failed] no account found for "${email}" - is the database seeded? (npm run seed)`);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact the institutional administrator.'
      });
    }

    if (await user.matchPassword(password)) {
      // If student user is not linked to a Student profile yet, automatically link or create it
      if (user.role === 'student') {
        if (!user.studentRef) {
          let student = await Student.findOne({ email: user.email });
          if (!student) {
            student = await Student.findOne({ name: new RegExp('^' + user.name.trim() + '$', 'i') });
          }

          if (!student) {
            const count = await Student.countDocuments();
            const rollNo = `21CS${String(count + 1).padStart(3, '0')}`;
            const mentorUser = await findFacultyMentor(user.department);

            student = await Student.create({
              rollNo,
              name: user.name,
              email: user.email,
              department: user.department || 'Computer Science',
              semester: 4,
              section: 'A',
              mentor: mentorUser ? mentorUser._id : null,
              attendancePercentage: 88.0,
              averageInternalPercentage: 80.0,
              riskScore: 10,
              riskStatus: 'SAFE',
              status: 'active'
            });

            const defaultCourses = [
              { code: 'CS401', name: 'Full Stack Development 2' },
              { code: 'CS402', name: 'Database Management Systems' },
              { code: 'CS403', name: 'Design and Analysis of Algorithms' },
              { code: 'CS404', name: 'Computer Networks' }
            ];

            for (const c of defaultCourses) {
              await Attendance.create({
                student: student._id,
                courseCode: c.code,
                courseName: c.name,
                totalClasses: 30,
                attendedClasses: 27
              });
              await AcademicRecord.create({
                student: student._id,
                courseCode: c.code,
                courseName: c.name,
                internalMarks: 40,
                maxInternalMarks: 50,
                submittedAssignments: 5,
                totalAssignments: 5
              });
            }

            if (mentorUser) {
              await Intervention.create({
                student: student._id,
                counselor: mentorUser._id,
                actionType: 'ONE_ON_ONE_COUNSELING',
                scheduledDate: new Date(),
                discussionNotes: `Faculty mentor ${mentorUser.name} assigned to student ${user.name}.`,
                actionItems: '1. Review semester study materials\n2. Maintain consistent attendance',
                status: 'IN_PROGRESS',
                preInterventionRisk: student.riskScore
              });
            }
          }

          user.studentRef = student._id;
          await user.save();
        } else if (user.studentRef && !user.studentRef.mentor) {
          // If student has a profile but no mentor assigned, assign one now
          const mentorUser = await findFacultyMentor(user.department);
          if (mentorUser) {
            await Student.findByIdAndUpdate(user.studentRef._id || user.studentRef, { mentor: mentorUser._id });
          }
        }

        user = await User.findById(user._id)
          .populate({
            path: 'studentRef',
            populate: { path: 'mentor', select: 'name email department role' }
          })
          .populate('assignedSubjects');
      }

      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          status: user.status,
          studentRef: user.studentRef,
          assignedSubjects: user.assignedSubjects,
          token: generateToken(user._id)
        }
      });
    } else {
      console.warn(`[Login failed] wrong password for "${email}" (role: ${user.role}).`);
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    let user = await User.findById(req.user._id)
      .populate({
        path: 'studentRef',
        populate: { path: 'mentor', select: 'name email department role' }
      });

    if (user && user.role === 'student' && !user.studentRef) {
      let student = await Student.findOne({ email: user.email });
      if (!student) {
        student = await Student.findOne({ name: new RegExp('^' + user.name.trim() + '$', 'i') });
      }
      if (student) {
        user.studentRef = student._id;
        await user.save();
        user = await User.findById(req.user._id)
          .populate({
            path: 'studentRef',
            populate: { path: 'mentor', select: 'name email department role' }
          });
      }
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { registerUser, loginUser, getMe };
