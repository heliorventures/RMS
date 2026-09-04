const express = require('express');
const { auth } = require('../middleware/auth');
const exportController = require('../controllers/exportController');

const router = express.Router();
router.use(auth);
router.post('/contacts', exportController.createContactsExport);
router.get('/:id/download', exportController.download);

module.exports = router;
