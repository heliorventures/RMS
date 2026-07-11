const express = require('express');
const createCrud = require('../controllers/crudFactory');
const Festival = require('../models/Festival');
const Event = require('../models/Event');
const Template = require('../models/Template');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');
const CommunicationHistory = require('../models/CommunicationHistory');
const Notification = require('../models/Notification');
const upload = require('../middleware/upload');
const { auth } = require('../middleware/auth');

function mountCrud(router, ctrl) {
  router.get('/', ctrl.getAll);
  router.get('/:id', ctrl.getById);
  router.post('/', upload.single('file'), ctrl.create);
  router.put('/:id', upload.single('file'), ctrl.update);
  router.delete('/:id', ctrl.remove);
}

const festivalCtrl = createCrud(Festival, 'festivals');
const eventCtrl = createCrud(Event, 'events');
const templateCtrl = createCrud(Template, 'templates');
const campaignCtrl = createCrud(Campaign, 'campaigns');
const messageCtrl = createCrud(Message, 'messages');
const commCtrl = createCrud(CommunicationHistory, 'communicationHistory');
const notifCtrl = createCrud(Notification, 'notifications');

const controllers = { festivalCtrl, eventCtrl, templateCtrl, campaignCtrl, messageCtrl, commCtrl, notifCtrl };

function setUseMongo(val) {
  Object.values(controllers).forEach(c => c.setUseMongo(val));
}

const router = express.Router();
router.use(auth);

const festivals = express.Router();
mountCrud(festivals, festivalCtrl);
router.use('/festivals', festivals);

const events = express.Router();
mountCrud(events, eventCtrl);
router.use('/events', events);

const templates = express.Router();
mountCrud(templates, templateCtrl);
router.use('/templates', templates);

const campaigns = express.Router();
mountCrud(campaigns, campaignCtrl);
router.use('/campaigns', campaigns);

const messages = express.Router();
mountCrud(messages, messageCtrl);
router.use('/messages', messages);

const communication = express.Router();
mountCrud(communication, commCtrl);
router.use('/communication', communication);

const notifications = express.Router();
mountCrud(notifications, notifCtrl);
router.use('/notifications', notifications);

module.exports = { router, setUseMongo, controllers };
