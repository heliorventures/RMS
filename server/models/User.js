const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
  avatar: String,
  phone: String,
  permissions: [String],
  notificationPrefs: {
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
    birthday: { type: Boolean, default: true },
    anniversary: { type: Boolean, default: true },
    festival: { type: Boolean, default: true },
    campaign: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0 },
  lastLogin: Date
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
