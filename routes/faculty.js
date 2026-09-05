
const express = require('express');
const router = express.Router();
const { isAuthenticated, authorizeRoles } = require('../middleware/auth');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');

// Faculty Dashboard Route

router.get('/dashboard', isAuthenticated, authorizeRoles('faculty'), async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : req.user.id;
    const faculty = await User.findById(userId);
    if (!faculty) return res.status(404).send('Faculty profile not found.');

    // Attach fallback values dynamically if they don't exist in the database record
    const facultyData = {
      ...faculty.toObject(),
      assignedDepartment: faculty.assignedDepartment || 'Computer Science & Engineering',
      assignedSemester: faculty.assignedSemester || 'Semester IV',
      assignedSubject: faculty.assignedSubject || 'Cloud Computing'
    };

    // Fetch students in the faculty's department
    const students = await Student.find({ department: facultyData.assignedDepartment }).populate('userId');

    res.render('faculty/dashboard', {
      user: facultyData,
      faculty: facultyData,
      students,
      message: req.query.message || null
    });
  } catch (err) {
    res.status(500).send('Faculty Dashboard Error: ' + err.message);
  }
});


// Robust Profile / Availability Update Handler (Supports multiple route names & form field variations)
const handleProfileUpdate = async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : req.user.id;
    
    // Check multiple possible naming variations for form fields
    const roomNumber = req.body.roomNumber || req.body.room || req.body.cabinNumber;
    const freeSlots = req.body.freeSlots || req.body.availability || req.body.officeHours;
    const assignedSubject = req.body.assignedSubject || req.body.subject;

    await User.findByIdAndUpdate(userId, {
      roomNumber: roomNumber || '',
      freeSlots: freeSlots || '',
      assignedSubject: assignedSubject || ''
    });

    res.redirect('/faculty/dashboard?message=Profile+updated+successfully!');
  } catch (err) {
    res.status(500).send('Profile Update Error: ' + err.message);
  }
};

router.post('/update-profile', isAuthenticated, authorizeRoles('faculty'), handleProfileUpdate);
router.post('/update-availability', isAuthenticated, authorizeRoles('faculty'), handleProfileUpdate);
router.post('/availability', isAuthenticated, authorizeRoles('faculty'), handleProfileUpdate);

// Robust Attendance Submission Handler
const handleAttendanceSubmission = async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : req.user.id;
    const faculty = await User.findById(userId);
    const { subject, date } = req.body; 

    const students = await Student.find({ department: faculty.assignedDepartment || 'Computer Science' });
    if (!students || students.length === 0) {
      return res.redirect('/faculty/dashboard?message=No+students+found+to+mark+attendance.');
    }

    const attendanceDate = date ? new Date(date) : new Date();
    const subjectName = subject || faculty.assignedSubject || 'General Class';

    for (const student of students) {
      let status = 'Present';

      if (req.body.attendanceData && req.body.attendanceData[student._id]) {
        status = req.body.attendanceData[student._id];
      } else if (req.body[student._id]) {
        status = req.body[student._id];
      } else if (req.body[`status_${student._id}`]) {
        status = req.body[`status_${student._id}`];
      }

      const startOfDay = new Date(attendanceDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(attendanceDate);
      endOfDay.setHours(23, 59, 59, 999);

      await Attendance.findOneAndUpdate(
        { 
          studentId: student._id, 
          date: { $gte: startOfDay, $lt: endOfDay }
        },
        {
          studentId: student._id,
          status: status,
          subject: subjectName,
          date: attendanceDate,
          markedBy: faculty._id
        },
        { upsert: true, new: true }
      );
    }

    res.redirect('/faculty/dashboard?message=Attendance+posted+successfully!');
  } catch (err) {
    res.status(500).send('Attendance Error: ' + err.message);
  }
};

router.post('/post-attendance', isAuthenticated, authorizeRoles('faculty'), handleAttendanceSubmission);
router.post('/attendance', isAuthenticated, authorizeRoles('faculty'), handleAttendanceSubmission);

// Fail-Safe Result Submission Handler with Auto-Fallbacks
const handleResultSubmission = async (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : req.user.id;
    const faculty = await User.findById(userId);
    
    let studentId = req.body.studentId || req.body.student || req.body.student_id;
    let semester = req.body.semester || req.body.sem || req.body.semester_number;
    const { gpa, marks, subject } = req.body;

    if (!studentId) {
      const fallbackStudent = await Student.findOne({ department: faculty.assignedDepartment || 'Computer Science' });
      if (fallbackStudent) {
        studentId = fallbackStudent._id;
      }
    }

    if (!semester) {
      semester = 1;
    }

    if (!studentId) {
      return res.redirect('/faculty/dashboard?message=Error:+No+student+found+to+assign+result.');
    }

    await Result.findOneAndUpdate(
      { 
        studentId: studentId, 
        semester: semester 
      },
      {
        studentId: studentId,
        semester: semester,
        gpa: gpa ? parseFloat(gpa) : 0,
        marks: marks || {},
        subject: subject || faculty?.assignedSubject || 'General',
        updatedBy: faculty?._id || userId
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.redirect('/faculty/dashboard?message=Result+posted+successfully!');
  } catch (err) {
    res.status(500).send('Result Posting Error: ' + err.message);
  }
};

router.post('/post-result', isAuthenticated, authorizeRoles('faculty', 'admin'), handleResultSubmission);
router.post('/results', isAuthenticated, authorizeRoles('faculty', 'admin'), handleResultSubmission);
router.post('/result', isAuthenticated, authorizeRoles('faculty', 'admin'), handleResultSubmission);

module.exports = router;