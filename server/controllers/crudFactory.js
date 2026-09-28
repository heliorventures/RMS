const { normalizeSchedule } = require('../time/schedule');

function normalizeInput(body, collection) {
  let data = { ...body };
  if (collection === 'events') {
    if (Object.keys(data).some(key => key.startsWith('$') || key.includes('.'))) {
      throw Object.assign(new Error('Event updates must contain plain editable fields.'), { status: 400 });
    }
    const editable = new Set(['title', 'description', 'venue', 'date', 'time', 'mapsLink', 'channel', 'audience',
      'invitationImage', 'invitationPdf', 'recipients', 'scheduledAt', 'scheduleTimezone']);
    data = Object.fromEntries(Object.entries(data).filter(([key]) => editable.has(key)));
    if (Object.hasOwn(data, 'scheduledAt')) Object.assign(data, normalizeSchedule(data));
    // Job creation and the delivery worker are the only authorities that may
    // change lifecycle state. Event edits must not be able to overwrite it.
    delete data.status;
    delete data.deliveryJobId;
    delete data.deliveryStats;
  }
  return data;
}

function createCrudController(Model, collection) {
  return {
    async getAll(req, res) {
      try {
        const { page, limit, search, sort, order, ...filters } = req.query;
        const q = {};
        Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') q[k] = v; });
        if (search) q.$or = [{ name: new RegExp(search, 'i') }, { title: new RegExp(search, 'i') }];
        const data = page
          ? await Model.find(q).sort({ [sort || 'createdAt']: order === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(+limit)
          : await Model.find(q).sort({ createdAt: -1 });
        const total = await Model.countDocuments(q);
        res.json({ success: true, data, pagination: page ? { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) } : undefined });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    async getById(req, res) {
      try {
        const item = await Model.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found.' });
        res.json({ success: true, data: item });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    async create(req, res) {
      try {
        const data = normalizeInput(req.body, collection);
        if (req.file) data[req.file.fieldname === 'file' ? 'image' : req.file.fieldname] = `/uploads/${req.params.type || 'general'}/${req.file.filename}`;
        const item = await Model.create(data);
        res.status(201).json({ success: true, data: item });
      } catch (err) {
        res.status(err.status || (['ValidationError', 'CastError'].includes(err.name) ? 400 : 500)).json({ success: false, message: err.message });
      }
    },

    async update(req, res) {
      try {
        const data = normalizeInput(req.body, collection);
        if (req.file) data.image = `/uploads/${req.params.type || 'general'}/${req.file.filename}`;
        const updates = collection === 'events' ? { $set: data } : data;
        const item = await Model.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ success: false, message: 'Not found.' });
        res.json({ success: true, data: item });
      } catch (err) {
        res.status(err.status || (['ValidationError', 'CastError'].includes(err.name) ? 400 : 500)).json({ success: false, message: err.message });
      }
    },

    async remove(req, res) {
      try {
        await Model.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted.' });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  };
}

module.exports = createCrudController;
