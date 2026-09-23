const mongoose = require('mongoose');

const commHistorySchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', unique: true, sparse: true },
  providerAttemptNumber: { type: Number, default: 0 },
  outcomeUncertain: Boolean,
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
