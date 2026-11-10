const { Router } = require('express');
const controller = require('./controller');
const { platformAuth } = require('./auth');
const { apiLimiter, authLimiter } = require('../middlewares/rateLimit');

/**
 * Platform (SaaS operator) API — mounted BEFORE the tenant resolver so these
 * routes run without tenant context and can manage tenants across the platform.
 */

const router = Router();

router.use(apiLimiter);

router.post('/login', authLimiter, controller.login);

router.use(platformAuth);
router.get('/me', controller.me);
router.get('/stats', controller.stats);
router.get('/tenants', controller.listTenants);
router.post('/tenants', controller.createTenant);
router.patch('/tenants/:id', controller.updateTenant);

module.exports = router;
