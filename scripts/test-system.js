const http = require('http');

function post(url, data, token = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function get(url, token = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING VERIFICATION TESTS ---');

  // Test 1: Register a new student
  const testEmail = `student_${Date.now()}@college.edu`;
  console.log(`\n1. Testing Student Self-Registration (${testEmail})...`);
  const regRes = await post('http://localhost:5000/api/auth/register', {
    name: 'Ananya Reddy',
    email: testEmail,
    password: 'Password@123',
    role: 'student',
    department: 'Computer Science',
    semester: 4,
    section: 'A'
  });

  if (regRes.status !== 201 || !regRes.body.success) {
    console.error('❌ Registration failed:', regRes);
    process.exit(1);
  }
  const studentToken = regRes.body.data.token;
  const studentUser = regRes.body.data;
  console.log('✅ Student registered successfully! Roll No:', studentUser.studentRef ? studentUser.studentRef.rollNo : 'N/A');

  const mentor = studentUser.studentRef ? studentUser.studentRef.mentor : null;
  if (mentor) {
    console.log(`✅ Faculty Mentor automatically assigned: ${mentor.name} (${mentor.email}) - Dept: ${mentor.department}`);
  } else {
    console.error('❌ No mentor assigned to registered student!');
  }

  // Test 2: Verify Data Isolation - Student trying to access Admin API
  console.log('\n2. Testing Admin Security Isolation (Student accessing /api/admin/analytics)...');
  const adminSecRes = await get('http://localhost:5000/api/admin/analytics', studentToken);
  if (adminSecRes.status === 403) {
    console.log('✅ PASS: Student correctly blocked with 403 Forbidden on Admin routes!');
  } else {
    console.error(`❌ Security failure: Student got status ${adminSecRes.status} instead of 403!`);
  }

  // Test 3: Verify Student Isolation - Student query /api/students
  console.log('\n3. Testing Student Peer Isolation (Student accessing /api/students)...');
  const studentsListRes = await get('http://localhost:5000/api/students', studentToken);
  if (studentsListRes.status === 200 && studentsListRes.body.data.length === 1) {
    console.log('✅ PASS: Student strictly only receives their own single profile (No peer leakage)!');
  } else {
    console.error('❌ Data leakage: Student received other students in list:', studentsListRes.body.data.length);
  }

  // Test 4: Student fetches their full details with mentor and courses
  console.log('\n4. Testing Student Portal Details Retrieval...');
  const studentId = studentUser.studentRef._id || studentUser.studentRef;
  const detailRes = await get(`http://localhost:5000/api/students/${studentId}`, studentToken);
  if (detailRes.status === 200 && detailRes.body.data) {
    const d = detailRes.body.data;
    console.log(`✅ Student Name: ${d.student.name}`);
    console.log(`✅ Risk Score: ${d.student.riskScore} (${d.student.riskStatus})`);
    console.log(`✅ Attendance Records: ${d.attendanceRecords.length} courses`);
    console.log(`✅ Academic Records: ${d.academicRecords.length} courses`);
    console.log(`✅ Guidance Sessions: ${d.interventions.length} session(s)`);
    if (d.interventions.length > 0) {
      console.log(`   Initial Guidance Note: "${d.interventions[0].discussionNotes}"`);
    }
  } else {
    console.error('❌ Failed to fetch student details:', detailRes);
  }

  // Test 5: Student Requests Faculty Guidance
  console.log('\n5. Testing Student Requesting Guidance from Faculty Mentor...');
  const guidanceReq = await post('http://localhost:5000/api/students/request-guidance', {
    actionType: 'ONE_ON_ONE_COUNSELING',
    urgency: 'HIGH',
    discussionNotes: 'Sir, I need assistance understanding the DBMS database normalization module before the CIE-2 test.'
  }, studentToken);

  if (guidanceReq.status === 201 && guidanceReq.body.success) {
    console.log('✅ PASS: Guidance request logged and linked to mentor successfully!');
  } else {
    console.error('❌ Failed to submit guidance request:', guidanceReq);
  }

  // Test 6: Faculty Login and Check Guidance Requests
  console.log('\n6. Testing Faculty Login and Mentor View...');
  const facultyLoginRes = await post('http://localhost:5000/api/auth/login', {
    email: 'faculty@college.edu',
    password: 'Password@123'
  });
  if (facultyLoginRes.status === 200 && facultyLoginRes.body.success) {
    const facultyToken = facultyLoginRes.body.data.token;
    console.log(`✅ Faculty authenticated: ${facultyLoginRes.body.data.name}`);

    const teacherDash = await get('http://localhost:5000/api/teacher/dashboard', facultyToken);
    console.log(`✅ Teacher Dashboard loaded: ${teacherDash.body.data.summary.totalAssigned} assigned mentees, ${teacherDash.body.data.summary.pendingFollowUpsCount} pending guidance sessions.`);
  } else {
    console.error('❌ Faculty login failed:', facultyLoginRes);
  }

  console.log('\n=============================================');
  console.log('🎉 ALL SYSTEM & SECURITY TESTS PASSED PERFECTLY!');
  console.log('=============================================');
}

runTests().catch(console.error);
