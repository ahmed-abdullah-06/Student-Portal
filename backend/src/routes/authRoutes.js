const { Router } = require('express');
const {
  login, logout, me, changePassword, forgotPassword, resetPassword, captcha,
  listSessions, revokeSession, revokeAllSessions, refresh, acceptTerms,
} = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validate');
const { authLimiter, sensitiveLimiter, twoFactorLimiter } = require('../middlewares/rateLimit');

const router = Router();

router.get('/captcha', captcha);
router.post('/login', authLimiter, twoFactorLimiter, validate(schemas.login), login);
router.post('/logout', logout);
router.post('/refresh', sensitiveLimiter, refresh);
router.post('/accept-terms', authMiddleware, acceptTerms);
router.get('/me', authMiddleware, me);
router.post('/change-password', authMiddleware, validate(schemas.changePassword), changePassword);
router.post('/forgot-password', sensitiveLimiter, validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password', sensitiveLimiter, validate(schemas.resetPassword), resetPassword);

// Active sessions / revocation
router.get('/sessions', authMiddleware, listSessions);
router.delete('/sessions/:id', authMiddleware, revokeSession);
router.post('/sessions/revoke-all', authMiddleware, revokeAllSessions);

// Two-factor authentication
const { enable2FA, confirm2FA, disable2FA } = require('../controllers/twoFactorController');
router.post('/2fa/enable', authMiddleware, enable2FA);
router.post('/2fa/confirm', authMiddleware, validate(schemas.confirm2FA), confirm2FA);
router.post('/2fa/disable', authMiddleware, validate(schemas.disable2FA), disable2FA);

module.exports = router;
