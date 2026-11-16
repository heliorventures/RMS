const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['birthday', 'anniversary', 'festival', 'invitation', 'email', 'whatsapp'], required: true },
  subject: String,
  whatsapp: { name: String, language: String, bodyParameters: [String] },
  body: { type: String, required: true },
  variables: [String],
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, autoIndex: false });

// Startup reconciles legacy duplicates before explicitly creating this index.
templateSchema.index({ type: 1 }, { name: 'one_default_template_per_type', unique: true, partialFilterExpression: { isDefault: true } });

module.exports = mongoose.model('Template', templateSchema);
