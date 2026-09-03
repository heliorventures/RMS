const mongoose = require('mongoose');

const deliveryJobSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['campaign', 'bulk', 'event', 'birthday', 'anniversary', 'festival'], default: 'bulk' },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  channel: { type: String, enum: ['email', 'whatsapp', 'sms', 'both'], default: 'email' },
  status: {
    type: String,
    enum: ['scheduled', 'queued', 'processing', 'completed', 'partial', 'failed', 'cancelled'],
    default: 'queued'
  },
  subject: String,
  body: String,
  scheduledAt: Date,
  scheduleTimezone: String,
  stats: {
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    retrying: { type: Number, default: 0 }
  },
  config: {
    maxRetries: { type: Number, default: 3 },
    batchSize: { type: Number, default: 25 },
    retryDelayMs: { type: Number, default: 5000 }
  },
  startedAt: Date,
  completedAt: Date,
  lastError: String,
  createdBy: String
}, { timestamps: true });

module.exports = mongoose.model('DeliveryJob', deliveryJobSchema);
