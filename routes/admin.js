
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { isAuthenticated, authorizeRoles } = require('../middleware/auth');
const User = require('../models/User');
const Student = require('../models/Student');
const Result = require('../models/Result');

// Use upload.any() to avoid any field name mismatch errors with multer
const upload = multer({ dest: 'uploads/' });

// Admin Dashboard Route with Robust Analytics
router.get('/dashboard', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  try {
    const students = await Student.find().populate('userId');
    const faculties = await User.find({ role: 'faculty' });

    // Calculate Fee Statistics for Charts
    let totalPaid = 0;
    let totalRemaining = 0;
    
    students.forEach(s => {
      const paid = Number(s.feeDetails?.paidAmount) || 0;
      const total = Number(s.feeDetails?.totalFee) || 120000;
      totalPaid += paid;
      totalRemaining += Math.max(0, total - paid);
    });

    // Fallback defaults if no students exist so charts don't render empty/unknown
    if (students.length === 0) {
      totalPaid = 500000;
      totalRemaining = 200000;
    }

    const feeStats = [totalPaid, totalRemaining];

    // Calculate Department Statistics for Charts
    const deptMap = {};
    students.forEach(s => {
      const dept = s.department || 'Computer Science';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });

    if (Object.keys(deptMap).length === 0) {
      deptMap['Computer Science'] = 1;
    }

    const deptStats = {
      labels: Object.keys(deptMap),
      data: Object.values(deptMap)
    };

    res.render('admin/dashboard', {
      user: req.session.user || req.user,
      students,
      faculties,
      totalStudents: students.length,
      totalFaculties: faculties.length,
      feeStats,
      deptStats,
      message: req.query.message || null
    });
  } catch (err) {
    res.status(500).send('Admin Dashboard Error: ' + err.message);
  }
});

// 1-Click Seed Route: Upserts Faculties & Students with Hashed Passwords
router.post('/seed-data', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  try {
    const hashedFacultyPassword = await bcrypt.hash('faculty123', 10);
    const hashedStudentPassword = await bcrypt.hash('student123', 10);

    const facultyConfigs = [
      { name: 'Dr. Ramesh Sharma', dept: 'Computer Science', sub: 'Data Structures', room: 'Cabin-101' },
      { name: 'Prof. Anita Verma', dept: 'Computer Science', sub: 'DBMS', room: 'Cabin-102' },
      { name: 'Dr. Vikramaditya Rai', dept: 'Computer Science', sub: 'Algorithms', room: 'Cabin-103' },
      { name: 'Prof. Sneha Kulkarni', dept: 'Computer Science', sub: 'Web Development', room: 'Cabin-104' },
      { name: 'Dr. Alok Nath', dept: 'Information Technology', sub: 'Operating Systems', room: 'Cabin-201' },
      { name: 'Prof. Meenakshi Sundaram', dept: 'Information Technology', sub: 'Computer Networks', room: 'Cabin-202' },
      { name: 'Dr. Rajesh Khanna', dept: 'AI & Machine Learning', sub: 'Machine Learning', room: 'Cabin-301' },
      { name: 'Prof. Divya Hegde', dept: 'AI & Machine Learning', sub: 'Neural Networks', room: 'Cabin-302' },
      { name: 'Dr. Suresh Chandra', dept: 'Electronics', sub: 'Digital Electronics', room: 'Cabin-401' },
      { name: 'Prof. Kavita Reddy', dept: 'Electronics', sub: 'Microprocessors', room: 'Cabin-402' }
    ];

    for (let i = 0; i < facultyConfigs.length; i++) {
      const config = facultyConfigs[i];
      const email = `faculty${i + 1}@campus.edu`;
      
      await User.findOneAndUpdate(
        { email },
        {
          name: config.name,
          email,
          password: hashedFacultyPassword,
          role: 'faculty',
          assignedDepartment: config.dept,
          assignedSemester: 4,
          assignedSubject: config.sub,
          roomNumber: config.room,
          freeSlots: 'Mon-Wed-Fri: 2:00 PM - 4:00 PM'
        },
        { upsert: true, new: true }
      );
    }

    const departments = ['Computer Science', 'Information Technology', 'AI & Machine Learning', 'Electronics'];
    const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Ananya', 'Diya', 'Priya', 'Kavya', 'Sanya', 'Isha', 'Riya', 'Anushka', 'Rohan', 'Kabir'];
    const lastNames = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Joshi', 'Rao', 'Nair', 'Reddy'];

    for (let i = 1; i <= 100; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[i % lastNames.length];
      const studentName = `${fn} ${ln} ${i}`;
      const email = `student${i}@campus.edu`;
      const rollNumber = `22BCE${1000 + i}`;
      const dept = departments[i % departments.length];
      const currentSemester = (i % 4) + 1;

      let studentUser = await User.findOneAndUpdate(
        { email },
        {
          name: studentName,
          email,
          password: hashedStudentPassword,
          role: 'student'
        },
        { upsert: true, new: true }
      );

      let student = await Student.findOneAndUpdate(
        { rollNumber },
        {
          userId: studentUser._id,
          rollNumber,
          department: dept,
          semester: currentSemester,
          feeDetails: { totalFee: 120000, paidAmount: 100000 }
        },
        { upsert: true, new: true }
      );

      for (let sem = 1; sem <= currentSemester; sem++) {
        const existingResult = await Result.findOne({ studentId: student._id, semester: sem });
        if (!existingResult) {
          const m1 = 70 + Math.floor(Math.random() * 25);
          const m2 = 65 + Math.floor(Math.random() * 30);
          const gpa = parseFloat(((((m1 + m2) / 200) * 10)).toFixed(2));

          await Result.create({
            studentId: student._id,
            semester: sem,
            gpa,
            subjects: [
              { subjectName: `Subject ${sem}.1`, marksObtained: m1, maxMarks: 100 },
              { subjectName: `Subject ${sem}.2`, marksObtained: m2, maxMarks: 100 }
            ]
          });
        }
      }
    }

    res.redirect('/admin/dashboard?message=Successfully+refreshed+and+seeded+all+accounts!');
  } catch (err) {
    res.status(500).send('Seeding Error: ' + err.message);
  }
});

// Universal File Upload Handler for both CSV and Excel
async function handleStudentFileUpload(req, res) {
  const uploadedFile = req.file || (req.files && req.files[0]);
  
  if (!uploadedFile) {
    return res.redirect('/admin/dashboard?message=Please+select+a+file.');
  }

  const filePath = uploadedFile.path;
  const ext = path.extname(uploadedFile.originalname).toLowerCase();
  let records = [];

  try {
    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];

      const headers = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value ? cell.value.toString().trim() : '';
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            rowData[header] = cell.value;
          }
        });
        if (Object.keys(rowData).length > 0) records.push(rowData);
      });

      await processStudentImport(records);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.redirect('/admin/dashboard?message=Excel+Students+Imported+Successfully!');
    } else {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('end', async () => {
          await processStudentImport(records);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return res.redirect('/admin/dashboard?message=CSV+Students+Imported+Successfully!');
        });
    }
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).send('File Processing Error: ' + err.message);
  }
}

// Routes supporting both import endpoint paths
router.post('/upload-students', isAuthenticated, authorizeRoles('admin'), upload.any(), handleStudentFileUpload);
router.post('/import-excel', isAuthenticated, authorizeRoles('admin'), upload.any(), handleStudentFileUpload);

async function processStudentImport(rows) {
  const defaultPasswordHash = await bcrypt.hash('Student@123', 10);
  
  for (const row of rows) {
    const getVal = (keys) => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
          return row[foundKey].toString().trim();
        }
      }
      return '';
    };

    const email = getVal(['email', 'mail', 'email address']);
    const name = getVal(['name', 'student name', 'fullname']) || 'Student';
    const rollNumber = getVal(['rollnumber', 'roll', 'roll no', 'registration no']);
    const department = getVal(['department', 'dept', 'branch']) || 'Computer Science';
    const semester = Number(getVal(['semester', 'sem'])) || 1;
    const rawPassword = getVal(['password', 'pass']);
    const totalFee = Number(getVal(['totalfee', 'fee'])) || 120000;
    const paidAmount = Number(getVal(['paidamount', 'paid'])) || 0;

    if (!email || !rollNumber) continue;

    let user = await User.findOne({ email });
    if (!user) {
      const userPassword = rawPassword ? await bcrypt.hash(rawPassword, 10) : defaultPasswordHash;
      user = await User.create({ name, email, password: userPassword, role: 'student' });
    }

    let student = await Student.findOne({ rollNumber });
    if (!student) {
      await Student.create({
        userId: user._id,
        rollNumber,
        department,
        semester,
        feeDetails: { totalFee, paidAmount }
      });
    } else {
      student.department = department;
      student.semester = semester;
      student.feeDetails.totalFee = totalFee;
      student.feeDetails.paidAmount = paidAmount;
      await student.save();
    }
  }
}

module.exports = router;