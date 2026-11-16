const Festival = require('../models/Festival');
const logger = require('../utils/logger');

async function prepareFestival(festival, job, status) {
  const filter = { _id: festival._id, $or: [{ status: { $ne: 'scheduled' } }, { deliveryJobId: null }], deliveryJobId: festival.deliveryJobId || null };
  if (festival.updatedAt) filter.updatedAt = festival.updatedAt;
  const previous = await Festival.findOneAndUpdate(filter,
    { $set: { status: 'scheduled', deliveryJobId: job._id, deliveryStatus: status } }, { new: false, runValidators: true }).lean();
  if (!previous) throw Object.assign(new Error('Festival changed or its delivery is already queued. Reload before sending again.'), { status: 409 });
  return previous;
}

async function restoreFestivalPreparation(job, previous) {
  await Festival.findOneAndUpdate({ _id: job.festivalId, deliveryJobId: job._id }, { $set: {
    status: previous.status, deliveryJobId: previous.deliveryJobId || null, deliveryStatus: previous.deliveryStatus || null
  } }, { new: true, runValidators: true });
}

async function lockFestivalRetry(job) {
  if (!job?.festivalId) return;
  const previous = await Festival.findOneAndUpdate({ _id: job.festivalId, deliveryJobId: job._id },
    { $set: { status: 'scheduled', deliveryStatus: 'queued' } }, { new: false, runValidators: true }).lean();
  if (!previous) throw Object.assign(new Error('Festival has changed delivery ownership. Its old job cannot be retried.'), { status: 409 });
}

async function syncFestivalStatus(job, status, stats) {
  if (!job?.festivalId) return;
  try {
    const updates = { deliveryStatus: status, status: ['completed', 'partial'].includes(status) ? 'sent' : ['failed', 'cancelled'].includes(status) ? 'draft' : 'scheduled' };
    if (stats) updates.sentCount = (stats.sent || 0) + (stats.delivered || 0);
    await Festival.findOneAndUpdate({ _id: job.festivalId, deliveryJobId: job._id }, { $set: updates }, { new: true, runValidators: true });
  } catch (error) { logger.error('Festival delivery status update failed', { festivalId: job.festivalId, jobId: job._id, error: error.message }); }
}

module.exports = { prepareFestival, restoreFestivalPreparation, syncFestivalStatus, lockFestivalRetry };
