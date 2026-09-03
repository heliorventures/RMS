require('dotenv').config();

const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const { getSecretCipher } = require('../security/secretCipher');
const { isPlaceholderMongoUri } = require('./delete-data');

const CONFIRMATION = 'ENCRYPT_RMS_SETTINGS_SECRETS';
const OPTION_NAMES = new Map([
  ['database', 'database'],
  ['confirm', 'confirm'],
  ['backup-evidence', 'backupEvidence']
]);

function parseArgs(argv) {
  const args = { execute: false, database: undefined, confirm: undefined, backupEvidence: undefined };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || token === '--') throw new Error(`Unknown argument: ${token}`);

    const equalsIndex = token.indexOf('=');
    const option = token.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : token.slice(equalsIndex + 1);
    if (option !== 'execute' && !OPTION_NAMES.has(option)) throw new Error(`Unknown argument: ${token}`);
    if (seen.has(option)) throw new Error(`Option --${option} may only be provided once.`);
    seen.add(option);

    if (option === 'execute') {
      if (inlineValue !== undefined) throw new Error('Option --execute does not accept a value.');
      args.execute = true;
      continue;
    }

    let value = inlineValue;
    if (value === undefined) {
      value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`Option --${option} requires a value.`);
      index += 1;
    }
    value = value.trim();
    if (!value) throw new Error(`Option --${option} requires a non-empty value.`);
    args[OPTION_NAMES.get(option)] = value;
  }

  return args;
}

function isEncryptedEnvelope(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.v === 1 &&
    typeof value.keyId === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.tag === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

function secretState(value) {
  if (typeof value === 'string') return value.trim() ? 'plaintext' : 'empty';
  return isEncryptedEnvelope(value) ? 'encrypted' : 'empty';
}

function inspectSettingsSecrets(documents) {
  const report = {
    documents: documents.length,
    smtp: { plaintext: 0, encrypted: 0, empty: 0 },
    whatsapp: { plaintext: 0, encrypted: 0, empty: 0 },
    documentsNeedingMigration: 0
  };

  for (const document of documents) {
    const smtpState = secretState(document?.smtp?.password);
    const whatsappState = secretState(document?.whatsapp?.apiKey);
    report.smtp[smtpState] += 1;
    report.whatsapp[whatsappState] += 1;
    if (smtpState === 'plaintext' || whatsappState === 'plaintext') report.documentsNeedingMigration += 1;
  }
  return report;
}

async function migrateSettingsSecrets({ documents, model, cipher, execute = false }) {
  const report = inspectSettingsSecrets(documents);
  if (!execute || report.documentsNeedingMigration === 0) return report;
  if (!model?.bulkWrite || !cipher) throw new Error('A settings model and encryption cipher are required for execution.');

  const operations = [];
  for (const document of documents) {
    const update = {};
    if (secretState(document?.smtp?.password) === 'plaintext') {
      update['smtp.password'] = cipher.encrypt(document.smtp.password);
    }
    if (secretState(document?.whatsapp?.apiKey) === 'plaintext') {
      update['whatsapp.apiKey'] = cipher.encrypt(document.whatsapp.apiKey);
    }
    if (Object.keys(update).length) {
      operations.push({ updateOne: { filter: { _id: document._id }, update: { $set: update } } });
    }
  }

  const result = await model.bulkWrite(operations, { ordered: true });
  if (!result?.acknowledged) throw new Error('MongoDB did not acknowledge the settings secret migration.');
  return report;
}

function assertExecutionGuard(args, connectedDatabase) {
  if (!args.execute) return;
  if (!args.database || args.database !== connectedDatabase) {
    throw new Error(`--database must exactly match the connected database (${connectedDatabase}).`);
  }
  if (args.confirm !== CONFIRMATION) {
    throw new Error(`--confirm=${CONFIRMATION} is required when using --execute.`);
  }
  if (!args.backupEvidence) {
    throw new Error('--backup-evidence is required when using --execute and must identify a recoverable backup.');
  }
}

function printReport(report, { databaseName, execute }) {
  console.log('RMS settings secret encryption plan');
  console.log(`  Connected database: ${databaseName}`);
  console.log(`  Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`  Settings documents: ${report.documents}`);
  console.log(`  SMTP credentials: plaintext=${report.smtp.plaintext}, encrypted=${report.smtp.encrypted}, empty=${report.smtp.empty}`);
  console.log(`  WhatsApp credentials: plaintext=${report.whatsapp.plaintext}, encrypted=${report.whatsapp.encrypted}, empty=${report.whatsapp.empty}`);
  console.log(`  Documents requiring migration: ${report.documentsNeedingMigration}`);
  if (!execute) console.log('Dry run completed. No MongoDB writes were made.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (isPlaceholderMongoUri(uri)) throw new Error('MONGODB_URI is required and must not contain placeholder credentials.');

  let operationError;
  try {
    await mongoose.connect(uri, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000)
    });
    const databaseName = mongoose.connection.db.databaseName;
    assertExecutionGuard(args, databaseName);

    const projection = { _id: 1, 'smtp.password': 1, 'whatsapp.apiKey': 1 };
    const documents = await Settings.find({}, projection).lean();
    const report = await migrateSettingsSecrets({
      documents,
      model: Settings,
      cipher: args.execute ? getSecretCipher() : undefined,
      execute: args.execute
    });
    printReport(report, { databaseName, execute: args.execute });

    if (args.execute) {
      const remaining = inspectSettingsSecrets(await Settings.find({}, projection).lean());
      if (remaining.documentsNeedingMigration !== 0) {
        throw new Error(`Migration verification failed: ${remaining.documentsNeedingMigration} settings document(s) still contain plaintext credentials.`);
      }
      console.log('Migration completed and verified. No plaintext provider credentials remain.');
    }
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      if (operationError) console.error(`MongoDB disconnect also failed: ${disconnectError.message}`);
      else throw new Error(`MongoDB disconnect failed: ${disconnectError.message}`);
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRMATION,
  parseArgs,
  isEncryptedEnvelope,
  inspectSettingsSecrets,
  migrateSettingsSecrets,
  assertExecutionGuard,
  main
};
