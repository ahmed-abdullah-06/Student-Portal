const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const c = require('../controllers/chatController');

const router = Router();

router.use(authMiddleware);
router.get('/peers', c.getPeers);
router.get('/messages/:userId', c.getMessages);
router.post('/messages/:userId', c.send);

module.exports = router;
