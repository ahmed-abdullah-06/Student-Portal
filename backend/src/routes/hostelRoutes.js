const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const h = require('../controllers/hostelController');

const router = Router();

router.use(authMiddleware);

router.get('/me', roleMiddleware('STUDENT'), h.myAllocation);
router.post('/apply', roleMiddleware('STUDENT'), h.apply);

router.get('/', roleMiddleware('ADMIN'), h.listAll);
router.post('/:id/approve', roleMiddleware('ADMIN'), h.approve);
router.post('/:id/release', roleMiddleware('ADMIN'), h.release);
router.delete('/:id', roleMiddleware('ADMIN'), h.deleteAllocation);

module.exports = router;
