const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { upload } = require('../middlewares/upload');
const { uploadLimiter } = require('../middlewares/rateLimit');
const f = require('../controllers/facultyController');
const p = require('../controllers/profileController');

const router = Router();

router.use(authMiddleware, roleMiddleware('FACULTY'));

router.get('/profile', async (req, res, next) => {
  try {
    const faculty = await require('../config/db').faculty.findUnique({ where: { userId: req.user.id } });
    if (!faculty) return res.status(404).json({ message: 'Faculty profile not found' });
    res.json({ faculty });
  } catch (err) { next(err); }
});
router.put('/profile', p.facultyUpdateProfile);
router.get('/sections', f.getSections);
router.get('/sections/:id/students', f.getRoster);
router.post('/sections/:id/attendance', f.markAttendance);
router.get('/sections/:id/attendance', f.getAttendanceReport);
router.post('/sections/:id/marks', f.enterMarks);
router.post('/sections/:id/freeze', f.freezeResult);
router.get('/sections/:id/evaluations', f.getEvaluations);
router.get('/sections/:id/tasks', f.getTasks);
router.post('/sections/:id/tasks', uploadLimiter, upload.single('file'), f.createTask);
router.get('/tasks/:id/download', f.downloadTask);
router.patch('/submissions/:id', f.updateSubmission);
router.get('/submissions/:id/download', f.downloadSubmission);

module.exports = router;
