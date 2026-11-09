const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const t = require('../controllers/transportController');

const router = Router();

router.use(authMiddleware);

router.get('/routes', t.listRoutes);
router.get('/me', roleMiddleware('STUDENT'), t.myAllocation);
router.post('/enroll', roleMiddleware('STUDENT'), t.enroll);
router.post('/leave', roleMiddleware('STUDENT'), t.leave);

router.get('/allocations', roleMiddleware('ADMIN'), t.listAll);
router.post('/routes', roleMiddleware('ADMIN'), t.createRoute);
router.put('/routes/:id', roleMiddleware('ADMIN'), t.updateRoute);
router.delete('/routes/:id', roleMiddleware('ADMIN'), t.deleteRoute);

module.exports = router;
