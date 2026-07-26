const Contact = require('../models/Contact');
const contactImport = require('../utils/contactImport');

function buildContactFilter(query) {
  const filter = {};
  if (query.city) filter.city = query.city;
  if (query.sector) filter.sector = query.sector;
  if (query.religion) filter.religion = query.religion;
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;
  return filter;
}

const contactController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, sort = 'firstName', order = 'asc', search = '', ...filters } = req.query;
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
        .limit(Number(limit));
      res.json({ success: true, data, pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) } });
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
      const today = new Date();
      const contacts = await Contact.find({ dob: { $exists: true } });

      const filtered = contacts.filter(c => {
        const dob = new Date(c.dob);
        if (type === 'today') {
          return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
        }
        const diff = getDaysUntilBirthday(dob, today);
        return diff > 0 && diff <= 30;
      });

      res.json({ success: true, data: filtered });
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
      const today = new Date();
      const contacts = await Contact.find({ anniversary: { $exists: true } });

      const filtered = contacts.filter(c => {
        const ann = new Date(c.anniversary);
        if (type === 'today') {
          return ann.getMonth() === today.getMonth() && ann.getDate() === today.getDate();
        }
        const diff = getDaysUntilBirthday(ann, today);
        return diff > 0 && diff <= 30;
      });

      res.json({ success: true, data: filtered });
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
