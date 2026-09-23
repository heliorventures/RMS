const Contact = require('../models/Contact');
const store = require('../services/messageStore');
const consent = require('../services/whatsappConsent');
const { verifyWhatsApp } = require('../services/whatsappService');
const delivery = require('./deliveryController');
async function contactPhone(req) {
  const contact = await Contact.findById(req.params.id).lean();
  if (!contact) throw Object.assign(new Error('Contact not found.'), { status: 404 });
  return consent.normalizePhone(contact.whatsapp || contact.mobile);
}
exports.getConsent = async (req, res) => {
  try { const phone = await contactPhone(req); res.json({ success: true, data: { phone, ...(await consent.getConsent(phone) || { status: 'unknown' }) } }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.message }); }
};
exports.setConsent = async (req, res) => {
  try {
    const phone = await contactPhone(req);
    if (req.body.phone !== phone) return res.status(409).json({ success: false, message: 'Contact number changed. Reload the contact before recording consent.' });
    const data = await consent.recordConsent({ phone, status: req.body.status, source: req.body.source, actor: req.user.id || req.user.email });
    res.json({ success: true, data });
  } catch (error) { res.status(error.status || 500).json({ success: false, message: error.message }); }
};
exports.verify = async (req, res) => {
  try { res.json({ success: true, data: await verifyWhatsApp(await store.getSettings()) }); }
  catch (error) { res.status(error.status || 502).json({ success: false, message: error.status ? error.message : 'WhatsApp configuration check failed. Check network connectivity and server configuration.' }); }
};
exports.testSend = async (req, res) => {
  try {
    const phone = consent.normalizePhone(req.body.to);
    if (!await consent.hasConsent(phone)) return res.status(400).json({ success: false, message: 'Record permission on the contact profile before sending a WhatsApp test.' });
    const contacts = await store.getAllContacts();
    const contact = contacts.find(c => { try { return c.status !== 'Inactive' && consent.normalizePhone(c.whatsapp || c.mobile) === phone; } catch { return false; } });
    if (!contact) return res.status(400).json({ success: false, message: 'Test number must belong to an active RMS contact.' });
    req.body = { name: 'WhatsApp test', channel: 'whatsapp', type: 'bulk', contactIds: [String(contact._id)], templateId: req.body.templateId };
    return delivery.createDeliveryJob(req, res);
  } catch (error) { res.status(error.status || 500).json({ success: false, message: error.message }); }
};
