const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const w = require('../controllers/withdrawController');

const router = Router();

router.use(authMiddleware, roleMiddleware('STUDENT'));

router.get('/', w.listMine);
router.post('/', w.create);

module.exports = router;
