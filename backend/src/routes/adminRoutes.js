const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { requirePerm, CATALOG } = require('../middlewares/permissions');
const a = require('../controllers/adminController');
const w = require('../controllers/withdrawController');
const c = require('../controllers/complaintController');
const r = require('../controllers/requestController');
const sem = require('../controllers/semesterController');
const m = require('../controllers/masterDataController');
const { validate, schemas } = require('../middlewares/validate');
const { uploadLimiter } = require('../middlewares/rateLimit');
const { upload } = require('../middlewares/upload');
const { enforceQuota } = require('../tenancy/plans');
const calendar = require('../controllers/calendarController');
const privacy = require('../controllers/privacyController');

const router = Router();
const { templates: emailTemplates } = require('../services/email');

router.use(authMiddleware, roleMiddleware('ADMIN'));

// Admin-only, side-effect-free preview for branded transactional email QA.
router.get('/email-templates/:name/preview', requirePerm('settings:manage'), (req, res) => {
  const template = emailTemplates[req.params.name];
  if (!template) return res.status(404).json({ message: 'Email template not found' });
  const samples = {
    name: 'Ayesha Khan', roll: 'SP-2026-001', password: 'ChangeMeNow!',
    link: `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=preview`,
    expiresIn: '1 hour', title: 'Sample notification', body: 'This is a preview only.',
    voucher: 'NOV-0001', amount: '25,000', dueDate: '30 June 2026', reference: 'PREVIEW-001',
  };
  const rendered = template(samples);
  res.json({ name: req.params.name, subject: rendered.subject, html: rendered.html, text: rendered.text });
});

// ---------- Dashboard ----------
router.get('/stats', a.getStats);
router.get('/analytics', requirePerm('reports:export'), a.getAnalytics);
router.get('/calendar', calendar.list);
router.post('/calendar', requirePerm('semesters:manage'), calendar.create);
router.put('/calendar/:id', requirePerm('semesters:manage'), calendar.update);
router.delete('/calendar/:id', requirePerm('semesters:manage'), calendar.remove);

// ---------- Users (granular RBAC) ----------
router.get('/students', requirePerm('students:read'), a.listStudents);
router.post('/students', requirePerm('students:write'), enforceQuota('students'), a.createStudent);
router.put('/students/:id', requirePerm('students:write'), a.updateStudent);
router.get('/students/:id/data-export', requirePerm('students:read'), privacy.exportStudentData);
router.post('/students/:id/anonymize', requirePerm('students:write'), privacy.anonymizeStudent);
router.post('/students/import', uploadLimiter, requirePerm('students:import'), enforceQuota('students'), upload.single('file'), a.importStudents);
// ---------- Data migration (CSV, supports ?dryRun=1) ----------
router.post('/import/faculty', uploadLimiter, requirePerm('faculty:write'), enforceQuota('faculty'), upload.single('file'), a.importFacultyCsv);
router.post('/import/courses', uploadLimiter, requirePerm('courses:manage'), upload.single('file'), a.importCoursesCsv);
router.post('/import/semester-records', uploadLimiter, requirePerm('students:import'), upload.single('file'), a.importSemesterRecordsCsv);
router.post('/import/historical-grades', uploadLimiter, requirePerm('students:import'), upload.single('file'), a.importHistoricalGradesCsv);
router.get('/faculty', requirePerm('faculty:read'), a.listFaculty);
router.post('/faculty', requirePerm('faculty:write'), enforceQuota('faculty'), a.createFaculty);
router.put('/faculty/:id', requirePerm('faculty:write'), a.updateFaculty);
router.get('/users', requirePerm('students:read'), a.listUsers);
router.put('/users/:id', requirePerm('students:write'), a.updateUser);
router.post('/users/:id/reset-password', requirePerm('students:write'), a.resetPassword);
router.post('/users/bulk-status', requirePerm('students:write'), a.bulkUpdateUsers);
router.post('/users/bulk-reset-password', requirePerm('students:write'), a.bulkResetPasswords);
router.put('/users/:id/permissions', requirePerm('settings:manage'), a.updateUserPermissions);
router.get('/permission-catalog', requirePerm('settings:manage'), (req, res) => res.json({ permissions: CATALOG }));
router.get('/search', requirePerm('students:read'), a.globalSearch);
router.get('/students/:id/activity', requirePerm('students:read'), a.getStudentActivity);

// ---------- Academics ----------
router.get('/courses', requirePerm('courses:manage'), a.listCourses);
router.post('/courses', requirePerm('courses:manage'), a.createCourse);
router.put('/courses/:id', requirePerm('courses:manage'), a.updateCourse);
router.delete('/courses/:id', requirePerm('courses:manage'), a.deleteCourse);

router.get('/sections', requirePerm('sections:manage'), a.listSections);
router.post('/sections', requirePerm('sections:manage'), a.createSection);
router.put('/sections/:id', requirePerm('sections:manage'), a.updateSection);
router.get('/timetable', requirePerm('sections:manage'), a.getTimetable);
router.put('/sections/:id/timetable', requirePerm('sections:manage'), a.setTimetable);

// ---------- Fees ----------
router.get('/fee-structures', requirePerm('fees:manage'), a.getFeeStructures);
router.put('/fee-structures', requirePerm('fees:manage'), a.upsertFeeStructure);
router.get('/challans', requirePerm('fees:manage'), a.listChallans);
router.post('/challans/generate', requirePerm('fees:manage'), a.generateChallans);
router.post('/challans/:id/pay', requirePerm('fees:manage'), a.markChallanPaid);

// ---------- Notices & audit ----------
router.get('/notices', requirePerm('notices:manage'), a.listNotices);
router.post('/notices', requirePerm('notices:manage'), validate(schemas.notice), a.createNotice);
router.post('/notices/bulk-target', requirePerm('notices:manage'), a.bulkTargetNotice);
router.delete('/notices/:id', requirePerm('notices:manage'), a.deleteNotice);
router.get('/audit-logs', requirePerm('audit:read'), a.getAuditLogs);
router.get('/audit-logs/export', requirePerm('audit:read'), a.exportAuditCsv);

// ---------- Approvals ----------
router.get('/withdrawals', requirePerm('approvals:manage'), w.listAll);
router.put('/withdrawals/:id', requirePerm('approvals:manage'), w.resolve);
router.get('/complaints', requirePerm('approvals:manage'), c.listAll);
router.put('/complaints/:id', requirePerm('approvals:manage'), c.resolve);

// ---------- Semesters & exams ----------
router.get('/semesters', requirePerm('semesters:manage'), sem.listSemesters);
router.post('/semesters', requirePerm('semesters:manage'), validate(schemas.semester), sem.createSemester);
router.put('/semesters/:id', requirePerm('semesters:manage'), sem.updateSemester);
router.delete('/semesters/:id', requirePerm('semesters:manage'), sem.deleteSemester);
router.get('/exams', requirePerm('semesters:manage'), sem.listExams);
router.post('/exams', requirePerm('semesters:manage'), validate(schemas.examSchedule), sem.createExam);
router.delete('/exams/:id', requirePerm('semesters:manage'), sem.deleteExam);
router.get('/eval-window', requirePerm('semesters:manage'), sem.getEvalWindow);
router.put('/eval-window', requirePerm('semesters:manage'), sem.setEvalWindow);

// ---------- Student requests ----------
router.get('/rechecks', requirePerm('approvals:manage'), r.listAllRechecks);
router.put('/rechecks/:id', requirePerm('approvals:manage'), r.resolveRecheck);
router.get('/freezes', requirePerm('approvals:manage'), r.listAllFreezes);
router.put('/freezes/:id', requirePerm('approvals:manage'), r.resolveFreeze);
router.get('/installments', requirePerm('approvals:manage'), r.listAllInstallments);
router.put('/installments/:id', requirePerm('approvals:manage'), r.resolveInstallment);
router.get('/refunds', requirePerm('approvals:manage'), r.listAllRefunds);
router.put('/refunds/:id', requirePerm('approvals:manage'), r.resolveRefund);
router.get('/scholarships', requirePerm('scholarships:manage'), r.adminListScholarships);
router.post('/scholarships', requirePerm('scholarships:manage'), validate(schemas.scholarship), r.adminCreateScholarship);
router.get('/scholarship-apps', requirePerm('scholarships:manage'), r.listAllScholarshipApps);
router.put('/scholarship-apps/:id', requirePerm('scholarships:manage'), r.resolveScholarshipApp);
router.get('/cert-requests', requirePerm('approvals:manage'), r.listAllCertRequests);
router.put('/cert-requests/:id', requirePerm('approvals:manage'), r.resolveCertRequest);
router.get('/bank-proofs', requirePerm('approvals:manage'), r.listAllBankProofs);
router.put('/bank-proofs/:id', requirePerm('fees:manage'), r.resolveBankProof);

// ---------- Master data ----------
router.get('/campuses', requirePerm('masterdata:manage'), m.listCampuses);
router.post('/campuses', requirePerm('masterdata:manage'), m.createCampus);
router.put('/campuses/:id', requirePerm('masterdata:manage'), m.updateCampus);
router.get('/departments', requirePerm('masterdata:manage'), m.listDepartments);
router.post('/departments', requirePerm('masterdata:manage'), m.createDepartment);
router.put('/departments/:id', requirePerm('masterdata:manage'), m.updateDepartment);
router.get('/programs', requirePerm('masterdata:manage'), m.listPrograms);
router.post('/programs', requirePerm('masterdata:manage'), m.createProgram);
router.put('/programs/:id', requirePerm('masterdata:manage'), m.updateProgram);

// ---------- Reports (CSV) ----------
router.get('/reports/attendance', requirePerm('reports:export'), m.attendanceReport);
router.get('/reports/fee-defaulters', requirePerm('reports:export'), m.feeDefaulterReport);
router.get('/reports/result-gazette', requirePerm('reports:export'), m.resultGazette);
router.get('/reports/enrollment', requirePerm('reports:export'), m.enrollmentReport);

// ---------- Data retention ----------
const { runRetention, previewRetention } = require('../controllers/retentionController');
router.get('/retention/preview', requirePerm('retention:run'), previewRetention);
router.post('/retention/run', requirePerm('retention:run'), runRetention);

module.exports = router;
