const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePerm } = require('../middlewares/permissions');
const { listSettings, updateSettings, publicBranding } = require('../controllers/settingsController');

const publicRouter = Router();
const router = Router();

publicRouter.get('/branding', publicBranding);

router.use(authMiddleware);
router.get('/', requirePerm('settings:manage'), listSettings);
router.put('/:section', requirePerm('settings:manage'), updateSettings);

module.exports = { router, publicRouter };
