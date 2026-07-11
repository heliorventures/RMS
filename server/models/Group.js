const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  color: { type: String, default: '#2563eb' },
  icon: { type: String, default: 'bi-people' },
  type: { type: String, enum: ['static', 'dynamic'], default: 'static' },
  rules: [{
    field: String,
    operator: { type: String, enum: ['equals', 'contains', 'in', 'not_in'] },
    value: mongoose.Schema.Types.Mixed
  }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  excludedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  memberCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
