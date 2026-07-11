const express = require('express');
const contactController = require('../controllers/contactController');
const upload = require('../middleware/upload');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', contactController.getAll);
router.get('/birthdays', contactController.getBirthdays);
router.get('/anniversaries', contactController.getAnniversaries);
router.post('/bulk-import', contactController.bulkImport);
router.get('/:id', contactController.getById);
router.post('/', upload.single('photo'), contactController.create);
router.put('/:id', upload.single('photo'), contactController.update);
router.delete('/:id', contactController.remove);

module.exports = router;
