const express = require('express');
const { verifySignature, handleWebhook } = require('../services/whatsappWebhook');
const { getSettings } = require('../services/messageStore');
const { resolveWebhookSecret } = require('../security/whatsappSecrets');
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const token = resolveWebhookSecret((await getSettings()).whatsapp, 'webhookVerifyToken');
    if (!token) return res.sendStatus(503);
    if (req.query['hub.mode'] !== 'subscribe' || req.query['hub.verify_token'] !== token || typeof req.query['hub.challenge'] !== 'string') return res.sendStatus(403);
    res.type('text/plain').send(req.query['hub.challenge']);
  } catch { res.sendStatus(503); }
});
router.post('/', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  try {
    const wa = (await getSettings()).whatsapp || {};
    const secret = resolveWebhookSecret(wa, 'appSecret');
    if (!secret) return res.sendStatus(503);
    if (!verifySignature(req.body, req.get('x-hub-signature-256'), secret)) return res.sendStatus(401);
    let payload;
    try { payload = JSON.parse(req.body.toString('utf8')); } catch { return res.sendStatus(400); }
    await handleWebhook(payload, wa);
    res.sendStatus(200);
  } catch { res.sendStatus(503); } // Do not acknowledge a failed write: Meta must retry.
});
module.exports = router;
