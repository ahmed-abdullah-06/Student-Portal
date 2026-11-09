const { Router } = require('express');
const { webhookLimiter } = require('../middlewares/rateLimit');
const p = require('../controllers/paymentController');

/**
 * Gateway webhook routes. Mounted BEFORE tenant resolution in server.js:
 * payment providers call from the public internet without tenant headers, so
 * the tenant travels inside the signed webhook payload metadata instead.
 * Requests are signature-verified in the controller.
 */
const router = Router();

router.post('/stripe', webhookLimiter, p.stripeWebhook);

module.exports = router;
