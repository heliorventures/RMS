const express = require('express');
const reportsController = require('../controllers/reportsController');
const settingsController = require('../controllers/settingsController');
const upload = require('../middleware/upload');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/contacts', reportsController.getContactsReport);
router.get('/birthdays', reportsController.getBirthdayReport);
router.get('/campaigns', reportsController.getCampaignReport);
router.get('/delivery', reportsController.getDeliveryReport);

const settings = express.Router();
settings.get('/', settingsController.get);
settings.put('/', requireAdmin, settingsController.update);
settings.get('/users', requireAdmin, settingsController.getUsers);
settings.post('/users', requireAdmin, settingsController.createUser);
settings.put('/users/:id', requireAdmin, settingsController.updateUser);
settings.delete('/users/:id', requireAdmin, settingsController.deleteUser);
settings.put('/roles', requireAdmin, settingsController.updateRole);
router.use('/settings', settings);

router.post('/upload/:type', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  res.json({ success: true, url: `/uploads/${req.params.type}/${req.file.filename}` });
});

module.exports = router;
