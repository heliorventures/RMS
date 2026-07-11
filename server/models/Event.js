const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  venue: String,
  date: Date,
  time: String,
  mapsLink: String,
  invitationImage: String,
  invitationPdf: String,
  recipients: {
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    cities: [String],
    sectors: [String]
  },
  scheduledAt: Date,
  status: { type: String, enum: ['draft', 'scheduled', 'sent', 'completed'], default: 'draft' },
  deliveryStats: {
    email: { sent: Number, delivered: Number, failed: Number },
    whatsapp: { sent: Number, delivered: Number, failed: Number }
  }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
