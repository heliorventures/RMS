const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_PAGE_SIZE = 100;

function pageRequest(query, fallback = 50) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || fallback));
  return { page, limit };
}

function toCountMap(rows) {
  return Object.fromEntries(rows.map(row => [row._id || 'Unknown', row.count]));
}

function countBy(model, field, fallback = 'Unknown', match = {}) {
  return model.aggregate([
    { $match: match },
    { $group: { _id: { $ifNull: [`$${field}`, fallback] }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
}

const reportsController = {
  async getContactsReport(req, res) {
    try {
      const [total, cityRows, sectorRows, religionRows, statusRows] = await Promise.all([
        Contact.countDocuments(),
        countBy(Contact, 'city'),
        countBy(Contact, 'sector'),
        countBy(Contact, 'religion'),
        countBy(Contact, 'status', 'Active')
      ]);
      res.json({ success: true, data: { total, byCity: toCountMap(cityRows), bySector: toCountMap(sectorRows), byReligion: toCountMap(religionRows), byStatus: toCountMap(statusRows) } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getCampaignReport(req, res) {
    try {
      const [total, typeRows, statusRows] = await Promise.all([
        Campaign.countDocuments(), countBy(Campaign, 'type'), countBy(Campaign, 'status')
      ]);
      res.json({ success: true, data: { total, byType: toCountMap(typeRows), byStatus: toCountMap(statusRows) } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getDeliveryReport(req, res) {
    try {
      const { page, limit } = pageRequest(req.query);
      const filter = req.query.status ? { status: req.query.status } : {};
      const [total, allTotal, messages, typeRows, statusRows] = await Promise.all([
        Message.countDocuments(filter),
        Message.countDocuments(),
        Message.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        countBy(Message, 'type'),
        countBy(Message, 'status')
      ]);
      res.json({
        success: true,
        data: {
          total: allTotal,
          byType: toCountMap(typeRows),
          byStatus: toCountMap(statusRows),
          messages,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        }
      });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async getBirthdayReport(req, res) {
    try {
      const rows = await Contact.aggregate([
        { $match: { dob: { $type: 'date' } } },
        { $group: { _id: { $month: '$dob' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      const byMonth = Object.fromEntries(rows.map(row => [MONTHS[row._id - 1], row.count]));
      res.json({ success: true, data: { total: rows.reduce((sum, row) => sum + row.count, 0), byMonth } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
};

module.exports = reportsController;
