const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  company: {
    name: { type: String, default: 'RMS Solutions Pvt Ltd' },
    logo: String,
    address: String,
    phone: String,
    email: String,
    website: String
  },
  smtp: {
    host: String,
    port: Number,
    user: String,
    password: String,
    fromEmail: String,
    fromName: String,
    secure: { type: Boolean, default: true }
  },
  whatsapp: {
    apiUrl: String,
    apiKey: String,
    phoneNumberId: String,
    businessAccountId: String
  },
  theme: {
    primaryColor: { type: String, default: '#2563eb' },
    darkMode: { type: Boolean, default: false }
  },
  roles: [{
    name: String,
    permissions: [String]
  }],
  autoBirthdayWish: { type: Boolean, default: true },
  autoAnniversaryWish: { type: Boolean, default: true },
  labels: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
