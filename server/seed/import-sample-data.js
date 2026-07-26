require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Contact = require('../models/Contact');
const Group = require('../models/Group');
const Festival = require('../models/Festival');
const Event = require('../models/Event');
const Template = require('../models/Template');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');
const CommunicationHistory = require('../models/CommunicationHistory');
const Notification = require('../models/Notification');
const DeliveryJob = require('../models/DeliveryJob');
const Settings = require('../models/Settings');

const SAMPLE_DATA_PATH = path.join(__dirname, 'data', 'sample-data.json');

const COLLECTIONS = {
  contacts: { model: Contact },
  groups: { model: Group },
  templates: { model: Template },
  festivals: { model: Festival },
  events: { model: Event },
  campaigns: { model: Campaign },
  deliveryJobs: { model: DeliveryJob },
  messages: { model: Message },
  communicationHistory: { model: CommunicationHistory },
  notifications: { model: Notification }
};

const INSERT_ORDER = [
  'contacts',
  'groups',
  'templates',
  'festivals',
  'events',
  'campaigns',
  'deliveryJobs',
  'messages',
  'communicationHistory',
  'notifications'
];

function parseArgs(argv) {
  const args = { replace: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--replace') args.replace = true;
    if (token === '--dry-run') args.dryRun = true;
  }
  return args;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildIdMap(sampleData) {
  const idMap = new Map();

  for (const collection of INSERT_ORDER) {
    for (const item of sampleData[collection] || []) {
      if (item?._id) {
        idMap.set(String(item._id), new mongoose.Types.ObjectId());
      }
    }
  }

  return idMap;
}

function mapId(idMap, oldId) {
  if (!oldId) return undefined;
  return idMap.get(String(oldId));
}

function mapIdArray(idMap, oldIds) {
  if (!Array.isArray(oldIds)) return [];
  return oldIds.map((id) => mapId(idMap, id)).filter(Boolean);
}

function withMappedId(item, idMap) {
  const doc = clone(item);
  const mappedId = mapId(idMap, doc._id);
  delete doc._id;
  if (mappedId) doc._id = mappedId;
  return doc;
}

function assignMappedId(doc, key, idMap) {
  const mapped = mapId(idMap, doc[key]);
  if (mapped) doc[key] = mapped;
  else delete doc[key];
}

function mapRecipients(doc, idMap) {
  if (!doc.recipients) return;
  if (Array.isArray(doc.recipients.contacts)) {
    doc.recipients.contacts = mapIdArray(idMap, doc.recipients.contacts);
  }
  if (Array.isArray(doc.recipients.groups)) {
    doc.recipients.groups = mapIdArray(idMap, doc.recipients.groups);
  }
}

function buildDocuments(sampleData, idMap) {
  const docs = {};

  docs.contacts = (sampleData.contacts || []).map((item) => {
    const doc = withMappedId(item, idMap);
    doc.groups = mapIdArray(idMap, doc.groups);
    return doc;
  });

  docs.groups = (sampleData.groups || []).map((item) => {
    const doc = withMappedId(item, idMap);
    doc.members = mapIdArray(idMap, doc.members);
    doc.excludedMembers = mapIdArray(idMap, doc.excludedMembers);
    return doc;
  });

  docs.templates = (sampleData.templates || []).map((item) => withMappedId(item, idMap));

  docs.festivals = (sampleData.festivals || []).map((item) => {
    const doc = withMappedId(item, idMap);
    assignMappedId(doc, 'templateId', idMap);
    mapRecipients(doc, idMap);
    return doc;
  });

  docs.events = (sampleData.events || []).map((item) => {
    const doc = withMappedId(item, idMap);
    mapRecipients(doc, idMap);
    return doc;
  });

  docs.campaigns = (sampleData.campaigns || []).map((item) => {
    const doc = withMappedId(item, idMap);
    assignMappedId(doc, 'templateId', idMap);
    mapRecipients(doc, idMap);
    return doc;
  });

  docs.deliveryJobs = (sampleData.deliveryJobs || []).map((item) => {
    const doc = withMappedId(item, idMap);
    assignMappedId(doc, 'campaignId', idMap);
    return doc;
  });

  docs.messages = (sampleData.messages || []).map((item) => {
    const doc = withMappedId(item, idMap);
    assignMappedId(doc, 'jobId', idMap);
    assignMappedId(doc, 'contactId', idMap);
    assignMappedId(doc, 'campaignId', idMap);
    return doc;
  });

  docs.communicationHistory = (sampleData.communicationHistory || []).map((item) => {
    const doc = withMappedId(item, idMap);
    assignMappedId(doc, 'contactId', idMap);
    return doc;
  });

  docs.notifications = (sampleData.notifications || []).map((item) => {
    const doc = withMappedId(item, idMap);
    assignMappedId(doc, 'userId', idMap);
    return doc;
  });

  return docs;
}

function loadSampleData() {
  if (!fs.existsSync(SAMPLE_DATA_PATH)) {
    throw new Error(`Sample data file was not found: ${SAMPLE_DATA_PATH}`);
  }
  return JSON.parse(fs.readFileSync(SAMPLE_DATA_PATH, 'utf8'));
}

function printPlan(sampleData, docs) {
  console.log('Sample data import plan');
  console.log(`  users: ${(sampleData.users || []).length} skipped`);
  console.log(`  settings: ${sampleData.settings ? 1 : 0}`);
  for (const collection of INSERT_ORDER) {
    console.log(`  ${collection}: ${docs[collection].length}`);
  }
}

async function assertDatabaseIsReadyForImport({ replace }) {
  const counts = {};
  for (const collection of INSERT_ORDER) {
    counts[collection] = await COLLECTIONS[collection].model.countDocuments();
  }
  counts.settings = await Settings.countDocuments();

  const existing = Object.entries(counts).filter(([, count]) => count > 0);
  if (existing.length && !replace) {
    const summary = existing.map(([collection, count]) => `${collection}=${count}`).join(', ');
    throw new Error(`Sample data import refused because Mongo already has data (${summary}). Re-run with --replace to clear sample collections first.`);
  }
}

async function clearSampleCollections() {
  for (const collection of [...INSERT_ORDER].reverse()) {
    await COLLECTIONS[collection].model.deleteMany({});
  }
  await Settings.deleteMany({});
}

async function insertDocuments(sampleData, docs, { replace }) {
  await assertDatabaseIsReadyForImport({ replace });

  if (replace) {
    await clearSampleCollections();
  }

  if (sampleData.settings) {
    await Settings.create(clone(sampleData.settings));
  }

  for (const collection of INSERT_ORDER) {
    if (docs[collection].length) {
      await COLLECTIONS[collection].model.insertMany(docs[collection], { ordered: true });
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('username:password')) {
    throw new Error('MONGODB_URI is required.');
  }

  const sampleData = loadSampleData();
  const idMap = buildIdMap(sampleData);
  const docs = buildDocuments(sampleData, idMap);
  printPlan(sampleData, docs);

  if (args.dryRun) {
    console.log('Dry run completed. No MongoDB writes were made.');
    return;
  }

  await mongoose.connect(uri, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000)
  });

  await insertDocuments(sampleData, docs, args);
  await mongoose.disconnect();

  console.log('Sample data import completed.');
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err.message);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore disconnect errors */
    }
    process.exit(1);
  });
}

module.exports = {
  buildDocuments,
  buildIdMap,
  parseArgs,
  loadSampleData,
  main
};
