const { v4: uuidv4 } = require('uuid');
const { buildDueMessageFilter } = require('../time/schedule');
const Message = require('../models/Message');
const DeliveryJob = require('../models/DeliveryJob');
const CommunicationHistory = require('../models/CommunicationHistory');
const Contact = require('../models/Contact');
const Group = require('../models/Group');
const Campaign = require('../models/Campaign');
const Settings = require('../models/Settings');


function normalizeDoc(doc) {
  if (!doc) return null;
  return doc.toObject ? doc.toObject() : { ...doc };
}

async function getSettings() {
  return (await Settings.findOne()) || {};
}

async function getAllContacts() {
  return Contact.find().lean();
}

async function getAllGroups() {
  return Group.find().lean();
}

async function createJob(data) {
  const job = await DeliveryJob.create(data);
  return normalizeDoc(job);
}

async function updateJob(id, updates) {
  return DeliveryJob.findByIdAndUpdate(id, updates, { new: true }).lean();
}

async function getJob(id) {
  return DeliveryJob.findById(id).lean();
}

async function listJobs({ page = 1, limit = 20, campaignId } = {}) {
  const query = campaignId ? { campaignId } : {};
  const total = await DeliveryJob.countDocuments(query);
  const data = await DeliveryJob.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function createMessages(messages) {
  if (!messages?.length) return [];
  const docs = await Message.insertMany(messages, { ordered: false });
  return docs.map(normalizeDoc);
}

async function updateMessage(id, updates) {
  return Message.findByIdAndUpdate(id, updates, { new: true }).lean();
}

async function getMessage(id) {
  return Message.findById(id).lean();
}

async function getPendingMessages(limit = 25) {
  const now = new Date();
  return Message.find(buildDueMessageFilter(now)).sort({ scheduledAt: 1, createdAt: 1 }).limit(limit).lean();
}

async function getJobMessages(jobId, { status, page = 1, limit = 50 } = {}) {
  const q = { jobId };
  if (status) q.status = status;
  const total = await Message.countDocuments(q);
  const data = await Message.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function countMessagesByJob(jobId) {
  const statuses = ['pending', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'scheduled'];
  const counts = {};
  statuses.forEach(s => { counts[s] = 0; });

  const agg = await Message.aggregate([
    { $match: { jobId: require('mongoose').Types.ObjectId.createFromHexString(String(jobId).length === 24 ? jobId : uuidv4().slice(0, 24)) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).catch(() => []);

  if (!agg.length) {
    const all = await Message.find({ jobId }).lean();
    all.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });
    return counts;
  }
  agg.forEach(r => { counts[r._id] = r.count; });
  return counts;
}

async function recountJobStats(jobId) {
  const messages = await Message.find({ jobId }).lean();

  const stats = {
    total: messages.length,
    processed: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    retrying: 0
  };

  messages.forEach(m => {
    if (['sent', 'delivered', 'failed', 'skipped'].includes(m.status)) stats.processed++;
    if (m.status === 'sent') stats.sent++;
    if (m.status === 'delivered') stats.delivered++;
    if (m.status === 'failed') stats.failed++;
    if (m.status === 'skipped') stats.skipped++;
    if (m.status === 'pending' || m.status === 'scheduled') stats.pending++;
    if (m.status === 'processing') stats.pending++;
    if (m.retryCount > 0 && ['pending', 'scheduled'].includes(m.status)) stats.retrying++;
  });

  return stats;
}

async function addCommHistory(entry) {
  return CommunicationHistory.create(entry);
}

async function updateCampaign(id, updates) {
  return Campaign.findByIdAndUpdate(id, updates, { new: true }).lean();
}

async function requeueFailedMessages(jobId) {
  const filter = { jobId, status: 'failed' };
  await Message.updateMany(filter, {
    status: 'pending',
    retryCount: 0,
    nextRetryAt: null,
    error: null,
    failureReason: null
  });
  return Message.countDocuments({ jobId, status: 'pending' });
}

module.exports = {
  getSettings,
  getAllContacts,
  getAllGroups,
  createJob,
  updateJob,
  getJob,
  listJobs,
  createMessages,
  updateMessage,
  getMessage,
  getPendingMessages,
  getJobMessages,
  recountJobStats,
  addCommHistory,
  updateCampaign,
  requeueFailedMessages
};
