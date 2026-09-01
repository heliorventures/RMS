require('dotenv').config();

const mongoose = require('mongoose');

const User = require('../models/User');
const Settings = require('../models/Settings');
const Message = require('../models/Message');
const DeliveryJob = require('../models/DeliveryJob');
const CommunicationHistory = require('../models/CommunicationHistory');
const Campaign = require('../models/Campaign');
const Event = require('../models/Event');
const Festival = require('../models/Festival');
const Notification = require('../models/Notification');
const Contact = require('../models/Contact');
const Group = require('../models/Group');
const Template = require('../models/Template');

const COLLECTIONS = [
  { name: 'users', model: User, protected: true },
  { name: 'settings', model: Settings, protected: true },
  { name: 'messages', model: Message, protected: false },
  { name: 'deliveryJobs', model: DeliveryJob, protected: false },
  { name: 'communicationHistory', model: CommunicationHistory, protected: false },
  { name: 'campaigns', model: Campaign, protected: false },
  { name: 'events', model: Event, protected: false },
  { name: 'festivals', model: Festival, protected: false },
  { name: 'notifications', model: Notification, protected: false },
  { name: 'contacts', model: Contact, protected: false },
  { name: 'groups', model: Group, protected: false },
  { name: 'templates', model: Template, protected: false }
];

const SCALAR_OPTIONS = new Set(['database', 'collections', 'confirm']);
const LOCAL_MONGO_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function parseArgs(argv) {
  const args = {
    execute: false,
    database: undefined,
    collections: undefined,
    confirm: undefined
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || token === '--') {
      throw new Error(`Unknown argument: ${token}`);
    }

    const equalsIndex = token.indexOf('=');
    const option = token.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : token.slice(equalsIndex + 1);

    if (option !== 'execute' && !SCALAR_OPTIONS.has(option)) {
      throw new Error(`Unknown argument: ${token}`);
    }
    if (seen.has(option)) {
      throw new Error(`Option --${option} may only be provided once.`);
    }
    seen.add(option);

    if (option === 'execute') {
      if (inlineValue !== undefined) {
        throw new Error('Option --execute does not accept a value.');
      }
      args.execute = true;
      continue;
    }

    let value = inlineValue;
    if (value === undefined) {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`Option --${option} requires a value.`);
      }
      value = next;
      index += 1;
    }

    value = value.trim();
    if (!value) {
      throw new Error(`Option --${option} requires a non-empty value.`);
    }
    args[option] = value;
  }

  return args;
}

function resolveSelection(collectionArg, registry) {
  if (typeof collectionArg !== 'string' || !collectionArg.trim()) {
    throw new Error('A non-empty --collections value is required.');
  }

  const names = collectionArg.split(',').map((name) => name.trim());
  if (names.some((name) => !name)) {
    throw new Error('--collections cannot contain an empty collection name.');
  }
  if (new Set(names).size !== names.length) {
    throw new Error('--collections cannot contain duplicate collection names.');
  }
  if (names.includes('all')) {
    if (names.length !== 1) {
      throw new Error('--collections=all cannot be combined with named collections.');
    }
    return registry.filter((entry) => !entry.protected);
  }

  const entriesByName = new Map(registry.map((entry) => [entry.name, entry]));
  for (const name of names) {
    const entry = entriesByName.get(name);
    if (!entry) {
      throw new Error(`Unknown collection: ${name}`);
    }
    if (entry.protected) {
      throw new Error(`Collection ${name} is protected and cannot be deleted.`);
    }
  }

  const requestedNames = new Set(names);
  return registry.filter((entry) => requestedNames.has(entry.name));
}

async function snapshotIds(entries) {
  const snapshots = new Map();

  for (const entry of entries) {
    const documents = await entry.model.find({}, { _id: 1 }).lean();
    const ids = documents.map((document) => String(document._id)).sort();
    snapshots.set(entry.name, ids);
  }

  return snapshots;
}

async function countCollections(entries) {
  const counts = new Map();

  for (const entry of entries) {
    counts.set(entry.name, await entry.model.countDocuments({}));
  }

  return counts;
}

function assertSnapshotsEqual(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);

  for (const name of names) {
    const beforeIds = before.get(name);
    const afterIds = after.get(name);
    if (!beforeIds || !afterIds || beforeIds.length !== afterIds.length) {
      throw new Error(`Protected collection ${name} changed during deletion.`);
    }
    if (beforeIds.some((id, index) => id !== afterIds[index])) {
      throw new Error(`Protected collection ${name} changed during deletion.`);
    }
  }
}

function printPlan({ databaseName, execute, selectedCounts, protectedCounts }) {
  console.log('RMS data deletion plan');
  console.log(`  Connected database: ${databaseName}`);
  console.log(`  Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log('  Selected collections:');
  for (const [name, count] of selectedCounts) {
    console.log(`    ${name}: ${count}`);
  }
  console.log('  Protected collections (will be preserved):');
  for (const [name, count] of protectedCounts) {
    console.log(`    ${name}: ${count}`);
  }
  console.log('  WARNING: Verify that a recoverable MongoDB backup exists before execution.');
}

function getMongoHosts(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    return [];
  }

  return parsed.host
    .split(',')
    .map((host) => {
      const trimmed = host.trim().toLowerCase();
      if (!trimmed) {
        return '';
      }
      if (trimmed.startsWith('[')) {
        return trimmed.slice(1, trimmed.indexOf(']'));
      }
      return trimmed.split(':')[0];
    })
    .filter(Boolean);
}

function isLocalMongoUri(uri) {
  const hosts = getMongoHosts(uri);
  return hosts.length > 0 && hosts.every((host) => LOCAL_MONGO_HOSTS.has(host));
}

function isPlaceholderMongoUri(uri) {
  if (!uri || /<[^>]+>/.test(uri)) {
    return true;
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  const username = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');

  if (username === 'username' && password === 'password') {
    return true;
  }

  return username === 'mongoadmin' && password === 'password' && !isLocalMongoUri(uri);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selectedEntries = resolveSelection(args.collections, COLLECTIONS);
  const uri = (process.env.MONGODB_URI || '').trim();

  if (isPlaceholderMongoUri(uri)) {
    throw new Error('MONGODB_URI is required and must not contain placeholder credentials.');
  }
  if (args.execute && !args.database) {
    throw new Error('--database is required when using --execute.');
  }
  if (args.execute && args.confirm !== 'DELETE_RMS_DATA') {
    throw new Error('--confirm=DELETE_RMS_DATA is required when using --execute.');
  }

  let operationError;
  try {
    await mongoose.connect(uri, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000)
    });

    const databaseName = mongoose.connection.db.databaseName;
    console.log(`Connected database: ${databaseName}`);

    if (args.execute && args.database !== databaseName) {
      throw new Error(`--database must exactly match the connected database (${databaseName}).`);
    }

    const protectedEntries = COLLECTIONS.filter((entry) => entry.protected);
    const protectedSnapshotBefore = await snapshotIds(protectedEntries);
    const selectedCounts = await countCollections(selectedEntries);
    const protectedCounts = await countCollections(protectedEntries);

    printPlan({
      databaseName,
      execute: args.execute,
      selectedCounts,
      protectedCounts
    });

    if (!args.execute) {
      console.log('Dry run completed. No MongoDB writes were made.');
      return;
    }

    for (const entry of selectedEntries) {
      let result;
      try {
        result = await entry.model.deleteMany({});
      } catch (error) {
        throw new Error(`Deletion failed for ${entry.name}: ${error.message}`);
      }
      if (!result.acknowledged) {
        throw new Error(`Deletion was not acknowledged for ${entry.name}.`);
      }
      console.log(`Deleted ${result.deletedCount} document(s) from ${entry.name}.`);
    }

    const remainingCounts = await countCollections(selectedEntries);
    console.log('Remaining selected collection counts:');
    for (const [name, count] of remainingCounts) {
      console.log(`  ${name}: ${count}`);
    }
    const nonEmptyCollections = [...remainingCounts]
      .filter(([, count]) => count !== 0)
      .map(([name, count]) => `${name}=${count}`);
    if (nonEmptyCollections.length) {
      throw new Error(`Deletion verification failed; remaining documents: ${nonEmptyCollections.join(', ')}.`);
    }

    const protectedSnapshotAfter = await snapshotIds(protectedEntries);
    assertSnapshotsEqual(protectedSnapshotBefore, protectedSnapshotAfter);
    console.log('Deletion completed and protected collections were preserved.');
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      if (operationError) {
        console.error(`MongoDB disconnect also failed: ${disconnectError.message}`);
      } else {
        throw new Error(`MongoDB disconnect failed: ${disconnectError.message}`);
      }
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  COLLECTIONS,
  parseArgs,
  resolveSelection,
  snapshotIds,
  countCollections,
  assertSnapshotsEqual,
  getMongoHosts,
  isLocalMongoUri,
  isPlaceholderMongoUri,
  main
};
