const mongoose = require('mongoose');

const commHistorySchema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  contactName: String,
  type: { type: String, enum: ['email', 'whatsapp', 'sms', 'call', 'meeting'], required: true },
  subject: String,
  message: String,
  status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' },
  sentBy: String,
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('CommunicationHistory', commHistorySchema);
