const jsonStore = require('../utils/jsonStore');
const Contact = require('../models/Contact');

let useMongo = false;
function setUseMongo(val) { useMongo = val; }

const reportsController = {
  async getContactsReport(req, res) {
    try {
      const contacts = useMongo ? await Contact.find() : jsonStore.getAll('contacts');
      const byCity = {}, bySector = {}, byReligion = {}, byStatus = {};
      contacts.forEach(c => {
        byCity[c.city || 'Unknown'] = (byCity[c.city || 'Unknown'] || 0) + 1;
        bySector[c.sector || 'Unknown'] = (bySector[c.sector || 'Unknown'] || 0) + 1;
        byReligion[c.religion || 'Unknown'] = (byReligion[c.religion || 'Unknown'] || 0) + 1;
        byStatus[c.status || 'Active'] = (byStatus[c.status || 'Active'] || 0) + 1;
      });
      res.json({ success: true, data: { total: contacts.length, byCity, bySector, byReligion, byStatus } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getCampaignReport(req, res) {
    try {
      const campaigns = jsonStore.getAll('campaigns');
      const byType = {}, byStatus = {};
      campaigns.forEach(c => {
        byType[c.type] = (byType[c.type] || 0) + 1;
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      });
      res.json({ success: true, data: { total: campaigns.length, byType, byStatus, campaigns } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getDeliveryReport(req, res) {
    try {
      const messageStore = require('../services/messageStore');
      const page = +req.query.page || 1;
      const limit = +req.query.limit || 50;
      const status = req.query.status;

      let messages;
      if (useMongo) {
        const Message = require('../models/Message');
        const q = status ? { status } : {};
        const total = await Message.countDocuments(q);
        messages = await Message.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
        const byType = { email: 0, whatsapp: 0, sms: 0 };
        const byStatus = { sent: 0, delivered: 0, failed: 0, pending: 0, skipped: 0, processing: 0 };
        const all = await Message.find().lean();
        all.forEach(m => {
          byType[m.type] = (byType[m.type] || 0) + 1;
          byStatus[m.status] = (byStatus[m.status] || 0) + 1;
        });
        return res.json({ success: true, data: { total: all.length, byType, byStatus, messages, pagination: { page, limit, total } } });
      }

      messages = jsonStore.getAll('messages');
      if (status) messages = messages.filter(m => m.status === status);
      const byType = { email: 0, whatsapp: 0, sms: 0 };
      const byStatus = { sent: 0, delivered: 0, failed: 0, pending: 0, skipped: 0, processing: 0 };
      jsonStore.getAll('messages').forEach(m => {
        byType[m.type] = (byType[m.type] || 0) + 1;
        byStatus[m.status] = (byStatus[m.status] || 0) + 1;
      });
      messages.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      const total = messages.length;
      const start = (page - 1) * limit;
      res.json({
        success: true,
        data: {
          total: jsonStore.getAll('messages').length,
          byType,
          byStatus,
          messages: messages.slice(start, start + limit),
          pagination: { page, limit, total }
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getBirthdayReport(req, res) {
    try {
      const contacts = useMongo ? await Contact.find({ dob: { $exists: true } }) : jsonStore.getAll('contacts').filter(c => c.dob);
      const byMonth = {};
      contacts.forEach(c => {
        const m = new Date(c.dob).toLocaleString('en', { month: 'long' });
        byMonth[m] = (byMonth[m] || 0) + 1;
      });
      res.json({ success: true, data: { total: contacts.length, byMonth } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

reportsController.setUseMongo = setUseMongo;
module.exports = reportsController;
