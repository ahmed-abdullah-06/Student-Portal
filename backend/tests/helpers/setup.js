require('dotenv').config({ path: __dirname + '/../../.env' });

// Test environment overrides — applied before any app module loads.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../../generated/prisma');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Wipe data-dependent tables (keep schema). Truncates in FK-safe order. */
async function cleanDatabase() {
  const tables = [
    'notification_reads', 'notifications', 'chat_messages', 'audit_logs',
    'password_reset_tokens', 'user_sessions',
    'result_rechecks', 'semester_freezes', 'installment_requests', 'fee_refund_requests',
    'scholarship_applications', 'certificate_requests', 'bank_payment_proof',
    'teacher_evaluations', 'attendance_records', 'enrollments',
    'task_submissions', 'course_tasks', 'course_materials',
    'exam_schedules', 'semesters', 'evaluation_windows',
    'course_prerequisites', 'section_slots', 'timetable_slots', 'sections', 'courses',
    'fee_challans', 'payments', 'fee_structures',
    'documents', 'complaints', 'course_withdrawals',
    'hostel_allocations', 'library_books', 'library_issues',
    'transport_enrollments', 'transport_routes',
    'students', 'faculty', 'notices', 'settings',
    'scholarships', 'campuses', 'departments', 'programs',
    'users',
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE`).catch(() => {});
  }
}

module.exports = { prisma, cleanDatabase };
