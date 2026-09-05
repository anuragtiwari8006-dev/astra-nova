
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const bcrypt = require('bcryptjs');

// Import Database Models
const User = require('./models/User');

// Initialize Express App
const app = express();

// Middleware Setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Session Configuration
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'student_erp_super_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  }
};
app.use(session(sessionOptions));
app.use(express.static('public'));

// EJS Template Engine & Express Layouts Configuration
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

// Global User Payload Middleware
app.use((req, res, next) => {
  res.locals.user = (req.session && req.session.user) || req.user || null;
  next();
});

// Import Route Handlers
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const studentRoutes = require('./routes/student');

// Register Route Handlers
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/faculty', facultyRoutes);
app.use('/student', studentRoutes);

// Root Route Redirection
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Seed Default System Accounts (Admin, Faculty 1, Student 1)
async function initializeDefaultAccounts() {
  try {
    // 1. Seed Admin
    const adminExists = await User.findOne({ email: 'admin@campus.edu' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        name: 'System Admin',
        email: 'admin@campus.edu',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Default Admin Account Created: admin@campus.edu / admin123');
    }

    // 2. Seed Faculty 1
    const facultyExists = await User.findOne({ email: 'faculty1@campus.edu' });
    if (!facultyExists) {
      const hashedFacultyPassword = await bcrypt.hash('faculty123', 10);
      await User.create({
        name: 'Prof. Faculty Demo',
        email: 'faculty1@campus.edu',
        password: hashedFacultyPassword,
        role: 'faculty',
        assignedDepartment: 'Computer Science & Engineering',
        assignedSemester: 'Semester IV',
        assignedSubject: 'Cloud Computing'
      });
      console.log('Default Faculty Account Created: faculty1@campus.edu / faculty123');
    }

    // 3. Seed Student 1
    const studentExists = await User.findOne({ email: 'student1@campus.edu' });
    if (!studentExists) {
      const hashedStudentPassword = await bcrypt.hash('student123', 10);
      await User.create({
        name: 'Student Demo',
        email: 'student1@campus.edu',
        password: hashedStudentPassword,
        role: 'student',
        department: 'Computer Science & Engineering',
        semester: 'Semester IV'
      });
      console.log('Default Student Account Created: student1@campus.edu / student123');
    }
  } catch (err) {
    console.error('Error Initializing Default Accounts:', err.message);
  }
}

// Database Connection & Server Initialization
const PORT = process.env.PORT || 3000;
const dbUrl = process.env.ATLASDB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/student_erp';

mongoose
  .connect(dbUrl)
  .then(async () => {
    console.log('MongoDB Connected Successfully');
    await initializeDefaultAccounts(); // Seeds all three demo accounts automatically
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err.message);
  });