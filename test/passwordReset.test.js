const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createPasswordResetService, PUBLIC_RESET_RESPONSE } = require('../server/services/passwordResetService');

function createFakes() {
  const now = new Date('2026-09-02T10:00:00.000Z');
  const user = {
    _id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    password: 'old-hash',
    sessionVersion: 2,
    async save() { this.saved = true; }
  };
  const records = [];
  const sent = [];
  const User = {
    async findOne(query) { return query.email === user.email ? user : null; },
    async findById(id) { return id === user._id ? user : null; }
  };
  const ResetToken = {
    async deleteMany(query) {
      for (const record of records) {
        if (record.userId === query.userId && record.consumedAt === null) record.consumedAt = now;
      }
    },
    async create(record) { records.push({ ...record }); return record; },
    async findOneAndUpdate(query, update) {
      const record = records.find(item => item.tokenHash === query.tokenHash && item.consumedAt === null && item.expiresAt > query.expiresAt.$gt);
      if (!record) return null;
      record.consumedAt = update.$set.consumedAt;
      return { ...record };
    }
  };
  const service = createPasswordResetService({
    User,
    ResetToken,
    settingsStore: { async get() { return { smtp: { host: 'smtp.test', user: 'mailer@test', password: 'secret' } }; } },
    emailSender: { async sendEmail(message) { sent.push(message); return { success: true }; } },
    now: () => new Date(now),
    randomBytes: () => Buffer.alloc(32, 7),
    appBaseUrl: 'https://rms.example.test'
  });
  return { service, user, records, sent };
}

test('password reset request is enumeration-safe and stores only a 30-minute token hash', async () => {
  const { service, records, sent } = createFakes();
  const missingResult = await service.request('missing@example.com');
  const existingResult = await service.request('ADMIN@example.com');

  assert.deepEqual(missingResult, PUBLIC_RESET_RESPONSE);
  assert.deepEqual(existingResult, PUBLIC_RESET_RESPONSE);
  assert.equal(records.length, 1);
  assert.equal(records[0].tokenHash.length, 64);
  assert.equal(records[0].expiresAt.toISOString(), '2026-09-02T10:30:00.000Z');
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /reset-password\.html\?token=/);
  assert.equal(sent[0].body.includes(records[0].tokenHash), false);
});

test('password reset token is one-time and increments session version', async () => {
  const { service, user, sent } = createFakes();
  await service.request(user.email);
  const rawToken = new URL(sent[0].body.match(/https:\/\/\S+/)[0]).searchParams.get('token');

  await service.consume(rawToken, 'a-secure-password-123');
  assert.equal(user.password, 'a-secure-password-123');
  assert.equal(user.sessionVersion, 3);
  assert.equal(user.saved, true);
  await assert.rejects(() => service.consume(rawToken, 'another-secure-password'), /invalid or expired/i);
});

test('password reset enforces the shared 12-character password policy', async () => {
  const { service } = createFakes();
  await assert.rejects(() => service.consume(crypto.randomBytes(32).toString('hex'), 'too-short'), /at least 12 characters/i);
});
