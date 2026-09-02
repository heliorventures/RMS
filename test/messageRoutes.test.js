const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

const TEST_JWT_SECRET = 'test-only-message-route-secret-at-least-32-characters';
process.env.JWT_SECRET = TEST_JWT_SECRET;

const { router: modulesRouter } = require('../server/routes/modules');

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', modulesRouter);
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API route not found' });
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`
  };
}

function authHeader() {
  const token = jwt.sign(
    { id: '507f1f77bcf86cd799439011', role: 'user', email: 'user@example.com' },
    TEST_JWT_SECRET,
    { expiresIn: '5m' }
  );
  return { Authorization: `Bearer ${token}` };
}

test('authenticated users cannot create messages through generic CRUD', async (t) => {
  const { server, baseUrl } = await startTestServer();
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`${baseUrl}/api/messages`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.deepEqual(body, { success: false, message: 'API route not found' });
});
