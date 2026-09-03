const crypto = require('node:crypto');

function createSecretCipher(keys, randomBytes = crypto.randomBytes) {
  if (!Array.isArray(keys) || !keys.length) throw new Error('At least one settings encryption key is required.');
  const keyMap = new Map();
  for (const entry of keys) {
    if (!entry?.id || !Buffer.isBuffer(entry.key) || entry.key.length !== 32) {
      throw new Error('Each settings encryption key must have an id and exactly 32 bytes.');
    }
    keyMap.set(entry.id, entry.key);
  }
  const active = keys[0];

  return {
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', active.key, iv);
      const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
      return { v: 1, keyId: active.id, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
    },
    decrypt(value) {
      if (typeof value === 'string') return value;
      if (!value || value.v !== 1) throw new Error('Unsupported encrypted settings value.');
      const key = keyMap.get(value.keyId);
      if (!key) throw new Error(`Unknown settings encryption key: ${value.keyId}`);
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8');
      } catch (error) {
        throw new Error('Could not decrypt settings secret.', { cause: error });
      }
    }
  };
}

let cachedSource;
let cachedCipher;
function getSecretCipher(source = process.env.SETTINGS_ENCRYPTION_KEYS) {
  if (source === cachedSource && cachedCipher) return cachedCipher;
  const entries = String(source || '').split(',').map(item => item.trim()).filter(Boolean).map(item => {
    const separator = item.indexOf(':');
    if (separator < 1) throw new Error('SETTINGS_ENCRYPTION_KEYS must use keyId:base64Key entries.');
    return { id: item.slice(0, separator), key: Buffer.from(item.slice(separator + 1), 'base64') };
  });
  cachedCipher = createSecretCipher(entries);
  cachedSource = source;
  return cachedCipher;
}

module.exports = { createSecretCipher, getSecretCipher };
