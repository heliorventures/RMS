const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  status: { type: String, enum: ['granted', 'withdrawn'], required: true },
  changedAt: { type: Date, required: true },
  source: { type: String, required: true },
  actor: String,
  history: [{ status: String, at: Date, source: String, actor: String }]
}, { timestamps: true });
module.exports = mongoose.model('WhatsAppConsent', schema);
