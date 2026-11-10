const PDFDocument = require('pdfkit');

const GREEN = '#006838';
const DARK = '#1a1a1a';
const GRAY = '#666666';

function branding() {
  return {
    name: process.env.PDF_UNIVERSITY_NAME || 'NOVASTRA UNIVERSITY',
    address: process.env.PDF_UNIVERSITY_ADDRESS || 'Main Campus · Office of the Registrar · www.novastra.edu.pk',
    logoPath: process.env.PDF_LOGO_PATH || '',
    signature: process.env.PDF_REGISTRAR_SIGNATURE || 'Registrar / Director Student Affairs',
  };
}

function header(doc, subtitle) {
  const brand = branding();
  doc.rect(40, 40, doc.page.width - 80, 64).fillAndStroke(GREEN, '#cccccc');
  if (brand.logoPath) {
    try { doc.image(brand.logoPath, 52, 49, { fit: [42, 42] }); } catch { /* optional deployment asset */ }
  }
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(16)
    .text(brand.name, 50, 52, { align: 'center', width: doc.page.width - 100 });
  doc.font('Helvetica').fontSize(10)
    .text(subtitle, 50, 76, { align: 'center', width: doc.page.width - 100 });
  doc.fill(GRAY).font('Helvetica').fontSize(8)
    .text(brand.address, 50, 112, { align: 'center', width: doc.page.width - 100 });
  doc.save().rotate(-35, { origin: [300, 420] }).fillColor('#e8f3ec').font('Helvetica-Bold').fontSize(42)
    .text(brand.name, 65, 390, { opacity: 0.18 }).restore();
}

function footer(doc, note) {
  doc.fill(GRAY).font('Helvetica').fontSize(8)
    .text(note, 50, doc.page.height - 70, { align: 'center', width: doc.page.width - 100 })
    .text(`Generated on ${new Date().toLocaleString()} via Novastra Portal`, 50, doc.page.height - 55, {
      align: 'center', width: doc.page.width - 100,
    });
}

function labeledRows(doc, rows, y) {
  let yy = y;
  doc.fontSize(10);
  for (const [label, value] of rows) {
    doc.fill(GRAY).font('Helvetica').text(label, 60, yy, { width: 170 });
    doc.fill(DARK).font('Helvetica-Bold').text(String(value ?? '—'), 240, yy, { width: 300 });
    yy += 17;
  }
  return yy;
}

function generateTranscriptPDF(res, { student, records, cgpa, totalCreditHours }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="transcript_${student.rollNumber}.pdf"`);
  doc.pipe(res);

  header(doc, 'OFFICIAL ACADEMIC TRANSCRIPT');

  let y = labeledRows(doc, [
    ['Student Name', student.name],
    ['Roll Number', student.rollNumber],
    ['Degree', student.degree],
    ['Department', student.department],
    ['Batch', student.batch],
  ], 130);

  y += 10;
  doc.fill(DARK).font('Helvetica-Bold').fontSize(11).text('Semester Performance', 60, y);
  y += 18;
  doc.moveTo(60, y).lineTo(doc.page.width - 60, y).strokeColor(GREEN).stroke();
  y += 8;

  const cols = [
    { label: 'Semester', x: 60, w: 70 },
    { label: 'Credit Hours', x: 140, w: 80 },
    { label: 'Grade Points', x: 230, w: 85 },
    { label: 'SGPA', x: 325, w: 60 },
    { label: 'CGPA', x: 400, w: 60 },
  ];
  doc.font('Helvetica-Bold').fontSize(9).fill(GRAY);
  for (const c of cols) doc.text(c.label, c.x, y, { width: c.w });
  y += 16;
  doc.moveTo(60, y).lineTo(doc.page.width - 60, y).strokeColor('#cccccc').stroke();
  y += 6;

  doc.font('Helvetica').fontSize(10).fill(DARK);
  for (const r of records) {
    const row = [
      `Semester ${r.semester}`,
      String(r.creditHours),
      String(r.totalPoints),
      r.sgpa.toFixed(2),
      r.cgpa.toFixed(2),
    ];
    cols.forEach((c, i) => doc.text(row[i], c.x, y, { width: c.w }));
    y += 18;
    doc.moveTo(60, y).lineTo(doc.page.width - 60, y).strokeColor('#eeeeee').stroke();
    y += 4;
  }

  y += 14;
  doc.rect(60, y, doc.page.width - 120, 46).fillAndStroke('#eef8f2', '#b1dfc5');
  doc.fill(DARK).font('Helvetica-Bold').fontSize(12)
    .text(`CGPA: ${cgpa.toFixed(2)}`, 75, y + 14, { width: 180 });
  doc.text(`Total Credit Hours: ${totalCreditHours}`, 270, y + 14, { width: 220 });

  y += 66;
  doc.fill(GRAY).font('Helvetica').fontSize(8)
    .text('Grading Scale: A=4.00, A-=3.67, B+=3.33, B=3.00, B-=2.67, C+=2.33, C=2.00, C-=1.67, D=1.00, F=0.00', 60, y);

  y += 40;
  doc.fill(DARK).font('Helvetica').fontSize(9)
    .text(branding().signature, 60, y)
    .text('Controller of Examinations', 340, y);
  doc.moveTo(60, y + 34).lineTo(230, y + 34).strokeColor(DARK).stroke();
  doc.moveTo(340, y + 34).lineTo(510, y + 34).strokeColor(DARK).stroke();

  footer(doc, 'This transcript is computer generated and valid without signature when verified through the portal.');
  doc.end();
}

function generateDomicilePDF(res, { student }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="domicile_${student.rollNumber}.pdf"`);
  doc.pipe(res);

  header(doc, 'STUDENT DOMICILE / BONAFIDE CERTIFICATE');

  doc.fill(DARK).font('Helvetica').fontSize(12)
    .text('THIS IS TO CERTIFY THAT', 60, 145, { align: 'center', width: doc.page.width - 120 });

  doc.font('Helvetica-Bold').fontSize(20).fill(GREEN)
    .text(student.name, 60, 175, { align: 'center', width: doc.page.width - 120 });

  doc.font('Helvetica').fontSize(11).fill(DARK)
    .text(
      `is a bonafide student of Novastra University, Main Campus, currently enrolled in the ${student.degree} program (${student.department}) under batch ${student.batch}, bearing Roll Number ${student.rollNumber}, and is studying in Semester ${student.currentSemester}.`,
      70,
      215,
      { align: 'center', width: doc.page.width - 140, lineGap: 4 }
    );

  let y = 310;
  y = labeledRows(doc, [
    ['Roll Number', student.rollNumber],
    ['Degree Program', student.degree],
    ['Department', student.department],
    ['Batch', student.batch],
    ['Current Semester', student.currentSemester],
    ['Guardian Name', student.guardianName],
    ['CNIC / B-Form', student.cnic],
    ['Permanent Address', student.address],
    ['Admission Date', student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : '—'],
  ], y);

  y += 30;
  doc.fill(DARK).font('Helvetica').fontSize(11)
    .text('This certificate is issued upon the student request for official purposes.', 70, y, {
      align: 'center', width: doc.page.width - 140,
    });

  y += 60;
  doc.font('Helvetica').fontSize(9)
    .text('Student Signature', 70, y, { width: 160 })
    .text(branding().signature, doc.page.width - 230, y, { width: 170 });
  doc.moveTo(70, y + 30).lineTo(230, y + 30).strokeColor(DARK).stroke();
  doc.moveTo(doc.page.width - 230, y + 30).lineTo(doc.page.width - 60, y + 30).strokeColor(DARK).stroke();

  footer(doc, 'Verify authenticity through the Novastra portal using the roll number printed above.');
  doc.end();
}

function generateAdmitCardPDF(res, { student, exams, type }) {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="admit_card_${student.rollNumber}_${String(type).toLowerCase()}.pdf"`);
  doc.pipe(res);

  // Branded security border and watermark make printed cards easy to identify.
  doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(2).strokeColor(GREEN).stroke();
  doc.save().rotate(-35, { origin: [300, 420] }).fillColor('#e8f3ec').font('Helvetica-Bold').fontSize(52)
    .text('NOVASTRA', 50, 390, { opacity: 0.45 }).restore();
  header(doc, `${type === 'FINAL' ? 'FINAL' : 'MID-TERM'} EXAMINATION ADMIT CARD`);

  doc.fill(DARK).font('Helvetica-Bold').fontSize(13).text('Candidate Information', 58, 145);
  doc.moveTo(58, 164).lineTo(537, 164).strokeColor(GREEN).stroke();
  const photoX = 450;
  doc.roundedRect(photoX, 178, 86, 106, 4).lineWidth(1).strokeColor('#b7c6bb').stroke();
  doc.fill(GRAY).font('Helvetica').fontSize(8).text('PHOTO', photoX, 228, { width: 86, align: 'center' });
  labeledRows(doc, [
    ['Name', student.name],
    ['Roll Number', student.rollNumber],
    ['Degree / Semester', `${student.degree} / ${student.currentSemester}`],
    ['Department', student.department],
    ['Batch', student.batch],
  ], 180);

  let y = 320;
  doc.fill(DARK).font('Helvetica-Bold').fontSize(13).text('Examination Schedule', 58, y);
  y += 18;
  doc.font('Helvetica-Bold').fontSize(9).fill(GRAY);
  doc.text('COURSE', 58, y).text('DATE & TIME', 190, y).text('ROOM', 405, y);
  y += 14;
  doc.moveTo(58, y).lineTo(537, y).strokeColor(GREEN).stroke();
  y += 8;
  for (const exam of exams || []) {
    if (y > 625) { doc.addPage(); y = 65; }
    doc.fill(DARK).font('Helvetica-Bold').fontSize(9).text(exam.section?.course?.courseCode || '—', 58, y);
    doc.font('Helvetica').text(exam.section?.course?.title || 'Course', 58, y + 13, { width: 120 });
    doc.text(`${new Date(exam.date).toLocaleDateString()} · ${exam.startTime}–${exam.endTime}`, 190, y + 5, { width: 200 });
    doc.text(exam.room || 'TBA', 405, y + 5, { width: 100 });
    y += 36;
    doc.moveTo(58, y - 8).lineTo(537, y - 8).strokeColor('#eeeeee').stroke();
  }
  y += 12;
  doc.fill(DARK).font('Helvetica-Bold').fontSize(11).text('Important Instructions', 58, y);
  doc.font('Helvetica').fontSize(9).fill(GRAY)
    .list([
      'Bring this admit card and your valid university identity card.',
      'Arrive at least 30 minutes before the scheduled start time.',
      'Mobile phones, smart watches and unauthorized material are prohibited.',
      'The admit card is valid only for the examination type and schedule printed above.',
    ], 68, y + 18, { bulletRadius: 1.5, textIndent: 14, lineGap: 4 });
  footer(doc, 'This admit card is computer generated. Any alteration invalidates the document.');
  doc.end();
}

module.exports = { generateTranscriptPDF, generateDomicilePDF, generateAdmitCardPDF };
