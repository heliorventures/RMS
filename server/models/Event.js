const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  venue: String,
  date: { type: Date, validate: { validator: value => !value || (value.getUTCFullYear() >= 1900 && value.getUTCFullYear() <= 9999), message: 'Enter a date with a four-digit year from 1900 onwards.' } },
  time: String,
  mapsLink: { type: String, trim: true, validate: { validator: value => {
    if (!value) return true;
    try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
  }, message: 'Google Maps Link must be a valid http or https URL.' } },
  channel: { type: String, enum: ['email', 'whatsapp', 'both'], default: 'email' },
  audience: { type: String, enum: ['selected', 'all'], default: 'selected' },
  invitationImage: { type: String, validate: { validator: value => !value || /^\/uploads\/invitations\/[\w-]+\.(png|jpe?g|gif|webp)$/i.test(value), message: 'Select a valid uploaded invitation image.' } },
  invitationPdf: { type: String, validate: { validator: value => !value || /^\/uploads\/invitations\/[\w-]+\.pdf$/i.test(value), message: 'Select a valid uploaded invitation PDF.' } },
  recipients: {
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    cities: [String],
    sectors: [String]
  },
  scheduledAt: Date,
  scheduleTimezone: String,
  deliveryJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryJob' },
  status: { type: String, enum: ['draft', 'scheduled', 'queued', 'processing', 'sent', 'completed', 'partial', 'failed'], default: 'draft' },
  deliveryStats: {
    email: { sent: Number, delivered: Number, failed: Number },
    whatsapp: { sent: Number, delivered: Number, failed: Number }
  }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
