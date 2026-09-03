const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecretCipher } = require('../server/security/secretCipher');

const keyA = Buffer.alloc(32, 1);
const keyB = Buffer.alloc(32, 2);

test('provider secret encryption round-trips without retaining plaintext', () => {
  const cipher = createSecretCipher([{ id: 'key-a', key: keyA }]);
  const envelope = cipher.encrypt('smtp-app-password');

  assert.equal(envelope.v, 1);
  assert.equal(envelope.keyId, 'key-a');
  assert.equal(JSON.stringify(envelope).includes('smtp-app-password'), false);
  assert.equal(cipher.decrypt(envelope), 'smtp-app-password');
});

test('provider secret decryption rejects tampering and unknown keys', () => {
  const cipher = createSecretCipher([{ id: 'key-a', key: keyA }]);
  const envelope = cipher.encrypt('secret');
  assert.throws(() => cipher.decrypt({ ...envelope, ciphertext: `${envelope.ciphertext}AA` }), /decrypt/i);
  assert.throws(() => cipher.decrypt({ ...envelope, keyId: 'missing' }), /Unknown settings encryption key/);
});

test('newest key writes while older keys remain readable for rotation', () => {
  const oldCipher = createSecretCipher([{ id: 'key-a', key: keyA }]);
  const oldEnvelope = oldCipher.encrypt('secret');
  const rotatedCipher = createSecretCipher([{ id: 'key-b', key: keyB }, { id: 'key-a', key: keyA }]);

  assert.equal(rotatedCipher.encrypt('new-secret').keyId, 'key-b');
  assert.equal(rotatedCipher.decrypt(oldEnvelope), 'secret');
});
