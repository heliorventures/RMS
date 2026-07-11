const { v4: uuidv4 } = require('uuid');
const Message = require('../models/Message');
const DeliveryJob = require('../models/DeliveryJob');
const CommunicationHistory = require('../models/CommunicationHistory');
const Contact = require('../models/Contact');
const Group = require('../models/Group');
const Campaign = require('../models/Campaign');
const jsonStore = require('../utils/jsonStore');

let useMongo = false;
function setUseMongo(val) { useMongo = val; }

function normalizeDoc(doc) {
  if (!doc) return null;
  return doc.toObject ? doc.toObject() : { ...doc };
}

async function getSettings() {
  return useMongo ? (await require('../models/Settings').findOne()) || {} : jsonStore.getSettings();
}

async function getAllContacts() {
  return useMongo ? Contact.find().lean() : jsonStore.getAll('contacts');
}

async function getAllGroups() {
  return useMongo ? Group.find().lean() : jsonStore.getAll('groups');
}

async function createJob(data) {
  if (useMongo) {
    const job = await DeliveryJob.create(data);
    return normalizeDoc(job);
  }
  return jsonStore.create('deliveryJobs', data);
}

async function updateJob(id, updates) {
  if (useMongo) {
    const job = await DeliveryJob.findByIdAndUpdate(id, updates, { new: true }).lean();
    return job;
  }
  return jsonStore.update('deliveryJobs', id, updates);
}

async function getJob(id) {
  if (useMongo) return DeliveryJob.findById(id).lean();
  return jsonStore.getById('deliveryJobs', id);
}

async function listJobs({ page = 1, limit = 20 } = {}) {
  if (useMongo) {
    const total = await DeliveryJob.countDocuments();
    const data = await DeliveryJob.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
  return jsonStore.paginate('deliveryJobs', { page, limit, sort: 'createdAt', order: 'desc' });
}

async function createMessages(messages) {
  if (!messages?.length) return [];
  if (useMongo) {
    const docs = await Message.insertMany(messages, { ordered: false });
    return docs.map(normalizeDoc);
  }
  return jsonStore.bulkCreate('messages', messages).items;
}

async function updateMessage(id, updates) {
  if (useMongo) {
    return Message.findByIdAndUpdate(id, updates, { new: true }).lean();
  }
  return jsonStore.update('messages', id, updates);
}

async function getMessage(id) {
  if (useMongo) return Message.findById(id).lean();
  return jsonStore.getById('messages', id);
}

async function getPendingMessages(limit = 25) {
  const now = new Date();
  const filter = {
    status: { $in: ['pending', 'scheduled'] },
    $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }]
  };

  if (useMongo) {
    return Message.find(filter).sort({ createdAt: 1 }).limit(limit).lean();
  }

  return jsonStore.getAll('messages').filter(m => {
    if (!['pending', 'scheduled'].includes(m.status)) return false;
    if (!m.nextRetryAt) return true;
    return new Date(m.nextRetryAt) <= now;
  }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, limit);
}

async function getJobMessages(jobId, { status, page = 1, limit = 50 } = {}) {
  if (useMongo) {
    const q = { jobId };
    if (status) q.status = status;
    const total = await Message.countDocuments(q);
    const data = await Message.find(q).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  let items = jsonStore.getAll('messages').filter(m => String(m.jobId) === String(jobId));
  if (status) items = items.filter(m => m.status === status);
  items.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const total = items.length;
  const start = (page - 1) * limit;
  return { data: items.slice(start, start + limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function countMessagesByJob(jobId) {
  const statuses = ['pending', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'scheduled'];
  const counts = {};
  statuses.forEach(s => { counts[s] = 0; });

  if (useMongo) {
    const agg = await Message.aggregate([
      { $match: { jobId: require('mongoose').Types.ObjectId.createFromHexString(String(jobId).length === 24 ? jobId : uuidv4().slice(0, 24)) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).catch(() => []);

    // Fallback for invalid ObjectId in json mode migration
    if (!agg.length) {
      const all = await Message.find({ jobId }).lean();
      all.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });
      return counts;
    }
    agg.forEach(r => { counts[r._id] = r.count; });
    return counts;
  }

  jsonStore.getAll('messages').filter(m => String(m.jobId) === String(jobId)).forEach(m => {
    counts[m.status] = (counts[m.status] || 0) + 1;
  });
  return counts;
}

async function recountJobStats(jobId) {
  const messages = useMongo
    ? await Message.find({ jobId }).lean()
    : jsonStore.getAll('messages').filter(m => String(m.jobId) === String(jobId));

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
  if (useMongo) return CommunicationHistory.create(entry);
  return jsonStore.create('communicationHistory', entry);
}

async function updateCampaign(id, updates) {
  if (useMongo) return Campaign.findByIdAndUpdate(id, updates, { new: true }).lean();
  return jsonStore.update('campaigns', id, updates);
}

async function requeueFailedMessages(jobId) {
  const filter = { jobId, status: 'failed' };
  if (useMongo) {
    await Message.updateMany(filter, {
      status: 'pending',
      retryCount: 0,
      nextRetryAt: null,
      error: null,
      failureReason: null
    });
    return Message.countDocuments({ jobId, status: 'pending' });
  }

  let count = 0;
  jsonStore.getAll('messages').forEach(m => {
    if (String(m.jobId) === String(jobId) && m.status === 'failed') {
      jsonStore.update('messages', m._id, {
        status: 'pending',
        retryCount: 0,
        nextRetryAt: null,
        error: null,
        failureReason: null
      });
      count++;
    }
  });
  return count;
}

module.exports = {
  setUseMongo,
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
