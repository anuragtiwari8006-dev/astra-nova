const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Result = require('../models/Result');

async function seedDatabase() {
  try {
    // 1. Seed / Upsert Core System Accounts First (Admin & Faculty)
    const hashedPassword = await bcrypt.hash('student123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    const facultyPassword = await bcrypt.hash('faculty123', 10);

    // Upsert Admin
    await User.findOneAndUpdate(
      { email: 'admin@campus.edu' },
      { name: 'System Admin', password: adminPassword, role: 'admin' },
      { upsert: true, new: true }
    );

    // Upsert Faculty 1 (Matches your Computer Science Sem 4 requirements)
    await User.findOneAndUpdate(
      { email: 'faculty1@campus.edu' },
      { 
        name: 'Dr. Ramesh Sharma', 
        password: facultyPassword, 
        role: 'faculty',
        assignedDepartment: 'Computer Science',
        assignedSemester: 4,
        assignedSubject: 'Data Structures'
      },
      { upsert: true, new: true }
    );

    // 2. Clear existing mock student data safely
    await User.deleteMany({ role: 'student' });
    await Student.deleteMany({});
    await Result.deleteMany({});

    const departments = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical'];

    // 3. Fixed Test Student
    const testUser = await User.create({
      name: 'Test Student',
      email: 'student@campus.edu',
      password: hashedPassword,
      role: 'student'
    });

    const testStudent = await Student.create({
      userId: testUser._id,
      rollNumber: '2026BCSE000',
      department: 'Computer Science',
      semester: 4,
      feeDetails: { totalFee: 100000, paidAmount: 100000, status: 'Paid' }
    });

    await Result.create({
      studentId: testStudent._id,
      semester: 4,
      subjects: [
        { subjectName: 'Data Structures', marksObtained: 85, maxMarks: 100 },
        { subjectName: 'DBMS', marksObtained: 90, maxMarks: 100 }
      ],
      gpa: 8.8
    });

    // 4. Generate 29 students (Assign first 12 to CS Sem 4)
    for (let i = 1; i < 30; i++) {
      const name = faker.person.fullName();
      const email = faker.internet.email().toLowerCase();

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: 'student'
      });

      const department = i <= 12 ? 'Computer Science' : faker.helpers.arrayElement(departments);
      const semester = i <= 12 ? 4 : faker.number.int({ min: 1, max: 8 });

      const totalFee = 100000;
      const paidAmount = faker.helpers.arrayElement([100000, 50000, 0]);
      const feeStatus = paidAmount === 100000 ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Pending');

      const student = await Student.create({
        userId: user._id,
        rollNumber: `2026BCSE${100 + i}`,
        department,
        semester,
        feeDetails: { totalFee, paidAmount, status: feeStatus }
      });

      await Result.create({
        studentId: student._id,
        semester,
        subjects: [
          { subjectName: 'Data Structures', marksObtained: faker.number.int({ min: 45, max: 95 }), maxMarks: 100 },
          { subjectName: 'DBMS', marksObtained: faker.number.int({ min: 50, max: 98 }), maxMarks: 100 }
        ],
        gpa: parseFloat((faker.number.float({ min: 6.0, max: 9.8 })).toFixed(2))
      });
    }

    console.log('Database seeded completely with Admin, Faculty, and Student batch!');
  } catch (err) {
    console.error('Seeding Error:', err);
  }
}

module.exports = seedDatabase;

