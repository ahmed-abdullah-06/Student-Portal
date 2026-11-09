const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const c = require('../controllers/complaintController');

const router = Router();

router.use(authMiddleware, roleMiddleware('STUDENT'));

router.get('/', c.listMine);
router.post('/', c.create);

module.exports = router;
