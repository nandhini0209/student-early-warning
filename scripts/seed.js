const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../backend/models/User');
const Student = require('../backend/models/Student');
const Department = require('../backend/models/Department');
const ClassRoom = require('../backend/models/ClassRoom');
const Subject = require('../backend/models/Subject');
const Attendance = require('../backend/models/Attendance');
const AcademicRecord = require('../backend/models/AcademicRecord');
const Alert = require('../backend/models/Alert');
const Intervention = require('../backend/models/Intervention');
const ThresholdConfig = require('../backend/models/ThresholdConfig');
const AuditLog = require('../backend/models/AuditLog');
const { calculateRiskScore, syncStudentAlerts } = require('../backend/utils/riskEngine');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student_early_alert';
    await mongoose.connect(mongoUri);
    console.log(`[Database Connected for Seeding]: ${mongoUri}`);

    // Clear existing collections
    await User.deleteMany({});
    await Student.deleteMany({});
    await Department.deleteMany({});
    await ClassRoom.deleteMany({});
    await Subject.deleteMany({});
    await Attendance.deleteMany({});
    await AcademicRecord.deleteMany({});
    await Alert.deleteMany({});
    await Intervention.deleteMany({});
    await ThresholdConfig.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('🧹 Cleaned existing database collections.');

    // 1. Create Departments
    const deptCS = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      description: 'Department of Computer Science & Engineering',
      status: 'active'
    });

    const deptIT = await Department.create({
      name: 'Information Technology',
      code: 'IT',
      description: 'Department of Information Technology',
      status: 'active'
    });

    const deptECE = await Department.create({
      name: 'Electronics and Communication',
      code: 'ECE',
      description: 'Department of Electronics & Communication',
      status: 'active'
    });

    console.log('✅ Created Departments: CSE, IT, ECE.');

    // 2. Create System Users (Admin, Teachers/Mentors)
    const adminUser = await User.create({
      name: 'Dean Academic Affairs',
      email: 'admin@college.edu',
      password: 'Password@123',
      role: 'admin',
      department: 'Administration',
      status: 'active'
    });

    const teacherSmith = await User.create({
      name: 'Dr. Robert Smith',
      email: 'faculty@college.edu',
      password: 'Password@123',
      role: 'faculty',
      department: 'Computer Science',
      departmentRef: deptCS._id,
      status: 'active'
    });

    const advisorJenkins = await User.create({
      name: 'Prof. Sarah Jenkins',
      email: 'advisor@college.edu',
      password: 'Password@123',
      role: 'advisor',
      department: 'Student Support & Counseling',
      departmentRef: deptCS._id,
      status: 'active'
    });

    console.log('✅ Created Admin & Teacher/Mentor accounts.');

    // 3. Create Classes
    const classCS4A = await ClassRoom.create({
      name: 'CSE-4A',
      department: deptCS._id,
      semester: 4,
      section: 'A',
      classTeacher: teacherSmith._id,
      academicYear: '2026-2027',
      status: 'active'
    });

    const classCS4B = await ClassRoom.create({
      name: 'CSE-4B',
      department: deptCS._id,
      semester: 4,
      section: 'B',
      classTeacher: advisorJenkins._id,
      academicYear: '2026-2027',
      status: 'active'
    });

    const classIT4A = await ClassRoom.create({
      name: 'IT-4A',
      department: deptIT._id,
      semester: 4,
      section: 'A',
      academicYear: '2026-2027',
      status: 'active'
    });

    console.log('✅ Created Classes (CSE-4A, CSE-4B, IT-4A).');

    // 4. Create Subjects and Assign Teachers
    const subFSD2 = await Subject.create({
      code: 'CS401',
      name: 'Full Stack Development 2',
      department: deptCS._id,
      semester: 4,
      credits: 4,
      assignedTeacher: teacherSmith._id,
      status: 'active'
    });

    const subDBMS = await Subject.create({
      code: 'CS402',
      name: 'Database Management Systems',
      department: deptCS._id,
      semester: 4,
      credits: 4,
      assignedTeacher: teacherSmith._id,
      status: 'active'
    });

    const subDAA = await Subject.create({
      code: 'CS403',
      name: 'Design and Analysis of Algorithms',
      department: deptCS._id,
      semester: 4,
      credits: 4,
      assignedTeacher: advisorJenkins._id,
      status: 'active'
    });

    const subCN = await Subject.create({
      code: 'CS404',
      name: 'Computer Networks',
      department: deptCS._id,
      semester: 4,
      credits: 3,
      assignedTeacher: null,
      status: 'active'
    });

    // Link assigned subjects to teacher
    await User.findByIdAndUpdate(teacherSmith._id, {
      $set: { assignedSubjects: [subFSD2._id, subDBMS._id] }
    });

    console.log('✅ Created Subjects & Mapped Teachers.');

    // 5. Configurable Warning Thresholds
    await ThresholdConfig.create({
      attendanceWarning: 75,
      attendanceCritical: 65,
      marksWarning: 55,
      marksCritical: 40,
      consecutiveAbsenceLimit: 3,
      missingAssignmentLimit: 2,
      updatedBy: adminUser._id
    });

    console.log('✅ Seeded Institutional Warning Thresholds.');

    // 6. Define Sample Students with realistic risk metrics
    const sampleStudents = [
      {
        rollNo: '21CS001',
        name: 'Rahul Sharma',
        email: 'rahul.sharma@student.edu',
        department: 'Computer Science',
        departmentRef: deptCS._id,
        classRoom: classCS4A._id,
        semester: 4,
        section: 'A',
        attendancePercentage: 54.0,
        averageInternalPercentage: 38.0,
        missingAssignments: 4,
        consecutiveAbsences: 5,
        cgpa: 5.6,
        performanceTrend: 'DECLINING',
        mentor: teacherSmith._id,
        contactPhone: '+91 98765 43210',
        parentPhone: '+91 98765 00001'
      },
      {
        rollNo: '21CS015',
        name: 'Priya Patel',
        email: 'priya.patel@student.edu',
        department: 'Computer Science',
        departmentRef: deptCS._id,
        classRoom: classCS4A._id,
        semester: 4,
        section: 'A',
        attendancePercentage: 62.5,
        averageInternalPercentage: 42.0,
        missingAssignments: 3,
        consecutiveAbsences: 3,
        cgpa: 6.1,
        performanceTrend: 'DECLINING',
        mentor: teacherSmith._id,
        contactPhone: '+91 98765 43211',
        parentPhone: '+91 98765 00002'
      },
      {
        rollNo: '21IT024',
        name: 'Aarav Mehta',
        email: 'aarav.mehta@student.edu',
        department: 'Information Technology',
        departmentRef: deptIT._id,
        classRoom: classIT4A._id,
        semester: 4,
        section: 'A',
        attendancePercentage: 59.0,
        averageInternalPercentage: 35.0,
        missingAssignments: 4,
        consecutiveAbsences: 4,
        cgpa: 5.2,
        performanceTrend: 'DECLINING',
        mentor: advisorJenkins._id,
        contactPhone: '+91 98765 43212',
        parentPhone: '+91 98765 00003'
      },
      {
        rollNo: '21CS042',
        name: 'Sneha Rao',
        email: 'sneha.rao@student.edu',
        department: 'Computer Science',
        departmentRef: deptCS._id,
        classRoom: classCS4A._id,
        semester: 4,
        section: 'A',
        attendancePercentage: 71.0,
        averageInternalPercentage: 58.0,
        missingAssignments: 2,
        consecutiveAbsences: 1,
        cgpa: 7.0,
        performanceTrend: 'STABLE',
        mentor: teacherSmith._id,
        contactPhone: '+91 98765 43213',
        parentPhone: '+91 98765 00004'
      },
      {
        rollNo: '21EC019',
        name: 'Vikram Singh',
        email: 'vikram.singh@student.edu',
        department: 'Electronics',
        departmentRef: deptECE._id,
        semester: 4,
        section: 'A',
        attendancePercentage: 73.5,
        averageInternalPercentage: 64.0,
        missingAssignments: 2,
        consecutiveAbsences: 2,
        cgpa: 6.8,
        performanceTrend: 'STABLE',
        mentor: advisorJenkins._id,
        contactPhone: '+91 98765 43214',
        parentPhone: '+91 98765 00005'
      },
      {
        rollNo: '21CS088',
        name: 'Rohan Gupta',
        email: 'rohan.gupta@student.edu',
        department: 'Computer Science',
        departmentRef: deptCS._id,
        classRoom: classCS4B._id,
        semester: 4,
        section: 'B',
        attendancePercentage: 92.5,
        averageInternalPercentage: 88.0,
        missingAssignments: 0,
        consecutiveAbsences: 0,
        cgpa: 9.3,
        performanceTrend: 'IMPROVING',
        mentor: teacherSmith._id,
        contactPhone: '+91 98765 43216',
        parentPhone: '+91 98765 00007'
      },
      {
        rollNo: '21CS095',
        name: 'Divya Nair',
        email: 'divya.nair@student.edu',
        department: 'Computer Science',
        departmentRef: deptCS._id,
        classRoom: classCS4B._id,
        semester: 4,
        section: 'B',
        attendancePercentage: 89.0,
        averageInternalPercentage: 84.5,
        missingAssignments: 0,
        consecutiveAbsences: 0,
        cgpa: 8.9,
        performanceTrend: 'IMPROVING',
        mentor: teacherSmith._id,
        contactPhone: '+91 98765 43217',
        parentPhone: '+91 98765 00008'
      }
    ];

    const courses = [
      { code: 'CS401', name: 'Full Stack Development 2' },
      { code: 'CS402', name: 'Database Management Systems' },
      { code: 'CS403', name: 'Design and Analysis of Algorithms' },
      { code: 'CS404', name: 'Computer Networks' }
    ];

    for (const data of sampleStudents) {
      const { riskScore, riskStatus, recommendedAlerts } = calculateRiskScore({
        attendancePercentage: data.attendancePercentage,
        averageInternalPercentage: data.averageInternalPercentage,
        missingAssignments: data.missingAssignments,
        consecutiveAbsences: data.consecutiveAbsences
      });

      const student = await Student.create({
        ...data,
        riskScore,
        riskStatus,
        lastCalculatedAt: new Date()
      });

      // Also create student user for Rahul Sharma
      if (data.rollNo === '21CS001') {
        await User.create({
          name: data.name,
          email: data.email,
          password: 'Password@123',
          role: 'student',
          department: data.department,
          studentRef: student._id,
          status: 'active'
        });
      }

      // Course-wise attendance & marks
      for (const course of courses) {
        const total = 30;
        let attended = Math.round((data.attendancePercentage / 100) * total);
        if (attended > total) attended = total;
        if (attended < 0) attended = 0;

        await Attendance.create({
          student: student._id,
          courseCode: course.code,
          courseName: course.name,
          totalClasses: total,
          attendedClasses: attended,
          consecutiveAbsences: data.consecutiveAbsences > 0 ? 2 : 0
        });

        const maxMarks = 50;
        const marks = Math.round((data.averageInternalPercentage / 100) * maxMarks);
        await AcademicRecord.create({
          student: student._id,
          courseCode: course.code,
          courseName: course.name,
          internalMarks: marks,
          maxInternalMarks: maxMarks,
          totalAssignments: 5,
          submittedAssignments: 5 - data.missingAssignments >= 0 ? 5 - data.missingAssignments : 1
        });
      }

      // Sync alerts automatically with mentor reference
      if (recommendedAlerts.length > 0) {
        await syncStudentAlerts(student._id, recommendedAlerts, data.mentor);
      }
    }

    console.log(`✅ Seeded ${sampleStudents.length} Students with Attendance, Marks, and Mentors.`);

    // 7. Seed Interventions & Follow-ups
    const rahul = await Student.findOne({ rollNo: '21CS001' });
    const priya = await Student.findOne({ rollNo: '21CS015' });
    const rahulAlert = await Alert.findOne({ student: rahul._id });

    if (rahul) {
      await Intervention.create({
        student: rahul._id,
        alert: rahulAlert ? rahulAlert._id : null,
        counselor: teacherSmith._id,
        actionType: 'ONE_ON_ONE_COUNSELING',
        scheduledDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'SCHEDULED',
        preInterventionRisk: 82,
        discussionNotes: 'Counseling conducted regarding low FSD 2 lab attendance. Student noted health concerns.',
        actionItems: '1. Attend all lab sessions next week. 2. Submit pending assignment 3 & 4.'
      });
    }

    if (priya) {
      await Intervention.create({
        student: priya._id,
        counselor: teacherSmith._id,
        actionType: 'REMEDIAL_CLASS',
        scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        followUpDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'COMPLETED',
        preInterventionRisk: 68,
        postInterventionRisk: 52,
        improvementStatus: 'IMPROVED',
        discussionNotes: 'Enrolled in remedial DBMS problem-solving lab.',
        outcome: 'Student attended 3 consecutive sessions and submitted all assignments. Risk score improved from 68 to 52.'
      });
    }

    console.log('✅ Seeded Teacher Guidance & Intervention Follow-ups.');

    // 8. Seed Mandatory Audit Trail Log for Admin Academic Record Override
    if (rahul) {
      await AuditLog.create({
        action: 'ACADEMIC_RECORD_OVERRIDE',
        performedBy: adminUser._id,
        performedByRole: 'admin',
        targetStudent: rahul._id,
        entityType: 'Student',
        fieldModified: 'attendancePercentage',
        oldValue: 50.0,
        newValue: 54.0,
        reason: 'Approved Medical Certificate (Ref: MED/2026/042) for verified hospitalization period.'
      });
    }

    console.log('✅ Seeded Sample Administrative Audit Trail.');

    console.log('\n=============================================');
    console.log('🎉 SEEDING COMPLETE WITH ADMIN & TEACHER PERSONAS!');
    console.log('---------------------------------------------');
    console.log('🛡️ Admin:    admin@college.edu    / Password@123');
    console.log('👨‍🏫 Teacher:  faculty@college.edu  / Password@123');
    console.log('👩‍💼 Advisor:  advisor@college.edu  / Password@123');
    console.log('🎓 Student:  rahul.sharma@student.edu / Password@123');
    console.log('=============================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding Error:', err);
    process.exit(1);
  }
};

seedData();
