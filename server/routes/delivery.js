const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const { auth, requireAdmin } = require('../middleware/auth');
const whatsapp = require('../controllers/whatsappController');

const router = express.Router();
router.use(auth);

router.get('/jobs', deliveryController.listJobs);
router.get('/capabilities', deliveryController.getCapabilities);
router.post('/jobs', deliveryController.createDeliveryJob);
router.get('/jobs/:id', deliveryController.getJob);
router.get('/jobs/:id/messages', deliveryController.getJobMessages);
router.post('/jobs/:id/retry-failed', deliveryController.retryFailed);
router.post('/test-email', deliveryController.testEmail);
router.post('/verify-whatsapp', requireAdmin, whatsapp.verify);
router.post('/test-whatsapp', requireAdmin, whatsapp.testSend);
router.get('/logs', deliveryController.getLogs);

module.exports = router;
