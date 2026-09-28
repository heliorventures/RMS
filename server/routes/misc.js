const express = require('express');
const reportsController = require('../controllers/reportsController');
const settingsController = require('../controllers/settingsController');
const upload = require('../middleware/upload');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/reports/contacts', reportsController.getContactsReport);
router.get('/reports/birthdays', reportsController.getBirthdayReport);
router.get('/reports/campaigns', reportsController.getCampaignReport);
router.get('/reports/delivery', reportsController.getDeliveryReport);

const settings = express.Router();
settings.get('/', settingsController.get);
settings.put('/', requireAdmin, settingsController.update);
settings.get('/users', requireAdmin, settingsController.getUsers);
settings.post('/users', requireAdmin, settingsController.createUser);
settings.put('/users/:id', requireAdmin, settingsController.updateUser);
settings.delete('/users/:id', requireAdmin, settingsController.deleteUser);
settings.put('/roles', requireAdmin, settingsController.updateRole);
router.use('/settings', settings);

function handleUpload(middleware) {
  return (req, res, next) => middleware(req, res, error => {
  if (error) return res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Attachment must be 10 MB or smaller.' : error.message });
  next();
  });
}

router.post('/upload/invitations', handleUpload(upload.invitationUpload.single('file')), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  try {
    const filename = await upload.saveInvitationFile(req.file);
    res.json({ success: true, url: `/uploads/invitations/${filename}` });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.post('/upload/:type', handleUpload(upload.single('file')), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  res.json({ success: true, url: `/uploads/${req.params.type}/${req.file.filename}` });
});

module.exports = router;
