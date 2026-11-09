const { Router } = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const l = require('../controllers/libraryController');

const router = Router();

router.use(authMiddleware);

router.get('/books', l.listBooks);
router.get('/my', roleMiddleware('STUDENT'), l.myIssues);

router.get('/issues', roleMiddleware('ADMIN'), l.listIssues);
router.post('/issue', roleMiddleware('ADMIN'), l.issueBook);
router.post('/return/:id', roleMiddleware('ADMIN'), l.returnBook);
router.post('/books', roleMiddleware('ADMIN'), l.createBook);
router.put('/books/:id', roleMiddleware('ADMIN'), l.updateBook);
router.delete('/books/:id', roleMiddleware('ADMIN'), l.deleteBook);

module.exports = router;
