const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecretCipher } = require('../server/security/secretCipher');
const {
  inspectSettingsSecrets,
  migrateSettingsSecrets,
  assertExecutionGuard
} = require('../server/maintenance/encrypt-settings-secrets');

const cipher = createSecretCipher([{ id: 'migration-key', key: Buffer.alloc(32, 9) }]);

test('legacy secret migration dry run reports counts without writing or exposing values', async () => {
  const documents = [
    { _id: 'settings-1', smtp: { password: 'legacy-smtp' }, whatsapp: { apiKey: 'legacy-wa' } },
    { _id: 'settings-2', smtp: { password: cipher.encrypt('encrypted-smtp') }, whatsapp: {} }
  ];
  const writes = [];
  const model = { bulkWrite: async operations => writes.push(...operations) };

  const report = await migrateSettingsSecrets({ documents, model, cipher, execute: false });

  assert.deepEqual(report, {
    documents: 2,
    smtp: { plaintext: 1, encrypted: 1, empty: 0 },
    whatsapp: { plaintext: 1, encrypted: 0, empty: 1 },
    documentsNeedingMigration: 1
  });
  assert.deepEqual(writes, []);
  assert.equal(JSON.stringify(report).includes('legacy-smtp'), false);
  assert.equal(JSON.stringify(report).includes('legacy-wa'), false);
});

test('legacy secret migration encrypts only non-empty plaintext credentials', async () => {
  const alreadyEncrypted = cipher.encrypt('already-encrypted');
  const documents = [
    { _id: 'settings-1', smtp: { password: 'legacy-smtp' }, whatsapp: { apiKey: '' } },
    { _id: 'settings-2', smtp: { password: alreadyEncrypted }, whatsapp: { apiKey: 'legacy-wa' } }
  ];
  let operations = [];
  const model = {
    bulkWrite: async nextOperations => {
      operations = nextOperations;
      return { acknowledged: true, modifiedCount: nextOperations.length };
    }
  };

  await migrateSettingsSecrets({ documents, model, cipher, execute: true });

  assert.equal(operations.length, 2);
  assert.equal(cipher.decrypt(operations[0].updateOne.update.$set['smtp.password']), 'legacy-smtp');
  assert.equal(Object.hasOwn(operations[0].updateOne.update.$set, 'whatsapp.apiKey'), false);
  assert.equal(cipher.decrypt(operations[1].updateOne.update.$set['whatsapp.apiKey']), 'legacy-wa');
  assert.equal(Object.hasOwn(operations[1].updateOne.update.$set, 'smtp.password'), false);
  assert.deepEqual(documents[1].smtp.password, alreadyEncrypted);
});

test('migration execution requires exact database, confirmation, and backup evidence', () => {
  assert.throws(
    () => assertExecutionGuard({ execute: true, database: 'other', confirm: 'ENCRYPT_RMS_SETTINGS_SECRETS', backupEvidence: 'snapshot-1' }, 'rms'),
    /exactly match/
  );
  assert.throws(
    () => assertExecutionGuard({ execute: true, database: 'rms', confirm: 'wrong', backupEvidence: 'snapshot-1' }, 'rms'),
    /--confirm=ENCRYPT_RMS_SETTINGS_SECRETS/
  );
  assert.throws(
    () => assertExecutionGuard({ execute: true, database: 'rms', confirm: 'ENCRYPT_RMS_SETTINGS_SECRETS' }, 'rms'),
    /--backup-evidence/
  );
  assert.doesNotThrow(() => assertExecutionGuard({
    execute: true,
    database: 'rms',
    confirm: 'ENCRYPT_RMS_SETTINGS_SECRETS',
    backupEvidence: 'mongo-snapshot-2026-09-02'
  }, 'rms'));
});

test('secret inspection treats blank values as empty and valid envelopes as encrypted', () => {
  const report = inspectSettingsSecrets([
    { smtp: { password: '  ' }, whatsapp: { apiKey: null } },
    { smtp: { password: cipher.encrypt('secret') }, whatsapp: { apiKey: 'legacy' } }
  ]);

  assert.deepEqual(report, {
    documents: 2,
    smtp: { plaintext: 0, encrypted: 1, empty: 1 },
    whatsapp: { plaintext: 1, encrypted: 0, empty: 1 },
    documentsNeedingMigration: 1
  });
});
