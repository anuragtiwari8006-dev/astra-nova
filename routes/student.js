
const express = require('express');
const router = express.Router();
const { isAuthenticated, authorizeRoles } = require('../middleware/auth');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');

// Student Dashboard Route
router.get('/dashboard', isAuthenticated, authorizeRoles('student'), async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : req.user.id;
    const studentUser = await User.findById(userId);
    if (!studentUser) return res.status(404).send('Student user profile not found.');

    const studentRecord = await Student.findOne({ userId: userId }).populate('userId');
    const attendanceRecords = await Attendance.find({ studentId: studentRecord?._id });
    const resultRecords = await Result.find({ studentId: studentRecord?._id });

    // Flexible Faculty Fetch: tries department first, but pulls all faculty if needed
    let departmentFaculty = [];
    if (studentRecord && studentRecord.department) {
      departmentFaculty = await User.find({ 
        role: 'faculty', 
        $or: [
          { assignedDepartment: studentRecord.department },
          { department: studentRecord.department }
        ]
      });
    }
    
    // If department filtering returns too few or none, fallback to fetching all faculty members
    if (!departmentFaculty || departmentFaculty.length === 0) {
      departmentFaculty = await User.find({ role: 'faculty' });
    }

    // Fetch notices safely
    let notices = [];
    try {
      const Notice = require('../models/Notice');
      notices = await Notice.find().sort({ createdAt: -1 }).limit(5);
    } catch (e) {
      notices = [
        { title: 'Welcome to Student ERP', content: 'Your portal is fully active and synchronized.', createdAt: new Date() }
      ];
    }

    let cgpa = '0.00';
    if (resultRecords && resultRecords.length > 0) {
      const totalGpa = resultRecords.reduce((sum, r) => sum + (Number(r.gpa) || 0), 0);
      cgpa = (totalGpa / resultRecords.length).toFixed(2);
    }

    let attendancePercentage = 0;
    if (attendanceRecords && attendanceRecords.length > 0) {
      const presentCount = attendanceRecords.filter(a => a.status === 'Present').length;
      attendancePercentage = Math.round((presentCount / attendanceRecords.length) * 100);
    }

    const remainingFee = studentRecord?.remainingFee || studentRecord?.feeDue || 0;
    const creditsEarned = studentRecord?.creditsEarned || 40;

    res.render('student/dashboard', {
      user: studentUser,
      student: studentRecord || {},
      attendance: attendanceRecords || [],
      results: resultRecords || [],
      faculty: departmentFaculty,
      assignedFaculty: departmentFaculty,
      faculties: departmentFaculty,
      notices: notices,
      cgpa: cgpa,
      attendancePercentage: attendancePercentage,
      remainingFee: remainingFee,
      creditsEarned: creditsEarned,
      message: req.query.message || null
    });
  } catch (err) {
    res.status(500).send('Student Dashboard Error: ' + err.message);
  }
});

// Dedicated Faculties View Route for Students
router.get('/faculties', isAuthenticated, authorizeRoles('student'), async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : req.user.id;
    const studentUser = await User.findById(userId);
    const studentRecord = await Student.findOne({ userId: userId });

    let departmentFaculty = [];
    if (studentRecord && studentRecord.department) {
      departmentFaculty = await User.find({ 
        role: 'faculty', 
        $or: [
          { assignedDepartment: studentRecord.department },
          { department: studentRecord.department }
        ]
      });
    }

    if (!departmentFaculty || departmentFaculty.length === 0) {
      departmentFaculty = await User.find({ role: 'faculty' });
    }

    res.render('student/faculty', {
      user: studentUser,
      student: studentRecord || {},
      faculty: departmentFaculty,
      assignedFaculty: departmentFaculty,
      faculties: departmentFaculty,
      message: req.query.message || null
    });
  } catch (err) {
    res.status(500).send('Student Faculties Error: ' + err.message);
  }
});

// Student Report Download / Print Route
router.get('/download-report', isAuthenticated, authorizeRoles('student'), async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : req.user.id;
    const studentUser = await User.findById(userId);
    const studentRecord = await Student.findOne({ userId: userId }).populate('userId');
    const attendanceRecords = await Attendance.find({ studentId: studentRecord?._id });
    const resultRecords = await Result.find({ studentId: studentRecord?._id });

    if (!studentRecord) {
      return res.status(404).send('Student profile record not found.');
    }

    let cgpa = '0.00';
    if (resultRecords && resultRecords.length > 0) {
      const totalGpa = resultRecords.reduce((sum, r) => sum + (Number(r.gpa) || 0), 0);
      cgpa = (totalGpa / resultRecords.length).toFixed(2);
    }

    let attendancePercentage = 0;
    if (attendanceRecords && attendanceRecords.length > 0) {
      const presentCount = attendanceRecords.filter(a => a.status === 'Present').length;
      attendancePercentage = Math.round((presentCount / attendanceRecords.length) * 100);
    }

    const remainingFee = studentRecord?.remainingFee || studentRecord?.feeDue || 0;
    const creditsEarned = studentRecord?.creditsEarned || 40;

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Academic Report - ${studentUser.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-950 text-slate-100 p-8 font-sans">
        <div class="max-w-3xl mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
          
          <div class="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 class="text-2xl font-bold text-white">Student Academic Report</h1>
              <p class="text-sm text-slate-400">Official Student ERP Generated Summary</p>
            </div>
            <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition print:hidden">
              Print / Save PDF
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 text-sm">
            <div>
              <p class="text-slate-400">Student Name</p>
              <p class="font-semibold text-white text-base">${studentUser.name}</p>
            </div>
            <div>
              <p class="text-slate-400">Email Address</p>
              <p class="font-semibold text-white text-base">${studentUser.email}</p>
            </div>
            <div>
              <p class="text-slate-400">Department</p>
              <p class="font-semibold text-white text-base">${studentRecord.department || 'N/A'}</p>
            </div>
            <div>
              <p class="text-slate-400">Roll Number</p>
              <p class="font-semibold text-white text-base">${studentRecord.rollNumber || 'N/A'}</p>
            </div>
          </div>

          <div>
            <h2 class="text-lg font-bold text-white mb-2">Performance Overview</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <p class="text-sm text-slate-400">CGPA</p>
                <p class="text-xl font-bold text-purple-400 mt-1">${cgpa} / 10.0</p>
              </div>
              <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <p class="text-sm text-slate-400">Attendance</p>
                <p class="text-xl font-bold text-blue-400 mt-1">${attendancePercentage}%</p>
              </div>
              <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <p class="text-sm text-slate-400">Credits Earned</p>
                <p class="text-xl font-bold text-indigo-400 mt-1">${creditsEarned} / 160</p>
              </div>
              <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <p class="text-sm text-slate-400">Fee Due</p>
                <p class="text-xl font-bold text-amber-400 mt-1">₹${remainingFee.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-800 flex justify-between items-center print:hidden">
            <a href="/student/dashboard" class="text-sm text-slate-400 hover:text-white transition">
              &larr; Back to Dashboard
            </a>
            <span class="text-xs text-slate-500">Generated securely via Student ERP</span>
          </div>

        </div>
      </body>
      </html>
    `;

    return res.send(reportHtml);
  } catch (err) {
    res.status(500).send('Download Report Error: ' + err.message);
  }
});

module.exports = router;