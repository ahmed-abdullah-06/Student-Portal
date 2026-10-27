require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma');
const {
  computeWeightedPercentage,
  gradeFromPercentage,
  round2,
} = require('../src/utils/gpaCalculator');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const CURRENT_YEAR = 2026;
const CURRENT_SEMESTER = 5;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('Refusing to seed demo data with NODE_ENV=production.');
    console.error('Production onboarding uses: npm run bootstrap && npm run tenants -- create ...');
    console.error('To override for a staged demo environment: ALLOW_DEMO_SEED=true npm run seed');
    process.exit(1);
  }
  console.log('Seeding database...');

  // All seed data belongs to the default tenant.
  await prisma.tenant.upsert({
    where: { id: 'default' },
    create: { id: 'default', slug: 'default', name: 'Novastra University' },
    update: {},
  });

  // Platform (SaaS operator) account for the platform console at /platform.
  await prisma.platformAdmin.upsert({
    where: { email: 'platform@novastra.edu.pk' },
    update: {},
    create: {
      email: 'platform@novastra.edu.pk',
      password: await bcrypt.hash('platform123', 12),
      name: 'Platform Operator',
    },
  });

  await prisma.$transaction([
prisma.attendanceRecord.deleteMany({ where: { tenantId: 'default' } }),
  prisma.teacherEvaluation.deleteMany({ where: { tenantId: 'default' } }),
  prisma.enrollment.deleteMany({ where: { tenantId: 'default' } }),
  prisma.timetableSlot.deleteMany({ where: { tenantId: 'default' } }),
  prisma.section.deleteMany({ where: { tenantId: 'default' } }),
  prisma.semesterRecord.deleteMany({ where: { tenantId: 'default' } }),
  prisma.payment.deleteMany({ where: { tenantId: 'default' } }),
  prisma.feeChallan.deleteMany({ where: { tenantId: 'default' } }),
  prisma.notification.deleteMany({ where: { tenantId: 'default' } }),
  prisma.chatMessage.deleteMany({ where: { tenantId: 'default' } }),
  prisma.libraryIssue.deleteMany({ where: { tenantId: 'default' } }),
  prisma.libraryBook.deleteMany({ where: { tenantId: 'default' } }),
  prisma.hostelAllocation.deleteMany({ where: { tenantId: 'default' } }),
  prisma.transportAllocation.deleteMany({ where: { tenantId: 'default' } }),
  prisma.transportRoute.deleteMany({ where: { tenantId: 'default' } }),
  prisma.notice.deleteMany({ where: { tenantId: 'default' } }),
  prisma.auditLog.deleteMany({ where: { tenantId: 'default' } }),
  prisma.course.deleteMany({ where: { tenantId: 'default' } }),
  prisma.feeStructure.deleteMany({ where: { tenantId: 'default' } }),
  prisma.student.deleteMany({ where: { tenantId: 'default' } }),
  prisma.faculty.deleteMany({ where: { tenantId: 'default' } }),
  prisma.user.deleteMany({ where: { tenantId: 'default' } }),
  ]);

  const hash = (pw) => bcrypt.hash(pw, 12);

  // ---------- Users ----------
  const admin = await prisma.user.create({
    data: {
      email: 'admin@novastra.edu.pk',
      password: await hash('admin123'),
      role: 'ADMIN',
    },
  });

  const facultyData = [
    { email: 'ali.khan@novastra.edu.pk', employeeId: 'FAC-001', name: 'Dr. Ali Khan', designation: 'Professor', department: 'BSCS' },
    { email: 'sana.malik@novastra.edu.pk', employeeId: 'FAC-002', name: 'Sana Malik', designation: 'Assistant Professor', department: 'BSCS' },
    { email: 'usman.tariq@novastra.edu.pk', employeeId: 'FAC-003', name: 'Dr. Usman Tariq', designation: 'Associate Professor', department: 'BSSE' },
  ];

  const faculty = [];
  for (const f of facultyData) {
    const user = await prisma.user.create({
      data: { email: f.email, password: await hash('faculty123'), role: 'FACULTY' },
    });
    faculty.push(await prisma.faculty.create({
      data: {
        userId: user.id, employeeId: f.employeeId, name: f.name,
        designation: f.designation, department: f.department, phone: '0300-0000000',
      },
    }));
  }

  const studentData = [
    ['SP23-BSCS-001', 'Ahmed Raza'], ['SP23-BSCS-002', 'Fatima Noor'],
    ['SP23-BSCS-003', 'Bilal Hussain'], ['SP23-BSCS-004', 'Ayesha Siddiqui'],
    ['SP23-BSCS-005', 'Hassan Ali'], ['SP23-BSCS-006', 'Zainab Fatima'],
    ['SP23-BSCS-007', 'Omar Farooq'], ['SP23-BSCS-008', 'Maryam Khan'],
    ['SP23-BSCS-009', 'Usman Ghani'], ['SP23-BSCS-010', 'Hira Aslam'],
  ];

  const students = [];
  for (const [rollNo, name] of studentData) {
    const user = await prisma.user.create({
      data: {
        email: `${rollNo.toLowerCase()}@student.novastra.edu.pk`,
        password: await hash('student123'),
        role: 'STUDENT',
      },
    });
    students.push(await prisma.student.create({
      data: {
        userId: user.id,
        rollNumber: rollNo,
        name,
        department: 'BSCS',
        degree: 'BS Computer Science',
        batch: 'SP23',
        currentSemester: CURRENT_SEMESTER,
        cnic: `35202-${rand(1000000, 9999999)}-${rand(1, 9)}`,
        guardianName: pick(['Muhammad Aslam', 'Naveed Ahmed', 'Rashida Bibi', 'Khalid Mehmood', 'Saima Parveen']),
        phone: `03${rand(11, 33)}-${rand(1000000, 9999999)}`,
        address: 'Wah Cantt, Rawalpindi',
        admissionDate: new Date('2023-08-15'),
      },
    }));
  }

  // ---------- Courses ----------
  const courses = {};
  const courseDefs = [
    { courseCode: 'CS-101', title: 'Programming Fundamentals', creditHours: 3, department: 'BSCS', prereqs: [] },
    { courseCode: 'CS-151', title: 'Object Oriented Programming', creditHours: 3, department: 'BSCS', prereqs: ['CS-101'] },
    { courseCode: 'CS-201', title: 'Data Structures & Algorithms', creditHours: 3, department: 'BSCS', prereqs: ['CS-151'] },
    { courseCode: 'CS-250', title: 'Database Systems', creditHours: 3, department: 'BSCS', prereqs: ['CS-151'] },
    { courseCode: 'CS-300', title: 'Operating Systems', creditHours: 3, department: 'BSCS', prereqs: ['CS-201'] },
    { courseCode: 'CS-350', title: 'Computer Networks', creditHours: 3, department: 'BSCS', prereqs: ['CS-201'] },
    { courseCode: 'MTH-101', title: 'Calculus & Analytical Geometry', creditHours: 3, department: 'COMMON', prereqs: [] },
    { courseCode: 'MTH-201', title: 'Numerical Methods', creditHours: 3, department: 'COMMON', prereqs: ['MTH-101'] },
    { courseCode: 'ENG-101', title: 'Technical English', creditHours: 2, department: 'COMMON', prereqs: [] },
    { courseCode: 'CS-310', title: 'Automata Theory & Computability', creditHours: 3, department: 'BSCS', prereqs: ['CS-201'] },
    { courseCode: 'CS-370', title: 'Software Engineering', creditHours: 3, department: 'BSCS', prereqs: ['CS-151'] },
    { courseCode: 'CS-401', title: 'Machine Learning', creditHours: 3, department: 'BSCS', prereqs: ['CS-201', 'MTH-201'] },
    { courseCode: 'CS-420', title: 'Web Engineering', creditHours: 3, department: 'BSCS', prereqs: ['CS-151'] },
    { courseCode: 'MTH-301', title: 'Linear Algebra', creditHours: 3, department: 'COMMON', prereqs: ['MTH-101'] },
    { courseCode: 'PHY-101', title: 'Applied Physics', creditHours: 3, department: 'COMMON', prereqs: [] },
  ];

  for (const c of courseDefs) {
    courses[c.courseCode] = await prisma.course.create({
      data: {
        courseCode: c.courseCode,
        title: c.title,
        creditHours: c.creditHours,
        department: c.department,
        description: c.title,
        prerequisites: { connect: c.prereqs.map((p) => ({ tenantId_courseCode: { tenantId: 'default', courseCode: p } })) },
      },
    });
  }

  // ---------- Sections (current semester) ----------
  const sectionDefs = [
    { code: 'CS-300', name: 'A', facultyIdx: 0, slots: [{ day: 'Monday', startTime: '09:00', endTime: '10:20', room: 'W-201' }, { day: 'Wednesday', startTime: '09:00', endTime: '10:20', room: 'W-201' }] },
    { code: 'CS-350', name: 'A', facultyIdx: 2, slots: [{ day: 'Tuesday', startTime: '11:00', endTime: '12:20', room: 'W-203' }, { day: 'Thursday', startTime: '11:00', endTime: '12:20', room: 'W-203' }] },
    { code: 'CS-250', name: 'A', facultyIdx: 1, slots: [{ day: 'Monday', startTime: '11:00', endTime: '12:20', room: 'Lab-1' }, { day: 'Friday', startTime: '09:00', endTime: '10:20', room: 'Lab-1' }] },
    { code: 'MTH-201', name: 'A', facultyIdx: 1, slots: [{ day: 'Tuesday', startTime: '09:00', endTime: '10:20', room: 'W-105' }] },
    { code: 'ENG-101', name: 'A', facultyIdx: 2, slots: [{ day: 'Thursday', startTime: '14:00', endTime: '15:20', room: 'W-110' }] },
  ];

  const sections = {};
  for (const s of sectionDefs) {
    const section = await prisma.section.create({
      data: {
        courseId: courses[s.code].id,
        facultyId: faculty[s.facultyIdx].id,
        name: s.name,
        semester: CURRENT_SEMESTER,
        year: CURRENT_YEAR,
        capacity: 60,
      },
    });
    await prisma.timetableSlot.createMany({
      data: s.slots.map((sl) => ({ sectionId: section.id, ...sl })),
    });
    sections[s.code] = section;
  }

  // ---------- Extra sections (not enrolled by seed students) ----------
  const extraSectionDefs = [
    { code: 'CS-310', name: 'A', facultyIdx: 1, semester: CURRENT_SEMESTER, year: CURRENT_YEAR, slots: [{ day: 'Wednesday', startTime: '11:00', endTime: '12:20', room: 'W-205' }] },
    { code: 'CS-370', name: 'A', facultyIdx: 2, semester: CURRENT_SEMESTER, year: CURRENT_YEAR, slots: [{ day: 'Tuesday', startTime: '14:00', endTime: '15:20', room: 'W-207' }] },
    { code: 'CS-420', name: 'A', facultyIdx: 0, semester: CURRENT_SEMESTER, year: CURRENT_YEAR, slots: [{ day: 'Thursday', startTime: '09:00', endTime: '10:20', room: 'Lab-2' }] },
    { code: 'CS-401', name: 'A', facultyIdx: 1, semester: CURRENT_SEMESTER, year: CURRENT_YEAR, slots: [{ day: 'Friday', startTime: '11:00', endTime: '12:20', room: 'Lab-3' }] },
    { code: 'CS-201', name: 'A', facultyIdx: 0, semester: 3, year: 2025, slots: [{ day: 'Monday', startTime: '13:00', endTime: '14:20', room: 'W-101' }] },
    { code: 'MTH-101', name: 'A', facultyIdx: 1, semester: 3, year: 2025, slots: [{ day: 'Wednesday', startTime: '15:30', endTime: '16:50', room: 'W-103' }] },
  ];

  for (const s of extraSectionDefs) {
    const section = await prisma.section.create({
      data: {
        courseId: courses[s.code].id,
        facultyId: faculty[s.facultyIdx].id,
        name: s.name,
        semester: s.semester,
        year: s.year,
        capacity: 50,
      },
    });
    await prisma.timetableSlot.createMany({
      data: s.slots.map((sl) => ({ sectionId: section.id, ...sl })),
    });
  }

  // ---------- Enrollments (all 10 students in 5 courses = 14 cr hrs) ----------
  const enrollments = [];
  for (const student of students) {
    for (const s of sectionDefs) {
      enrollments.push(
        await prisma.enrollment.create({
          data: {
            studentId: student.id,
            sectionId: sections[s.code].id,
            semester: CURRENT_SEMESTER,
            year: CURRENT_YEAR,
            status: 'REGISTERED',
          },
        })
      );
    }
  }

  // ---------- Attendance: 18 lectures, 68-100% per student ----------
  const lectureDates = Array.from({ length: 18 }, (_, i) => new Date(2026, 8, 7 + i * 2)); // alternate days from Sep 7
  for (const student of students) {
    const pct = rand(68, 100);
    const absences = Math.round((100 - pct) / 100 * 18);
    const absentSet = new Set();
    while (absentSet.size < absences) absentSet.add(rand(0, 17));
    const studentEnrollments = enrollments.filter(
      (e) => e.studentId === student.id
    );
    for (const e of studentEnrollments) {
      for (let i = 0; i < 18; i++) {
        await prisma.attendanceRecord.create({
          data: {
            enrollmentId: e.id,
            date: lectureDates[i],
            lectureNumber: i + 1,
            status: absentSet.has(i) ? 'ABSENT' : 'PRESENT',
          },
        });
      }
    }
  }

  // ---------- Marks: all components entered; one section frozen ----------
  for (const e of enrollments) {
    const marks = {
      assignments: rand(50, 98),
      quizzes: rand(45, 96),
      midterms: rand(42, 94),
      finals: rand(48, 97),
    };
    const total = round2(computeWeightedPercentage(marks));
    const { letter, points } = gradeFromPercentage(total);
    await prisma.enrollment.update({
      where: { id: e.id },
      data: { ...marks, totalMarks: total, gradeLetter: letter, gradePoints: points },
    });
  }
  const lockedEnrollments = enrollments.filter((e) => e.sectionId === sections['MTH-201'].id);
  await prisma.enrollment.updateMany({
    where: { id: { in: lockedEnrollments.map((e) => e.id) } },
    data: { isLocked: true },
  });

  // ---------- Historical semester records (sem 1-4) ----------
  let totalPoints = 0;
  let totalCredits = 0;
  for (let sem = 1; sem <= 4; sem++) {
    const crHrs = sem === 4 ? 14 : 16;
    const sgpa = round2(rand(260, 385) / 100);
    totalPoints += crHrs * sgpa;
    totalCredits += crHrs;
    await prisma.semesterRecord.create({
      data: {
        studentId: students[0].id,
        semester: sem,
        sgpa,
        cgpa: round2(totalPoints / totalCredits),
        creditHours: crHrs,
        totalPoints: round2(crHrs * sgpa),
      },
    });
  }
  for (const student of students.slice(1)) {
    let pts = 0;
    let crs = 0;
    for (let sem = 1; sem <= 4; sem++) {
      const crHrs = sem === 4 ? 14 : 16;
      const sgpa = round2(rand(245, 390) / 100);
      pts += crHrs * sgpa;
      crs += crHrs;
      await prisma.semesterRecord.create({
        data: {
          studentId: student.id,
          semester: sem,
          sgpa,
          cgpa: round2(pts / crs),
          creditHours: crHrs,
          totalPoints: round2(crHrs * sgpa),
        },
      });
    }
  }

  // ---------- Fee structures & challans ----------
  for (let sem = 1; sem <= CURRENT_SEMESTER; sem++) {
    await prisma.feeStructure.create({
      data: {
        semester: sem,
        perCreditHour: 21500,
        labFee: 6000,
        libraryFee: 3000,
        admissionFee: sem === 1 ? 25000 : 0,
        otherFee: 1500,
      },
    });
  }

  const structure = await prisma.feeStructure.findFirst({ where: { semester: CURRENT_SEMESTER } });
  for (const student of students) {
    const crHrs = 14;
    const total = crHrs * structure.perCreditHour + structure.labFee + structure.libraryFee + structure.otherFee;
    const paid = Math.random() < 0.5;
    await prisma.feeChallan.create({
      data: {
        studentId: student.id,
        semester: CURRENT_SEMESTER,
        voucherId: `VCH-5-${student.rollNumber}-A1`,
        creditHours: crHrs,
        totalAmount: total,
        dueDate: new Date('2026-10-30'),
        status: paid ? 'PAID' : 'UNPAID',
        paidAt: paid ? new Date('2026-10-05') : null,
      },
    });
    await prisma.feeChallan.create({
      data: {
        studentId: student.id,
        semester: 4,
        voucherId: `VCH-4-${student.rollNumber}-P1`,
        creditHours: 14,
        totalAmount: total,
        dueDate: new Date('2026-03-15'),
        status: 'PAID',
        paidAt: new Date('2026-03-10'),
      },
    });
  }

  // ---------- Notices ----------
  await prisma.notice.createMany({
    data: [
      { title: 'Midterm Examinations Fall 2026', body: 'Midterm exams will commence from 16th November 2026. Date sheet is available on the examination portal. Students with attendance below 75% will not be allowed to appear.', authorId: admin.id },
      { title: 'Fee Submission Deadline', body: 'Last date for submission of fee for Fall 2026 is 30th October 2026. Late fee of Rs. 500 per day will be charged after the due date.', authorId: admin.id },
      { title: 'Course Registration Closes', body: 'Add/Drop period for semester 5 ends on 25th October 2026. Students must complete teacher evaluations before final result declaration.', authorId: admin.id },
    ],
  });

  // ---------- Teacher evaluations (3 students done) ----------
  for (const student of students.slice(0, 3)) {
    const enr = enrollments.find(
      (e) => e.studentId === student.id && e.sectionId === sections['CS-300'].id
    );
    await prisma.teacherEvaluation.create({
      data: {
        studentId: student.id,
        sectionId: enr.sectionId,
        punctuality: rand(3, 5),
        knowledge: rand(3, 5),
        communication: rand(3, 5),
        helpfulness: rand(3, 5),
        overall: rand(3, 5),
        feedback: pick(['Excellent lecturer', 'Needs more examples', 'Very cooperative', null]),
      },
    });
  }

  // ---------- Notifications (broadcast + personal) ----------
  await prisma.notification.createMany({
    data: [
      { userId: null, title: 'Fee Challan Generated', body: 'Your semester 5 fee challan is ready. Submit by 30th October 2026 to avoid late fee.', type: 'ALERT', link: '/student/challans' },
      { userId: null, title: 'Midterm Date Sheet Released', body: 'The Fall 2026 midterm date sheet has been published in Announcements.', type: 'INFO', link: '/student' },
      { userId: null, title: 'Library: New Arrivals', body: '12 new titles added to the central library including AI and distributed systems collections.', type: 'INFO', link: '/student/library' },
      { userId: students[0].userId, title: 'Attendance Shortage Warning', body: 'Your attendance in one or more courses is below the 75% requirement. Regular attendance is mandatory.', type: 'ALERT', link: '/student/attendance' },
      { userId: faculty[0].userId, title: 'Marks Submission Reminder', body: 'Midterm marks for CS-300 must be finalized before 20th November 2026.', type: 'INFO', link: '/faculty/marks' },
    ],
  });

  // ---------- Library ----------
  const books = [
    ['Introduction to Algorithms', 'Cormen et al.', '978-0262033848', 'Computer Science', 5],
    ['Operating System Concepts', 'Silberschatz', '978-1119320913', 'Computer Science', 4],
    ['Computer Networking: Top-Down', 'Kurose & Ross', '978-0134522203', 'Computer Science', 3],
    ['Database System Concepts', 'Silberschatz', '978-0078022159', 'Computer Science', 4],
    ['Clean Code', 'Robert C. Martin', '978-0132350884', 'Software Engineering', 6],
    ['Design Patterns', 'Gang of Four', '978-0201633610', 'Software Engineering', 3],
    ['Artificial Intelligence: A Modern Approach', 'Russell & Norvig', '978-0134610993', 'AI', 4],
    ['Linear Algebra and Its Applications', 'Lay', '978-0321982384', 'Mathematics', 3],
    ['Technical Writing for Engineers', 'Sperandio', '978-1119498506', 'General', 5],
    ['The Pragmatic Programmer', 'Hunt & Thomas', '978-0135957059', 'Software Engineering', 5],
  ];
  const bookRecords = [];
  for (const [title, author, isbn, category, copies] of books) {
    bookRecords.push(
      await prisma.libraryBook.create({
        data: { title, author, isbn, category, copiesTotal: copies, copiesAvailable: copies },
      })
    );
  }

  const issueDefs = [
    { book: 0, student: 0, returned: false },
    { book: 2, student: 1, returned: false },
    { book: 6, student: 3, returned: false },
    { book: 4, student: 5, returned: true },
    { book: 9, student: 7, returned: false },
  ];
  for (const d of issueDefs) {
    const issued = !d.returned;
    await prisma.libraryIssue.create({
      data: {
        bookId: bookRecords[d.book].id,
        studentId: students[d.student].id,
        issueDate: new Date('2026-09-20'),
        dueDate: new Date(issued ? '2026-11-05' : '2026-10-10'),
        returnDate: issued ? null : new Date('2026-10-08'),
        status: issued ? 'ISSUED' : 'RETURNED',
        fine: issued ? 0 : 0,
      },
    });
    if (issued) {
      await prisma.libraryBook.update({
        where: { id: bookRecords[d.book].id },
        data: { copiesAvailable: { decrement: 1 } },
      });
    }
  }

  // ---------- Hostel ----------
  const hostelDefs = [
    { student: 0, block: 'Hostel-A', room: 'A-101' },
    { student: 2, block: 'Hostel-A', room: 'A-104' },
    { student: 4, block: 'Hostel-B', room: 'B-210' },
    { student: 6, block: 'Hostel-C', room: 'C-305' },
    { student: 8, block: 'Hostel-B', room: 'B-212' },
  ];
  for (const h of hostelDefs) {
    await prisma.hostelAllocation.create({
      data: {
        studentId: students[h.student].id,
        block: h.block,
        roomNo: h.room,
        messCharges: 18000,
        status: 'ACTIVE',
      },
    });
  }

  // ---------- Transport ----------
  const routes = [
    { name: 'Route 1 — Rawalpindi City', stops: 'Cash & Carry, Bank Road, Chandni Chowk, University Gate', vehicleNo: 'ICT-4521', fare: 6500 },
    { name: 'Route 2 — Islamabad Expressway', stops: 'Faizabad, Koral, Simly Dam Road, Wah Gate', vehicleNo: 'ICT-4522', fare: 7500 },
    { name: 'Route 3 — Taxila / GT Road', stops: 'Taxila Chowk, Hassan Abdal, Risky Stop, Campus', vehicleNo: 'ICT-4523', fare: 5500 },
    { name: 'Route 4 — Wah Cantt (Internal)', stops: 'DB Road, University Chowk, Main Gate', vehicleNo: 'ICT-4524', fare: 3000 },
  ];
  const routeRecords = [];
  for (const r of routes) routeRecords.push(await prisma.transportRoute.create({ data: r }));

  const transportDefs = [
    { student: 1, route: 0 },
    { student: 3, route: 1 },
    { student: 5, route: 1 },
    { student: 7, route: 2 },
    { student: 9, route: 3 },
  ];
  for (const t of transportDefs) {
    await prisma.transportAllocation.create({
      data: { routeId: routeRecords[t.route].id, studentId: students[t.student].id, status: 'ACTIVE' },
    });
  }

  // ---------- Chat ----------
  await prisma.chatMessage.createMany({
    data: [
      { senderId: students[0].userId, receiverId: faculty[0].userId, body: 'Assalam-o-Alaikum sir, I wanted to ask about the OS midterm syllabus — does it include chapters 1–5 only?', readAt: new Date() },
      { senderId: faculty[0].userId, receiverId: students[0].userId, body: 'Wa alaikum assalam. Yes, chapters 1–5 plus the past-paper questions I shared in class.', readAt: new Date() },
      { senderId: students[0].userId, receiverId: faculty[0].userId, body: 'Thank you sir! One more thing — are the tutorial problems from week 3 part of the exam?', readAt: null },
      { senderId: students[1].userId, receiverId: admin.id, body: 'Sir, my fee challan still shows unpaid even though I paid at the bank yesterday.', readAt: new Date() },
      { senderId: admin.id, receiverId: students[1].userId, body: 'Please share your deposit slip number — reconciliation usually takes 24–48 hours.', readAt: new Date() },
      { senderId: students[1].userId, receiverId: admin.id, body: 'Slip number is HBL-8891234. Thank you!', readAt: null },
      { senderId: faculty[1].userId, receiverId: admin.id, body: 'Requesting Lab-3 booking for CS-401 on Fridays this semester.', readAt: new Date() },
    ],
  });

  // ---------- Payments for already-paid challans ----------
  const paidChallans = await prisma.feeChallan.findMany({ where: { status: 'PAID' } });
  let paySeq = 1;
  for (const c of paidChallans) {
    await prisma.payment.create({
      data: {
        challanId: c.id,
        studentId: c.studentId,
        amount: c.totalAmount,
        method: paySeq % 2 === 0 ? 'BANK' : 'CARD',
        reference: `PAY-${c.voucherId}-${paySeq++}`,
        status: 'COMPLETED',
        createdAt: c.paidAt || new Date(),
        completedAt: c.paidAt || new Date(),
      },
    });
  }

  // ---------- Semesters ----------
  await prisma.semester.createMany({
    data: [
      {
        name: 'Fall 2026', year: 2026, term: 'FALL', isCurrent: true,
        registrationOpen: new Date('2026-09-01'), registrationClose: new Date('2026-10-18'),
        evaluationOpen: new Date('2026-12-01'), evaluationClose: new Date('2026-12-20'),
        resultPublishDate: new Date('2027-01-15'), feeDueDate: new Date('2026-10-30'),
      },
      {
        name: 'Spring 2026', year: 2026, term: 'SPRING', isCurrent: false,
        registrationOpen: new Date('2026-02-01'), registrationClose: new Date('2026-02-20'),
        evaluationOpen: new Date('2026-06-01'), evaluationClose: new Date('2026-06-20'),
        resultPublishDate: new Date('2026-07-10'), feeDueDate: new Date('2026-02-28'),
      },
      {
        name: 'Fall 2025', year: 2025, term: 'FALL', isCurrent: false,
        registrationOpen: new Date('2025-09-01'), registrationClose: new Date('2025-09-20'),
        evaluationOpen: new Date('2025-12-01'), evaluationClose: new Date('2025-12-20'),
        resultPublishDate: new Date('2026-01-15'), feeDueDate: new Date('2025-09-30'),
      },
    ],
    skipDuplicates: true,
  });

  // ---------- Campuses / Departments / Programs ----------
  const campusIslamabad = await prisma.campus.upsert({
    where: { tenantId_name: { tenantId: 'default', name: 'Islamabad' } },
    update: {},
    create: { name: 'Islamabad', city: 'Islamabad', address: 'Service Road North, Islamabad' },
  });
  await prisma.campus.upsert({
    where: { tenantId_name: { tenantId: 'default', name: 'Lahore' } },
    update: {},
    create: { name: 'Lahore', city: 'Lahore', address: 'Raiwind Road, Lahore' },
  });
  await prisma.campus.upsert({
    where: { tenantId_name: { tenantId: 'default', name: 'Lahore (KSK)' } },
    update: {},
    create: { name: 'Lahore (KSK)', city: 'Lahore', address: 'Kala Shah Kaku, Lahore' },
  });
  await prisma.campus.upsert({
    where: { tenantId_name: { tenantId: 'default', name: 'Attock' } },
    update: {},
    create: { name: 'Attock', city: 'Attock', address: 'Kallar Kahar Road, Attock' },
  });
  await prisma.campus.upsert({
    where: { tenantId_name: { tenantId: 'default', name: 'Abbottabad' } },
    update: {},
    create: { name: 'Abbottabad', city: 'Abbottabad', address: 'Airport Road, Abbottabad' },
  });
  await prisma.campus.upsert({
    where: { tenantId_name: { tenantId: 'default', name: 'Wah' } },
    update: {},
    create: { name: 'Wah', city: 'Wah Cantt', address: 'GT Road, Wah Cantt' },
  });

  const deptCS = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: 'default', code: 'BSCS' } },
    update: {},
    create: { name: 'Computer Science', code: 'BSCS' },
  });
  await prisma.department.upsert({ where: { tenantId_code: { tenantId: 'default', code: 'BSSE' } }, update: {}, create: { name: 'Software Engineering', code: 'BSSE' } });
  await prisma.department.upsert({ where: { tenantId_code: { tenantId: 'default', code: 'BBA' } }, update: {}, create: { name: 'Business Administration', code: 'BBA' } });
  await prisma.department.upsert({ where: { tenantId_code: { tenantId: 'default', code: 'BEE' } }, update: {}, create: { name: 'Electrical Engineering', code: 'BEE' } });

  await prisma.program.upsert({
    where: { tenantId_code: { tenantId: 'default', code: 'BS-CS' } },
    update: {},
    create: { name: 'BS Computer Science', code: 'BS-CS', degreeLevel: 'BS', totalCredits: 133, campusId: campusIslamabad.id, departmentId: deptCS.id },
  });
  await prisma.program.upsert({
    where: { tenantId_code: { tenantId: 'default', code: 'BS-SE' } },
    update: {},
    create: { name: 'BS Software Engineering', code: 'BS-SE', degreeLevel: 'BS', totalCredits: 133, campusId: campusIslamabad.id, departmentId: deptCS.id },
  });
  await prisma.program.upsert({
    where: { tenantId_code: { tenantId: 'default', code: 'MS-CS' } },
    update: {},
    create: { name: 'MS Computer Science', code: 'MS-CS', degreeLevel: 'MS', totalCredits: 30, campusId: campusIslamabad.id, departmentId: deptCS.id },
  });

  // ---------- Scholarships ----------
  await prisma.scholarship.createMany({
    data: [
      {
        title: 'Merit Scholarship (Fall 2026)',
        description: 'Awarded to students with CGPA 3.5 or above. Covers 50% of tuition fee for the semester.',
        amount: 120000,
        eligibility: 'CGPA ≥ 3.5 · No outstanding dues · Full-time enrollment',
        deadline: new Date('2026-11-15'),
      },
      {
        title: 'Need-Based Financial Aid',
        description: 'For students from low-income households. Covers up to 100% of tuition with valid documentation.',
        amount: 200000,
        eligibility: 'Family income ≤ PKR 50,000/month · CGPA ≥ 2.0',
        deadline: new Date('2026-10-31'),
      },
      {
        title: 'Sports Excellence Scholarship',
        description: 'For students representing the university at national/international sports events.',
        amount: 80000,
        eligibility: 'Active sportspisan · Coach recommendation · CGPA ≥ 2.0',
        deadline: new Date('2026-12-01'),
      },
    ],
    skipDuplicates: true,
  });

  // ---------- Exam schedules (midterms for student 0 sections) ----------
  const fallSem = await prisma.semester.findFirst({ where: { name: 'Fall 2026' } });
  if (fallSem) {
    const sections = await prisma.section.findMany({
      where: { semester: 5, year: 2026 },
      take: 4,
      include: { course: true },
    });
    const midDates = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
    const times = [
      ['09:00', '12:00'],
      ['09:00', '12:00'],
      ['14:00', '17:00'],
      ['14:00', '17:00'],
    ];
    const rooms = [' Exam Hall A', 'Exam Hall B', 'Exam Hall C', 'Exam Hall D'];
    for (let i = 0; i < sections.length; i++) {
      await prisma.examSchedule.upsert({
        where: { sectionId_type: { sectionId: sections[i].id, type: 'MIDTERM' } },
        update: {},
        create: {
          sectionId: sections[i].id,
          semesterId: fallSem.id,
          type: 'MIDTERM',
          date: new Date(midDates[i]),
          startTime: times[i][0],
          endTime: times[i][1],
          room: rooms[i].trim(),
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('  Admin:    admin@novastra.edu.pk / admin123');
  console.log('  Faculty:  ali.khan@novastra.edu.pk / faculty123');
  console.log('  Student:  sp23-bscs-001@student.novastra.edu.pk / student123');
  console.log('  Platform: platform@novastra.edu.pk / platform123 (console at /platform)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
