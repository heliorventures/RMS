const express = require('express');
const groupController = require('../controllers/groupController');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', groupController.getAll);
router.get('/:id', groupController.getById);
router.post('/', groupController.create);
router.put('/:id', groupController.update);
router.put('/:id/members', groupController.updateMembers);
router.delete('/:id', groupController.remove);

module.exports = router;
