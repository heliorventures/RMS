const Contact = require('../models/Contact');
const contactImport = require('../utils/contactImport');

const MAX_PAGE_SIZE = 100;

function pageRequest(query, fallbackLimit = 25) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || fallbackLimit));
  return { page, limit };
}

function buildContactFilter(query) {
  const filter = {};
  if (query.city) filter.city = query.city;
  if (query.sector) filter.sector = query.sector;
  if (query.religion) filter.religion = query.religion;
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;
  return filter;
}

function datesFromToday(daysAhead, includeToday = false) {
  const dates = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let offset = includeToday ? 0 : 1; offset <= daysAhead; offset += 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + offset);
    dates.push({ month: date.getMonth() + 1, day: date.getDate() });
  }
  return dates;
}

function annualDateFilter(field, dates) {
  return {
    [field]: { $type: 'date' },
    $expr: {
      $or: dates.map(({ month, day }) => ({
        $and: [
          { $eq: [{ $month: `$${field}` }, month] },
          { $eq: [{ $dayOfMonth: `$${field}` }, day] }
        ]
      }))
    }
  };
}

const contactController = {
  async getAll(req, res) {
    try {
      const { sort = 'firstName', order = 'asc', search = '', ...filters } = req.query;
      const { page, limit } = pageRequest(req.query);
      const q = {};
      if (search) {
        q.$or = [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
          { mobile: new RegExp(search, 'i') },
          { company: new RegExp(search, 'i') },
          { designation: new RegExp(search, 'i') },
          { occupation: new RegExp(search, 'i') }
        ];
      }
      Object.assign(q, buildContactFilter(filters));
      const total = await Contact.countDocuments(q);
      const data = await Contact.find(q)
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req, res) {
    try {
      const contact = await Contact.findById(req.params.id);
      if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });
      res.json({ success: true, data: contact });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const data = { ...req.body };
      if (req.file) data.photo = `/uploads/contacts/${req.file.filename}`;
      const contact = await Contact.create(data);
      res.status(201).json({ success: true, data: contact });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const data = { ...req.body };
      if (req.file) data.photo = `/uploads/contacts/${req.file.filename}`;
      const contact = await Contact.findByIdAndUpdate(req.params.id, data, { new: true });
      if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });
      res.json({ success: true, data: contact });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

    async remove(req, res) {
    try {
      const contact = await Contact.findByIdAndDelete(req.params.id);
      if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });
      res.json({ success: true, message: 'Contact deleted.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getBirthdays(req, res) {
    try {
      const { type = 'today' } = req.query;
      const { page, limit } = pageRequest(req.query);
      const filter = annualDateFilter('dob', type === 'today' ? datesFromToday(0, true) : datesFromToday(30));
      const total = await Contact.countDocuments(filter);
      const data = await Contact.find(filter)
        .sort({ firstName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getBirthdayCalendar(req, res) {
    try {
      const month = Number.parseInt(req.query.month, 10);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ success: false, message: 'A calendar month from 1 through 12 is required.' });
      }
      const day = Number.parseInt(req.query.day, 10);
      if (Number.isInteger(day)) {
        if (day < 1 || day > 31) {
          return res.status(400).json({ success: false, message: 'A calendar day from 1 through 31 is required.' });
        }
        const { page, limit } = pageRequest(req.query);
        const filter = annualDateFilter('dob', [{ month, day }]);
        const total = await Contact.countDocuments(filter);
        const data = await Contact.find(filter)
          .sort({ firstName: 1, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();
        return res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
      }

      const data = await Contact.aggregate([
        { $match: { dob: { $type: 'date' } } },
        { $project: { day: { $dayOfMonth: '$dob' }, month: { $month: '$dob' } } },
        { $match: { month } },
        { $group: { _id: '$day', count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id', count: 1 } },
        { $sort: { day: 1 } }
      ]);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async bulkImport(req, res) {
    try {
      const rows = req.body.contacts;
      if (!Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ success: false, message: 'No contacts provided.' });
      }
      if (rows.length > 2000) {
        return res.status(400).json({ success: false, message: 'Maximum 2,000 contacts per batch.' });
      }

      const { valid, errors } = contactImport.prepareContacts(rows);
      if (!valid.length) {
        return res.status(400).json({ success: false, message: 'No valid contacts found.', errors });
      }

      const inserted = await Contact.insertMany(valid, { ordered: false });
      res.json({
        success: true,
        data: { inserted: inserted.length, skipped: errors.length, errors: errors.slice(0, 20) }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getAnniversaries(req, res) {
    try {
      const { type = 'today' } = req.query;
      const { page, limit } = pageRequest(req.query);
      const filter = annualDateFilter('anniversary', type === 'today' ? datesFromToday(0, true) : datesFromToday(30));
      const total = await Contact.countDocuments(filter);
      const data = await Contact.find(filter)
        .sort({ firstName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async bulkLookup(req, res) {
    try {
      const ids = [...new Set((req.body?.ids || []).filter(id => typeof id === 'string'))].slice(0, 500);
      if (!ids.length) return res.status(400).json({ success: false, message: 'At least one contact ID is required.' });
      const contacts = await Contact.find({ _id: { $in: ids } }).lean();
      const byId = new Map(contacts.map(contact => [String(contact._id), contact]));
      res.json({ success: true, data: ids.map(id => byId.get(id)).filter(Boolean) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

function getDaysUntilBirthday(date, today) {
  const next = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
}

module.exports = contactController;
