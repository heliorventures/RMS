const mongoose = require('mongoose');

const exportJobSchema = new mongoose.Schema({
  type: { type: String, enum: ['contacts'], required: true },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['ready', 'expired'], default: 'ready' },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

exportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ExportJob', exportJobSchema);
