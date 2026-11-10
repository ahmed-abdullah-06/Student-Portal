const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function generateChallanPDF(res, { challan, student, structure, semester }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const filename = `challan_${challan.voucherId}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const green = '#006838';
  const dark = '#1a1a1a';
  const gray = '#666666';

  doc.rect(40, 40, doc.page.width - 80, 70).fillAndStroke(green, '#cccccc');
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(18)
    .text('NOVASTRA UNIVERSITY', 50, 52, { align: 'center', width: doc.page.width - 100 });
  doc.font('Helvetica').fontSize(11)
    .text('Fee Voucher — Novastra Portal', 50, 76, { align: 'center', width: doc.page.width - 100 });

  doc.fill(gray).font('Helvetica').fontSize(9)
    .text('Campus: Main Campus  |  Contact: (051) 111-000-111', 50, 116, { align: 'center', width: doc.page.width - 100 });

  doc.moveDown(2);
  doc.fill(dark).font('Helvetica-Bold').fontSize(12).text('Student Information', 50, 150);
  doc.moveTo(50, 170).lineTo(doc.page.width - 50, 170).strokeColor(green).stroke();

  const info = [
    ['Student Name', student.name],
    ['Roll Number', student.rollNumber],
    ['Department', student.department],
    ['Batch', student.batch],
    ['Semester', String(semester)],
    ['Voucher No.', challan.voucherId],
    ['Due Date', challan.dueDate.toISOString().slice(0, 10)],
  ];
  let y = 184;
  doc.font('Helvetica').fontSize(10);
  for (const [label, value] of info) {
    doc.fill(gray).text(label, 50, y, { width: 160 });
    doc.fill(dark).text(String(value ?? '-'), 220, y, { width: 300 });
    y += 18;
  }

  y += 14;
  doc.font('Helvetica-Bold').fontSize(12).fill(dark).text('Fee Breakdown', 50, y);
  y += 14;
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(green).stroke();
  y += 10;

  const rows = [
    [`Tuition Fee (${challan.creditHours} Cr. Hrs × Rs. ${structure.perCreditHour})`, challan.creditHours * structure.perCreditHour],
    ['Laboratory Fee', structure.labFee],
    ['Library Fee', structure.libraryFee],
    ['Other Charges', structure.otherFee],
  ];

  doc.font('Helvetica').fontSize(10);
  for (const [label, amount] of rows) {
    doc.fill(gray).text(label, 60, y, { width: 350 });
    doc.fill(dark).text(`Rs. ${Number(amount).toLocaleString()}`, 420, y, { width: 120, align: 'right' });
    y += 18;
  }

  y += 6;
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#cccccc').stroke();
  y += 10;
  doc.font('Helvetica-Bold').fontSize(12);
  doc.fill(gray).text('Total Payable', 60, y, { width: 300 });
  doc.fill(green).text(`Rs. ${Number(challan.totalAmount).toLocaleString()}`, 400, y, { width: 140, align: 'right' });

  y += 40;
  doc.font('Helvetica-Bold').fontSize(11).fill(dark)
    .text(`Status: ${challan.status}`, 60, y);
  if (challan.status === 'PAID' && challan.paidAt) {
    doc.fill(green).text(`  Paid on: ${challan.paidAt.toISOString().slice(0, 10)}`, 200, y);
  }

  doc.fill(gray).font('Helvetica').fontSize(8)
    .text(
      'This is a computer generated fee voucher. Pay at any HBL branch using the voucher number above. Do not pay after the due date without contacting the accounts office.',
      50,
      doc.page.height - 90,
      { align: 'center', width: doc.page.width - 100 }
    );

  doc.end();
}

module.exports = { generateChallanPDF };
