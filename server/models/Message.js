const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  status: String,
  error: String
}, { _id: false });

const messageSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryJob' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  contactName: String,
  recipient: String,
  type: { type: String, enum: ['email', 'whatsapp', 'sms'], required: true },
  subject: String,
  body: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'scheduled'],
    default: 'pending'
  },
  scheduledAt: Date,
  sentAt: Date,
  deliveredAt: Date,
  error: String,
  failureReason: String,
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  nextRetryAt: Date,
  attempts: [attemptSchema]
}, { timestamps: true });

messageSchema.index({ jobId: 1, status: 1 });
messageSchema.index({ status: 1, nextRetryAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
