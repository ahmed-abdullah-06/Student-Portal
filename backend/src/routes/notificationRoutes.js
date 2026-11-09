const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const n = require('../controllers/notificationController');

const router = Router();

router.use(authMiddleware);
router.get('/', n.list);
router.get('/unread-count', n.unreadCount);
router.post('/read-all', n.markAllRead);
router.get('/preferences', n.preferences);
router.put('/preferences', n.updatePreferences);
router.post('/:id/read', n.markRead);
router.post('/', roleMiddleware('ADMIN'), n.create);

module.exports = router;
