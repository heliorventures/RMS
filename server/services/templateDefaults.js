const Template = require('../models/Template');

// Run before accepting writes: keep the newest existing choice in each type,
// then let MongoDB enforce the invariant across concurrent server processes.
async function initializeTemplateDefaults() {
  const defaults = await Template.find({ isDefault: true }).sort({ updatedAt: -1, _id: -1 }).lean();
  const seen = new Set();
  const duplicates = [];
  for (const item of defaults) {
    if (seen.has(item.type)) duplicates.push(item._id);
    seen.add(item.type);
  }
  if (duplicates.length) await Template.updateMany({ _id: { $in: duplicates }, isDefault: true }, { $set: { isDefault: false } });
  await Template.collection.createIndex({ type: 1 }, { name: 'one_default_template_per_type', unique: true, partialFilterExpression: { isDefault: true } });
}

function templateInput(body) {
  if (Object.keys(body).some(key => key.startsWith('$') || key.includes('.'))) {
    throw Object.assign(new Error('Template updates must contain plain editable fields.'), { status: 400 });
  }
  const fields = new Set(['name', 'type', 'subject', 'body', 'whatsapp', 'variables', 'isDefault', 'isActive']);
  return Object.fromEntries(Object.entries(body).filter(([key]) => fields.has(key)));
}

async function prepareTemplateDefault(body, id) {
  const data = templateInput(body);
  const existing = id ? await Template.findById(id).lean() : null;
  if (id && !existing) throw Object.assign(new Error('Not found.'), { status: 404 });
  const candidate = new Template({ ...existing, ...data });
  await candidate.validate();
  let previousDefault;
  if (candidate.isDefault) {
    const query = { type: candidate.type, isDefault: true };
    if (id) query._id = { $ne: id };
    previousDefault = await Template.findOne(query).lean();
    await Template.updateMany(query, { $set: { isDefault: false } });
  }
  return { data, previousDefault };
}

async function saveTemplate(body, id, write) {
  const { data, previousDefault } = await prepareTemplateDefault(body, id);
  try {
    const item = await write(data);
    if (!item) throw Object.assign(new Error('Not found.'), { status: 404 });
    return item;
  } catch (error) {
    if (previousDefault) {
      try {
        // The unique index refuses restoration if a newer default has won.
        await Template.updateOne({ _id: previousDefault._id, isDefault: false }, { $set: { isDefault: true } });
      } catch (restoreError) {
        if (restoreError.code !== 11000) require('../utils/logger').error('Template default restoration failed', { templateId: previousDefault._id, error: restoreError.message });
      }
    }
    throw error;
  }
}

module.exports = { initializeTemplateDefaults, saveTemplate };
