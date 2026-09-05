
const express = require('express');
const router = express.Router();

const {
  isAuthenticated,
  authorizeRoles
} = require('../middleware/auth');

const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');


// ============================================================
// GRADE CALCULATOR
// ============================================================

function calculateGrade(marksObtained, maxMarks) {

  const percentage =
    maxMarks > 0
      ? (Number(marksObtained) / Number(maxMarks)) * 100
      : 0;


  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';

  return 'F';
}



// ============================================================
// STUDENT DASHBOARD
// ============================================================

router.get(
  '/dashboard',
  isAuthenticated,
  authorizeRoles('student'),
  async (req, res) => {

    try {

      const userId =
        req.session.user
          ? req.session.user.id
          : req.user.id;


      const studentUser =
        await User.findById(userId);


      if (!studentUser) {

        return res
          .status(404)
          .send('Student user profile not found.');

      }


      const studentRecord =
        await Student
          .findOne({
            userId: userId
          })
          .populate('userId');


      const attendanceRecords =
        await Attendance
          .find({
            studentId: studentRecord?._id
          })
          .sort({
            date: 1
          });


      const resultRecords =
        await Result
          .find({
            studentId: studentRecord?._id
          })
          .sort({
            semester: 1
          });



      // ======================================================
      // FACULTY FETCH
      // ======================================================

      let departmentFaculty = [];


      if (
        studentRecord &&
        studentRecord.department
      ) {

        departmentFaculty =
          await User.find({

            role: 'faculty',

            $or: [

              {
                assignedDepartment:
                  studentRecord.department
              },

              {
                department:
                  studentRecord.department
              }

            ]

          });

      }


      if (
        !departmentFaculty ||
        departmentFaculty.length === 0
      ) {

        departmentFaculty =
          await User.find({
            role: 'faculty'
          });

      }



      // ======================================================
      // NOTICES
      // ======================================================

      let notices = [];


      try {

        const Notice =
          require('../models/Notice');


        notices =
          await Notice
            .find()
            .sort({
              createdAt: -1
            })
            .limit(5);

      }

      catch (e) {

        notices = [

          {
            title:
              'Welcome to Student ERP',

            content:
              'Your portal is fully active and synchronized.',

            department:
              'Administration',

            createdAt:
              new Date()

          }

        ];

      }



      // ======================================================
      // CGPA
      // ======================================================

      let cgpa = '0.00';


      if (
        resultRecords &&
        resultRecords.length > 0
      ) {

        const totalGpa =
          resultRecords.reduce(
            (sum, r) =>
              sum + (Number(r.gpa) || 0),
            0
          );


        cgpa =
          (
            totalGpa /
            resultRecords.length
          ).toFixed(2);

      }



      // ======================================================
      // OVERALL ATTENDANCE
      // ======================================================

      let attendancePercentage = 0;


      if (
        attendanceRecords &&
        attendanceRecords.length > 0
      ) {

        const presentCount =
          attendanceRecords.filter(
            a => a.status === 'Present'
          ).length;


        attendancePercentage =
          Math.round(
            (
              presentCount /
              attendanceRecords.length
            ) * 100
          );

      }



      // ======================================================
      // ATTENDANCE SUMMARY
      // ======================================================

      const attendanceSummary = {

        total:
          attendanceRecords.length,

        present:
          attendanceRecords.filter(
            a => a.status === 'Present'
          ).length,

        absent:
          attendanceRecords.filter(
            a => a.status === 'Absent'
          ).length,

        late:
          attendanceRecords.filter(
            a => a.status === 'Late'
          ).length

      };



      // ======================================================
      // SEMESTER-WISE RESULTS
      // ======================================================

      const semesterResults =
        resultRecords.map(result => {

          const subjects =
            result.subjects.map(subject => {

              const marks =
                Number(subject.marksObtained) || 0;

              const maxMarks =
                Number(subject.maxMarks) || 100;


              const percentage =
                maxMarks > 0
                  ? (marks / maxMarks) * 100
                  : 0;


              return {

                subjectName:
                  subject.subjectName,

                marksObtained:
                  marks,

                maxMarks:
                  maxMarks,

                percentage:
                  percentage,

                grade:
                  calculateGrade(
                    marks,
                    maxMarks
                  )

              };

            });


          return {

            _id:
              result._id,

            semester:
              result.semester,

            gpa:
              Number(result.gpa) || 0,

            subjects:
              subjects

          };

        });



      // ======================================================
      // FEES
      // ======================================================

      const remainingFee =
        studentRecord?.remainingFee ||
        studentRecord?.feeDue ||
        0;



      // ======================================================
      // CREDITS
      // ======================================================

      const creditsEarned =
        studentRecord?.creditsEarned ||
        40;



      // ======================================================
      // RENDER
      // ======================================================

      res.render(
        'student/dashboard',
        {

          user:
            studentUser,

          student:
            studentRecord || {},

          attendance:
            attendanceRecords || [],

          attendanceHistory:
            attendanceRecords || [],

          attendanceSummary:
            attendanceSummary,

          results:
            resultRecords || [],

          semesterResults:
            semesterResults,

          faculty:
            departmentFaculty,

          assignedFaculty:
            departmentFaculty,

          faculties:
            departmentFaculty,

          notices:
            notices,

          cgpa:
            cgpa,

          attendancePercentage:
            attendancePercentage,

          remainingFee:
            remainingFee,

          creditsEarned:
            creditsEarned,

          message:
            req.query.message || null

        }
      );

    }

    catch (err) {

      console.error(
        'Student Dashboard Error:',
        err
      );


      res
        .status(500)
        .send(
          'Student Dashboard Error: ' +
          err.message
        );

    }

  }
);



// ============================================================
// DOWNLOAD RESULT FOR SPECIFIC SEMESTER
// ============================================================

router.get(
  '/download-result/:semester',
  isAuthenticated,
  authorizeRoles('student'),
  async (req, res) => {

    try {

      const userId =
        req.session.user
          ? req.session.user.id
          : req.user.id;


      const semester =
        Number(req.params.semester);


      if (
        !Number.isInteger(semester) ||
        semester <= 0
      ) {

        return res
          .status(400)
          .send('Invalid semester.');

      }



      const studentUser =
        await User.findById(userId);


      const studentRecord =
        await Student.findOne({
          userId: userId
        });


      if (!studentRecord) {

        return res
          .status(404)
          .send(
            'Student profile record not found.'
          );

      }



      const result =
        await Result.findOne({

          studentId:
            studentRecord._id,

          semester:
            semester

        });



      if (!result) {

        return res
          .status(404)
          .send(
            `Result for Semester ${semester} not found.`
          );

      }



      // ======================================================
      // PREPARE SUBJECT DATA
      // ======================================================

      const subjects =
        result.subjects.map(subject => {

          const marks =
            Number(subject.marksObtained) || 0;

          const maxMarks =
            Number(subject.maxMarks) || 100;


          const percentage =
            maxMarks > 0
              ? (marks / maxMarks) * 100
              : 0;


          return {

            subjectName:
              subject.subjectName,

            marks:
              marks,

            maxMarks:
              maxMarks,

            percentage:
              percentage,

            grade:
              calculateGrade(
                marks,
                maxMarks
              )

          };

        });



      // ======================================================
      // HTML RESULT
      // ======================================================

      const resultHtml = `

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
Semester ${semester} Result
</title>

<script src="https://cdn.tailwindcss.com"></script>

<style>

@media print {

  .print-button {
    display: none !important;
  }

  body {
    background: white !important;
  }

}

</style>

</head>


<body
class="bg-slate-950 text-slate-100 min-h-screen p-4 md:p-8"
>


<div
class="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
>


<!-- HEADER -->

<div
class="p-6 md:p-8 border-b border-slate-800"
>

<div
class="flex flex-col md:flex-row md:justify-between md:items-center gap-4"
>

<div>

<p
class="text-indigo-400 text-xs font-bold uppercase tracking-widest"
>
Student ERP
</p>

<h1
class="text-2xl md:text-3xl font-extrabold text-white mt-2"
>
Semester ${semester} Result
</h1>

<p
class="text-slate-400 text-sm mt-1"
>
Official Academic Result
</p>

</div>


<button
onclick="window.print()"
class="print-button bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
>
🖨 Print / Save PDF
</button>

</div>

</div>



<!-- STUDENT DETAILS -->

<div class="p-6">

<div
class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800 rounded-xl p-5"
>

<div>

<p class="text-xs text-slate-500">
Student Name
</p>

<p class="text-white font-bold mt-1">
${studentUser.name}
</p>

</div>


<div>

<p class="text-xs text-slate-500">
Email
</p>

<p class="text-white font-bold mt-1">
${studentUser.email}
</p>

</div>


<div>

<p class="text-xs text-slate-500">
Department
</p>

<p class="text-white font-bold mt-1">
${studentRecord.department || 'N/A'}
</p>

</div>


<div>

<p class="text-xs text-slate-500">
Roll Number
</p>

<p class="text-white font-bold mt-1">
${studentRecord.rollNumber || 'N/A'}
</p>

</div>

</div>

</div>



<!-- GPA -->

<div class="px-6 pb-6">

<div
class="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5"
>

<p class="text-sm text-slate-400">
Semester GPA
</p>

<p
class="text-4xl font-extrabold text-indigo-400 mt-1"
>
${Number(result.gpa).toFixed(2)}
</p>

</div>

</div>



<!-- SUBJECTS -->

<div class="px-6 pb-8">

<h2
class="text-lg font-bold text-white mb-4"
>
Subject-wise Performance
</h2>


<div
class="overflow-x-auto border border-slate-800 rounded-xl"
>

<table class="w-full text-sm">

<thead>

<tr
class="bg-slate-950 text-slate-400 text-xs uppercase"
>

<th class="text-left px-4 py-4">
Subject
</th>

<th class="text-center px-4 py-4">
Marks
</th>

<th class="text-center px-4 py-4">
Percentage
</th>

<th class="text-center px-4 py-4">
Grade
</th>

</tr>

</thead>


<tbody>

${subjects.map(subject => `

<tr
class="border-t border-slate-800"
>

<td
class="px-4 py-4 text-white font-medium"
>
${subject.subjectName}
</td>


<td
class="px-4 py-4 text-center text-slate-300"
>
${subject.marks} / ${subject.maxMarks}
</td>


<td
class="px-4 py-4 text-center text-slate-400"
>
${subject.percentage.toFixed(1)}%
</td>


<td
class="px-4 py-4 text-center font-bold"
>
${subject.grade}
</td>

</tr>

`).join('')}

</tbody>

</table>

</div>

</div>



<!-- FOOTER -->

<div
class="px-6 py-5 border-t border-slate-800 text-xs text-slate-500 text-center"
>

Generated securely via Student ERP

</div>


</div>

</body>

</html>

`;


      return res.send(resultHtml);

    }

    catch (err) {

      console.error(
        'Semester Result Download Error:',
        err
      );


      res
        .status(500)
        .send(
          'Semester Result Download Error: ' +
          err.message
        );

    }

  }
);



// ============================================================
// FACULTIES VIEW
// ============================================================

router.get(
  '/faculties',
  isAuthenticated,
  authorizeRoles('student'),
  async (req, res) => {

    try {

      const userId =
        req.session.user
          ? req.session.user.id
          : req.user.id;


      const studentUser =
        await User.findById(userId);


      const studentRecord =
        await Student.findOne({
          userId: userId
        });


      let departmentFaculty = [];


      if (
        studentRecord &&
        studentRecord.department
      ) {

        departmentFaculty =
          await User.find({

            role: 'faculty',

            $or: [

              {
                assignedDepartment:
                  studentRecord.department
              },

              {
                department:
                  studentRecord.department
              }

            ]

          });

      }


      if (
        !departmentFaculty ||
        departmentFaculty.length === 0
      ) {

        departmentFaculty =
          await User.find({
            role: 'faculty'
          });

      }


      res.render(
        'student/faculty',
        {

          user:
            studentUser,

          student:
            studentRecord || {},

          faculty:
            departmentFaculty,

          assignedFaculty:
            departmentFaculty,

          faculties:
            departmentFaculty,

          message:
            req.query.message || null

        }
      );

    }

    catch (err) {

      res
        .status(500)
        .send(
          'Student Faculties Error: ' +
          err.message
        );

    }

  }
);



// ============================================================
// EXISTING STUDENT REPORT DOWNLOAD
// ============================================================

router.get(
  '/download-report',
  isAuthenticated,
  authorizeRoles('student'),
  async (req, res) => {

    try {

      const userId =
        req.session.user
          ? req.session.user.id
          : req.user.id;


      const studentUser =
        await User.findById(userId);


      const studentRecord =
        await Student
          .findOne({
            userId: userId
          })
          .populate('userId');


      const attendanceRecords =
        await Attendance.find({
          studentId: studentRecord?._id
        });


      const resultRecords =
        await Result.find({
          studentId: studentRecord?._id
        });


      if (!studentRecord) {

        return res
          .status(404)
          .send(
            'Student profile record not found.'
          );

      }


      let cgpa = '0.00';


      if (
        resultRecords &&
        resultRecords.length > 0
      ) {

        const totalGpa =
          resultRecords.reduce(
            (sum, r) =>
              sum + (Number(r.gpa) || 0),
            0
          );


        cgpa =
          (
            totalGpa /
            resultRecords.length
          ).toFixed(2);

      }


      let attendancePercentage = 0;


      if (
        attendanceRecords &&
        attendanceRecords.length > 0
      ) {

        const presentCount =
          attendanceRecords.filter(
            a => a.status === 'Present'
          ).length;


        attendancePercentage =
          Math.round(
            (
              presentCount /
              attendanceRecords.length
            ) * 100
          );

      }


      const remainingFee =
        studentRecord?.remainingFee ||
        studentRecord?.feeDue ||
        0;


      const creditsEarned =
        studentRecord?.creditsEarned ||
        40;


      const reportHtml = `

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<title>
Academic Report - ${studentUser.name}
</title>

<script src="https://cdn.tailwindcss.com"></script>

</head>


<body
class="bg-slate-950 text-slate-100 p-8 font-sans"
>

<div
class="max-w-3xl mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6"
>


<div
class="flex justify-between items-center border-b border-slate-800 pb-4"
>

<div>

<h1
class="text-2xl font-bold text-white"
>
Student Academic Report
</h1>

<p
class="text-sm text-slate-400"
>
Official Student ERP Generated Summary
</p>

</div>


<button
onclick="window.print()"
class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition print:hidden"
>
Print / Save PDF
</button>

</div>



<div
class="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 text-sm"
>

<div>

<p class="text-slate-400">
Student Name
</p>

<p class="font-semibold text-white text-base">
${studentUser.name}
</p>

</div>


<div>

<p class="text-slate-400">
Email Address
</p>

<p class="font-semibold text-white text-base">
${studentUser.email}
</p>

</div>


<div>

<p class="text-slate-400">
Department
</p>

<p class="font-semibold text-white text-base">
${studentRecord.department || 'N/A'}
</p>

</div>


<div>

<p class="text-slate-400">
Roll Number
</p>

<p class="font-semibold text-white text-base">
${studentRecord.rollNumber || 'N/A'}
</p>

</div>

</div>



<div>

<h2
class="text-lg font-bold text-white mb-2"
>
Performance Overview
</h2>


<div
class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"
>


<div
class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50"
>

<p class="text-sm text-slate-400">
CGPA
</p>

<p
class="text-xl font-bold text-purple-400 mt-1"
>
${cgpa} / 10.0
</p>

</div>


<div
class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50"
>

<p class="text-sm text-slate-400">
Attendance
</p>

<p
class="text-xl font-bold text-blue-400 mt-1"
>
${attendancePercentage}%
</p>

</div>


<div
class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50"
>

<p class="text-sm text-slate-400">
Credits Earned
</p>

<p
class="text-xl font-bold text-indigo-400 mt-1"
>
${creditsEarned} / 160
</p>

</div>


<div
class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50"
>

<p class="text-sm text-slate-400">
Fee Due
</p>

<p
class="text-xl font-bold text-amber-400 mt-1"
>
₹${remainingFee.toLocaleString()}
</p>

</div>


</div>

</div>



<div
class="pt-4 border-t border-slate-800 flex justify-between items-center print:hidden"
>

<a
href="/student/dashboard"
class="text-sm text-slate-400 hover:text-white transition"
>
&larr; Back to Dashboard
</a>

<span class="text-xs text-slate-500">
Generated securely via Student ERP
</span>

</div>


</div>

</body>

</html>

`;


      return res.send(reportHtml);

    }

    catch (err) {

      res
        .status(500)
        .send(
          'Download Report Error: ' +
          err.message
        );

    }

  }
);



module.exports = router;