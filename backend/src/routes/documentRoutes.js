const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const d = require('../controllers/documentController');
const { upload } = require('../middlewares/upload');

const router = Router();

router.get('/', authMiddleware, d.listDocuments);
router.get('/:id/download', authMiddleware, d.downloadDocument);
router.post('/', authMiddleware, roleMiddleware('ADMIN'), upload.single('file'), d.uploadDocument);
router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), d.deleteDocument);

module.exports = router;
