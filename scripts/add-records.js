const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../backend/models/User');
const Student = require('../backend/models/Student');
const Department = require('../backend/models/Department');
const Attendance = require('../backend/models/Attendance');
const AcademicRecord = require('../backend/models/AcademicRecord');
const { calculateRiskScore, syncStudentAlerts, getActiveThresholds } = require('../backend/utils/riskEngine');

const addRecords = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student_early_alert';
    await mongoose.connect(mongoUri);
    console.log(`[Connected for adding new records]: ${mongoUri}`);

    const deptCS = await Department.findOne({ code: 'CSE' });
    const deptIT = await Department.findOne({ code: 'IT' });

    // 1. Add New Teachers
    let teacherTuring = await User.findOne({ email: 'alan.turing@college.edu' });
    if (!teacherTuring) {
      teacherTuring = await User.create({
        name: 'Prof. Alan Turing',
        email: 'alan.turing@college.edu',
        password: 'Password@123',
        role: 'faculty',
        department: 'Computer Science',
        departmentRef: deptCS ? deptCS._id : null,
        status: 'active'
      });
      console.log('✅ Created New Teacher: Prof. Alan Turing');
    }

    let advisorHopper = await User.findOne({ email: 'grace.hopper@college.edu' });
    if (!advisorHopper) {
      advisorHopper = await User.create({
        name: 'Dr. Grace Hopper',
        email: 'grace.hopper@college.edu',
        password: 'Password@123',
        role: 'advisor',
        department: 'Information Technology',
        departmentRef: deptIT ? deptIT._id : null,
        status: 'active'
      });
      console.log('✅ Created New Advisor / Mentor: Dr. Grace Hopper');
    }

    // 2. Add New Students
    const newStudents = [
      {
        rollNo: '21CS105',
        name: 'Maya Verma',
        email: 'maya.verma@student.edu',
        department: 'Computer Science',
        departmentRef: deptCS ? deptCS._id : null,
        semester: 4,
        section: 'A',
        attendancePercentage: 88.5,
        averageInternalPercentage: 82.0,
        missingAssignments: 0,
        consecutiveAbsences: 0,
        cgpa: 8.6,
        mentor: teacherTuring._id,
        contactPhone: '+91 98765 11111',
        parentPhone: '+91 98765 22222'
      },
      {
        rollNo: '21CS112',
        name: 'Kunal Singhania',
        email: 'kunal.singhania@student.edu',
        department: 'Computer Science',
        departmentRef: deptCS ? deptCS._id : null,
        semester: 4,
        section: 'B',
        attendancePercentage: 58.0,
        averageInternalPercentage: 36.0,
        missingAssignments: 4,
        consecutiveAbsences: 4,
        cgpa: 5.4,
        mentor: teacherTuring._id,
        contactPhone: '+91 98765 33333',
        parentPhone: '+91 98765 44444'
      },
      {
        rollNo: '21IT078',
        name: 'Neha Kapoor',
        email: 'neha.kapoor@student.edu',
        department: 'Information Technology',
        departmentRef: deptIT ? deptIT._id : null,
        semester: 4,
        section: 'A',
        attendancePercentage: 72.0,
        averageInternalPercentage: 62.0,
        missingAssignments: 2,
        consecutiveAbsences: 1,
        cgpa: 7.1,
        mentor: advisorHopper._id,
        contactPhone: '+91 98765 55555',
        parentPhone: '+91 98765 66666'
      }
    ];

    const courses = [
      { code: 'CS401', name: 'Full Stack Development 2' },
      { code: 'CS402', name: 'Database Management Systems' },
      { code: 'CS403', name: 'Design and Analysis of Algorithms' },
      { code: 'CS404', name: 'Computer Networks' }
    ];

    const thresholds = await getActiveThresholds();

    for (const data of newStudents) {
      let existing = await Student.findOne({ rollNo: data.rollNo });
      if (!existing) {
        const { riskScore, riskStatus, recommendedAlerts } = calculateRiskScore({
          attendancePercentage: data.attendancePercentage,
          averageInternalPercentage: data.averageInternalPercentage,
          missingAssignments: data.missingAssignments,
          consecutiveAbsences: data.consecutiveAbsences
        }, thresholds);

        const student = await Student.create({
          ...data,
          riskScore,
          riskStatus,
          lastCalculatedAt: new Date()
        });

        for (const c of courses) {
          const total = 30;
          let attended = Math.round((data.attendancePercentage / 100) * total);
          await Attendance.create({
            student: student._id,
            courseCode: c.code,
            courseName: c.name,
            totalClasses: total,
            attendedClasses: attended,
            consecutiveAbsences: data.consecutiveAbsences > 0 ? 1 : 0
          });

          const maxMarks = 50;
          const marks = Math.round((data.averageInternalPercentage / 100) * maxMarks);
          await AcademicRecord.create({
            student: student._id,
            courseCode: c.code,
            courseName: c.name,
            internalMarks: marks,
            maxInternalMarks: maxMarks,
            totalAssignments: 5,
            submittedAssignments: Math.max(0, 5 - data.missingAssignments)
          });
        }

        if (recommendedAlerts.length > 0) {
          await syncStudentAlerts(student._id, recommendedAlerts, student.mentor);
        }
        console.log(`✅ Registered Student: ${data.name} (${data.rollNo}) - Status: ${riskStatus}`);
      }
    }

    console.log('\n🎉 Finished adding new teachers and students successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding records:', err);
    process.exit(1);
  }
};

addRecords();
