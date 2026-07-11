function createCrudController(Model, collection) {
  const jsonStore = require('../utils/jsonStore');
  let useMongo = false;

  return {
    setUseMongo(val) { useMongo = val; },

    async getAll(req, res) {
      try {
        const { page, limit, search, sort, order, ...filters } = req.query;
        if (useMongo) {
          const q = {};
          Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'all') q[k] = v; });
          if (search) q.$or = [{ name: new RegExp(search, 'i') }, { title: new RegExp(search, 'i') }];
          const data = page
            ? await Model.find(q).sort({ [sort || 'createdAt']: order === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(+limit)
            : await Model.find(q).sort({ createdAt: -1 });
          const total = await Model.countDocuments(q);
          return res.json({ success: true, data, pagination: page ? { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) } : undefined });
        }
        if (page) {
          const result = jsonStore.paginate(collection, { page: +page, limit: +limit, sort, order, search, filters });
          return res.json({ success: true, ...result });
        }
        res.json({ success: true, data: jsonStore.getAll(collection) });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    async getById(req, res) {
      try {
        if (useMongo) {
          const item = await Model.findById(req.params.id);
          if (!item) return res.status(404).json({ success: false, message: 'Not found.' });
          return res.json({ success: true, data: item });
        }
        const item = jsonStore.getById(collection, req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found.' });
        res.json({ success: true, data: item });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    async create(req, res) {
      try {
        const data = { ...req.body };
        if (req.file) data[req.file.fieldname === 'file' ? 'image' : req.file.fieldname] = `/uploads/${req.params.type || 'general'}/${req.file.filename}`;
        if (useMongo) {
          const item = await Model.create(data);
          return res.status(201).json({ success: true, data: item });
        }
        const item = jsonStore.create(collection, data);
        res.status(201).json({ success: true, data: item });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    async update(req, res) {
      try {
        const data = { ...req.body };
        if (req.file) data.image = `/uploads/${req.params.type || 'general'}/${req.file.filename}`;
        if (useMongo) {
          const item = await Model.findByIdAndUpdate(req.params.id, data, { new: true });
          if (!item) return res.status(404).json({ success: false, message: 'Not found.' });
          return res.json({ success: true, data: item });
        }
        const item = jsonStore.update(collection, req.params.id, data);
        if (!item) return res.status(404).json({ success: false, message: 'Not found.' });
        res.json({ success: true, data: item });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    async remove(req, res) {
      try {
        if (useMongo) {
          await Model.findByIdAndDelete(req.params.id);
          return res.json({ success: true, message: 'Deleted.' });
        }
        jsonStore.delete(collection, req.params.id);
        res.json({ success: true, message: 'Deleted.' });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  };
}

module.exports = createCrudController;
