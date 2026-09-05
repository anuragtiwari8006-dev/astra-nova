
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

// Import the Seeder Function (adjust path if your folder is named 'utils' instead of 'utilis')
const seedDatabase = require('./utils/seeder.js');

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

// Database Connection & Server Initialization
const PORT = process.env.PORT || 3000;
const dbUrl = process.env.ATLASDB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/student_erp';

mongoose
  .connect(dbUrl)
  .then(async () => {
    console.log('MongoDB Connected Successfully');
    
    // Run the unified seeder on startup (Seeds Admin, Faculty, and Student batch)
    await seedDatabase(); 

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err.message);
  });