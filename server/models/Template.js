const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['birthday', 'anniversary', 'festival', 'invitation', 'email', 'whatsapp'], required: true },
  subject: String,
  body: { type: String, required: true },
  variables: [String],
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);
