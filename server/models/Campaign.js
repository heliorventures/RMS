const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['birthday', 'anniversary', 'festival', 'invitation', 'email', 'whatsapp', 'sms'], required: true },
  channel: { type: String, enum: ['email', 'whatsapp', 'sms', 'both'], default: 'email' },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  recipients: {
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    filters: mongoose.Schema.Types.Mixed
  },
  content: String,
  scheduledAt: Date,
  status: { type: String, enum: ['draft', 'scheduled', 'running', 'completed', 'failed'], default: 'draft' },
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    opened: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
