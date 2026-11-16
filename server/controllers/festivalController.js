const Festival = require('../models/Festival');
const createCrud = require('./crudFactory');
const { normalizeSchedule } = require('../time/schedule');

function input(body) {
  if (Object.keys(body).some(key => key.startsWith('$') || key.includes('.'))) throw Object.assign(new Error('Festival updates must contain plain editable fields.'), { status: 400 });
  const fields = new Set(['name', 'date', 'religion', 'message', 'channel', 'recipients', 'scheduledAt', 'scheduleTimezone', 'image', 'templateId']);
  const data = Object.fromEntries(Object.entries(body).filter(([key]) => fields.has(key)));
  if (Object.hasOwn(data, 'scheduledAt')) Object.assign(data, normalizeSchedule(data));
  return data;
}
const failure = (res, error) => res.status(error.status || (['ValidationError', 'CastError'].includes(error.name) ? 400 : 500)).json({ success: false, message: error.message });

module.exports = {
  ...createCrud(Festival, 'festivals'),
  async create(req, res) {
    try {
      const data = input(req.body);
      if (req.file) data.image = `/uploads/${req.params.type || 'general'}/${req.file.filename}`;
      return res.status(201).json({ success: true, data: await Festival.create({ ...data, status: 'draft' }) });
    } catch (error) { return failure(res, error); }
  },
  async update(req, res) {
    try {
      const data = input(req.body);
      if (req.file) data.image = `/uploads/${req.params.type || 'general'}/${req.file.filename}`;
      const festival = await Festival.findOneAndUpdate({ _id: req.params.id, $or: [{ status: { $ne: 'scheduled' } }, { deliveryJobId: null }] }, { $set: { ...data, status: 'draft' } }, { new: true, runValidators: true });
      if (!festival) return res.status(409).json({ success: false, message: 'This festival is already queued or no longer exists. Check its delivery before editing or sending again.' });
      return res.json({ success: true, data: festival });
    } catch (error) { return failure(res, error); }
  },
  async remove(req, res) {
    try {
      const festival = await Festival.findOneAndDelete({ _id: req.params.id, $or: [{ status: { $ne: 'scheduled' } }, { deliveryJobId: null }] });
      if (!festival) return res.status(409).json({ success: false, message: 'A queued festival cannot be deleted while its delivery is active.' });
      return res.json({ success: true, message: 'Deleted.' });
    } catch (error) { return failure(res, error); }
  }
};
