const express = require('express');
const contactController = require('../controllers/contactController');
const upload = require('../middleware/upload');
const { auth, requireAdmin } = require('../middleware/auth');
const whatsapp = require('../controllers/whatsappController');

const router = express.Router();
router.use(auth);

router.get('/', contactController.getAll);
router.get('/birthdays/calendar', contactController.getBirthdayCalendar);
router.get('/birthdays', contactController.getBirthdays);
router.get('/anniversaries', contactController.getAnniversaries);
router.post('/bulk-import', contactController.bulkImport);
router.post('/bulk-lookup', contactController.bulkLookup);
router.get('/:id', contactController.getById);
router.get('/:id/whatsapp-consent', requireAdmin, whatsapp.getConsent);
router.put('/:id/whatsapp-consent', requireAdmin, whatsapp.setConsent);
router.post('/', upload.single('photo'), contactController.create);
router.put('/:id', upload.single('photo'), contactController.update);
router.delete('/:id', contactController.remove);

module.exports = router;
