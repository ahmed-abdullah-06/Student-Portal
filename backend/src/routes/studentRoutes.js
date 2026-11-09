const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const s = require('../controllers/studentController');
const p = require('../controllers/profileController');
const r = require('../controllers/requestController');
const sem = require('../controllers/semesterController');
const { validate, schemas } = require('../middlewares/validate');
const { upload } = require('../middlewares/upload');
const { uploadLimiter } = require('../middlewares/rateLimit');
const calendar = require('../controllers/calendarController');
const privacy = require('../controllers/privacyController');

const router = Router();

router.use(authMiddleware, roleMiddleware('STUDENT'));

router.get('/profile', p.getProfile);
router.get('/calendar', calendar.list);
router.get('/faculty/:id', async (req, res, next) => {
  try {
    const faculty = await require('../config/db').faculty.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, designation: true, department: true, phone: true, officeHours: true, bio: true },
    });
    if (!faculty) return res.status(404).json({ message: 'Faculty profile not found' });
    res.json({ faculty });
  } catch (err) { next(err); }
});
router.get('/data-export', privacy.exportOwnData);
router.put('/profile', validate(schemas.updateProfile), p.updateProfile);
router.post('/profile/photo', uploadLimiter, upload.single('photo'), p.updatePhoto);
router.get('/courses', s.getRegisteredCourses);
router.get('/courses/available', s.getAvailableCourses);
router.get('/courses/:id', s.getCourseWorkspace);
router.get('/tasks/:id/download', s.downloadTaskFile);
router.post('/tasks/:id/submit', uploadLimiter, upload.single('file'), s.submitTask);
router.post('/courses/register', validate(schemas.registerCourse), s.registerCourse);
router.post('/courses/drop/:id', s.dropCourse);
router.get('/attendance', s.getAttendance);
router.get('/marks', s.getMarks);
router.get('/transcript', s.getTranscript);
router.get('/challans', s.getChallans);
router.get('/challans/:id/pdf', s.downloadChallanPdf);
router.get('/timetable', s.getTimetable);
router.get('/notices', s.getNotices);
router.get('/evaluations', s.getEvaluations);
router.post('/evaluations', validate(schemas.evaluation), s.submitEvaluation);
router.get('/certificates/:type', s.downloadCertificate);

router.get('/date-sheet', sem.studentDateSheet);
router.get('/admit-card', sem.admitCard);
router.get('/admit-card/pdf', sem.admitCardPdf);
router.get('/eval-window', sem.getEvalWindow);

router.get('/degree-audit', r.degreeAudit);

router.get('/rechecks', r.listMyRechecks);
router.post('/rechecks', validate(schemas.recheck), r.createRecheck);

router.get('/freezes', r.listMyFreezes);
router.post('/freezes', validate(schemas.freeze), r.createFreeze);

router.get('/installments', r.listMyInstallments);
router.post('/installments', validate(schemas.installment), r.createInstallment);

router.get('/refunds', r.listMyRefunds);
router.post('/refunds', validate(schemas.refund), r.createRefund);

router.get('/scholarships', r.listScholarships);
router.get('/scholarships/my', r.listMyScholarshipApps);
router.post('/scholarships/:id/apply', validate(schemas.scholarshipApply), r.applyScholarship);

router.get('/cert-requests', r.listMyCertificates);
router.post('/cert-requests', validate(schemas.certificateRequest), r.createCertificateRequest);

router.get('/bank-proofs', r.listMyBankProofs);
router.post('/bank-proofs', validate(schemas.bankProof), r.createBankProof);

module.exports = router;
