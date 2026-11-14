// Repairs / creates a teacher (faculty) login so you can sign in again.
// Usage:
//   npm run reset-teacher                       -> faculty@college.edu / Password@123
//   node scripts/reset-teacher.js you@mail.com NewPass@123 [faculty|advisor]
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
const User = require('../backend/models/User');

const email = (process.argv[2] || 'faculty@college.edu').trim().toLowerCase();
const password = process.argv[3] || 'Password@123';
const role = ['faculty', 'advisor'].includes(process.argv[4]) ? process.argv[4] : 'faculty';

(async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student_early_alert';
    await mongoose.connect(uri);
    console.log(`Connected: ${uri}`);
    console.log(`Users in DB: ${await User.countDocuments()}`);

    let user = await User.findOne({ email });
    if (user) {
      user.password = password; // pre-save hook hashes it exactly once
      user.status = 'active';
      if (!['faculty', 'advisor', 'admin'].includes(user.role)) user.role = role;
      await user.save();
      console.log(`Updated existing ${user.role} account: ${email}`);
    } else {
      user = await User.create({
        name: 'Dr. Robert Smith', email, password, role,
        department: 'Computer Science', status: 'active'
      });
      console.log(`Created new ${role} account: ${email}`);
    }
    console.log(`Login now with  ${email}  /  ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
})();
