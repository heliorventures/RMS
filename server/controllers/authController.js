const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const jsonStore = require('../utils/jsonStore');

let useMongo = false;
function setUseMongo(val) { useMongo = val; }

const authController = {
  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      let user;
      if (useMongo) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await user.comparePassword(password))) {
          return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        user.lastLogin = new Date();
        await user.save();
        user = user.toObject();
      } else {
        user = jsonStore.getAll('users').find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        jsonStore.update('users', user._id, { lastLogin: new Date().toISOString() });
      }

      const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET || 'rms-dev-secret-key',
        { expiresIn }
      );

      const { password: _, ...safeUser } = user;
      res.json({ success: true, token, user: safeUser });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async register(req, res) {
    try {
      const { name, email, password, role } = req.body;
      if (useMongo) {
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ success: false, message: 'Email already exists.' });
        const user = await User.create({ name, email, password, role: role || 'user' });
        const { password: _, ...safe } = user.toObject();
        return res.status(201).json({ success: true, user: safe });
      }
      const exists = jsonStore.getAll('users').find(u => u.email === email);
      if (exists) return res.status(400).json({ success: false, message: 'Email already exists.' });
      const hashed = await bcrypt.hash(password, 12);
      const user = jsonStore.create('users', { name, email, password: hashed, role: role || 'user', isActive: true });
      const { password: _, ...safe } = user;
      res.status(201).json({ success: true, user: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async forgotPassword(req, res) {
    const { email } = req.body;
    res.json({
      success: true,
      message: `If an account exists for ${email}, a password reset link has been sent.`
    });
  },

  async getProfile(req, res) {
    try {
      if (useMongo) {
        const user = await User.findById(req.user.id).select('-password');
        return res.json({ success: true, data: user });
      }
      const user = jsonStore.getById('users', req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      const { password: _, ...safe } = user;
      res.json({ success: true, data: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, phone, notificationPrefs } = req.body;
      if (useMongo) {
        const user = await User.findByIdAndUpdate(req.user.id, { name, phone, notificationPrefs }, { new: true }).select('-password');
        return res.json({ success: true, data: user });
      }
      const user = jsonStore.update('users', req.user.id, { name, phone, notificationPrefs });
      const { password: _, ...safe } = user;
      res.json({ success: true, data: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (useMongo) {
        const user = await User.findById(req.user.id);
        if (!(await user.comparePassword(currentPassword))) {
          return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }
        user.password = newPassword;
        await user.save();
        return res.json({ success: true, message: 'Password updated successfully.' });
      }
      const user = jsonStore.getById('users', req.user.id);
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      const hashed = await bcrypt.hash(newPassword, 12);
      jsonStore.update('users', req.user.id, { password: hashed });
      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

authController.setUseMongo = setUseMongo;
module.exports = authController;
