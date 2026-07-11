const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  message: String,
  type: { type: String, enum: ['info', 'success', 'warning', 'birthday', 'anniversary', 'campaign'], default: 'info' },
  link: String,
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
