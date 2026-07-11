const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/jobs', deliveryController.listJobs);
router.post('/jobs', deliveryController.createDeliveryJob);
router.get('/jobs/:id', deliveryController.getJob);
router.get('/jobs/:id/messages', deliveryController.getJobMessages);
router.post('/jobs/:id/retry-failed', deliveryController.retryFailed);
router.post('/test-email', deliveryController.testEmail);
router.get('/logs', deliveryController.getLogs);

module.exports = router;
