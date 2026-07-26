const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');

const reportsController = {
  async getContactsReport(req, res) {
    try {
      const contacts = await Contact.find();
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
      const campaigns = await Campaign.find();
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
      const page = +req.query.page || 1;
      const limit = +req.query.limit || 50;
      const status = req.query.status;

      const q = status ? { status } : {};
      const total = await Message.countDocuments(q);
      const messages = await Message.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
      const byType = { email: 0, whatsapp: 0, sms: 0 };
      const byStatus = { sent: 0, delivered: 0, failed: 0, pending: 0, skipped: 0, processing: 0 };
      const all = await Message.find().lean();
      all.forEach(m => {
        byType[m.type] = (byType[m.type] || 0) + 1;
        byStatus[m.status] = (byStatus[m.status] || 0) + 1;
      });
      res.json({
        success: true,
        data: {
          total: all.length,
          byType,
          byStatus,
          messages,
          pagination: { page, limit, total }
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getBirthdayReport(req, res) {
    try {
      const contacts = await Contact.find({ dob: { $exists: true } });
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

module.exports = reportsController;
