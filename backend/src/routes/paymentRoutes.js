const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const p = require('../controllers/paymentController');

const router = Router();

router.use(authMiddleware);

router.post('/checkout', roleMiddleware('STUDENT'), p.checkout);
router.get('/history', roleMiddleware('STUDENT'), p.history);
router.get('/all', roleMiddleware('ADMIN'), p.all);
router.post('/reconcile', roleMiddleware('ADMIN'), p.reconcile);

module.exports = router;
