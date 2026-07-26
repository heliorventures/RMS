const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authController = {
  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      const userDoc = await User.findOne({ email: email.toLowerCase() });
      if (!userDoc || !(await userDoc.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      userDoc.lastLogin = new Date();
      await userDoc.save();
      const user = userDoc.toObject();

      const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn }
      );

      const { password: _, ...safeUser } = user;
      res.json({ success: true, token, user: safeUser });
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
      const user = await User.findById(req.user.id).select('-password');
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, phone, notificationPrefs } = req.body;
      const user = await User.findByIdAndUpdate(req.user.id, { name, phone, notificationPrefs }, { new: true }).select('-password');
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user.id);
      if (!(await user.comparePassword(currentPassword))) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }
      user.password = newPassword;
      await user.save();
      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = authController;
