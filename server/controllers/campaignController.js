const Campaign = require('../models/Campaign');
const createCrud = require('./crudFactory');
const { normalizeSchedule } = require('../time/schedule');
const { validateCampaignAudience } = require('../utils/campaignAudience');

function editableInput(body) {
  if (Object.keys(body).some(key => key.startsWith('$') || key.includes('.'))) throw Object.assign(new Error('Campaign updates must contain plain editable fields.'), { status: 400 });
  const fields = new Set(['name', 'type', 'channel', 'content', 'audience', 'recipients', 'scheduledAt', 'scheduleTimezone']);
  const data = Object.fromEntries(Object.entries(body).filter(([key]) => fields.has(key)));
  if (Object.hasOwn(data, 'scheduledAt')) Object.assign(data, normalizeSchedule(data));
  validateCampaignAudience(data);
  return data;
}
function failure(res, error) { return res.status(error.status || (['ValidationError', 'CastError'].includes(error.name) ? 400 : 500)).json({ success: false, message: error.message }); }

module.exports = {
  ...createCrud(Campaign, 'campaigns'),
  async create(req, res) {
    try {
      const campaign = await Campaign.create({ ...editableInput(req.body), status: 'draft' });
      return res.status(201).json({ success: true, data: campaign });
    } catch (error) { return failure(res, error); }
  },
  async update(req, res) {
    try {
      const data = editableInput(req.body);
      const campaign = await Campaign.findOneAndUpdate({ _id: req.params.id, status: 'draft' }, { $set: data }, { new: true, runValidators: true });
      if (!campaign) return res.status(409).json({ success: false, message: 'Only draft campaigns can be edited. Reload the campaign list.' });
      return res.json({ success: true, data: campaign });
    } catch (error) { return failure(res, error); }
  }
};
