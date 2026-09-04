
const PDFDocument = require('pdfkit');

function generateReportCardPDF(student, results, attendance, res) {
  const doc = new PDFDocument({ margin: 50 });

  // Set HTTP headers for file download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=ReportCard_${student.rollNumber || 'Student'}.pdf`
  );

  // Pipe PDF stream into the HTTP response
  doc.pipe(res);

  // Document Title Header
  doc.fontSize(20).text('OFFICIAL ACADEMIC REPORT CARD', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text('Integrated Campus ERP Management System', { align: 'center' });
  doc.moveDown(2);

  // Student Profile Details
  const studentName = student.userId ? student.userId.name : 'N/A';
  doc.fontSize(12).text(`Student Name: ${studentName}`);
  doc.text(`Roll Number: ${student.rollNumber || 'N/A'}`);
  doc.text(`Department: ${student.department || 'N/A'}`);
  doc.text(`Current Semester: ${student.semester || 'N/A'}`);
  doc.text(`Fee Payment Status: ${student.feeDetails ? student.feeDetails.status : 'N/A'}`);
  doc.moveDown();

  doc.text('--------------------------------------------------------------------------------------------------');
  doc.moveDown();

  // Academic Scorecard Section
  doc.fontSize(14).text('Semester Academic Results', { underline: true });
  doc.moveDown(0.5);

  if (results && results.length > 0) {
    results.forEach(resItem => {
      doc.fontSize(11).text(`Semester ${resItem.semester} - GPA: ${resItem.gpa}`);
      if (resItem.subjects && resItem.subjects.length > 0) {
        resItem.subjects.forEach(sub => {
          doc.fontSize(10).text(`   - ${sub.subjectName}: ${sub.marksObtained} / ${sub.maxMarks}`);
        });
      }
      doc.moveDown(0.5);
    });
  } else {
    doc.fontSize(10).text('No examination results recorded yet.');
  }

  // Finalize document stream
  doc.end();
}

module.exports = generateReportCardPDF;