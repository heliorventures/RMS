const mongoose = require('mongoose');

const festivalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  religion: String,
  message: String,
  image: String,
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  recipients: {
    cities: [String],
    sectors: [String],
    religions: [String],
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }]
  },
  scheduledAt: Date,
  scheduleTimezone: String,
  status: { type: String, enum: ['draft', 'scheduled', 'sent'], default: 'draft' },
  sentCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Festival', festivalSchema);
