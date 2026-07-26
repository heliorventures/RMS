const Settings = require('../models/Settings');
const User = require('../models/User');

function stripPassword(user) {
  if (!user) return null;
  const { password, ...safe } = user.toObject ? user.toObject() : user;
  return safe;
}

function sanitizeSettingsForUser(settings, user) {
  if (user?.role === 'admin') return settings;
  return {
    company: settings?.company,
    labels: settings?.labels,
    theme: settings?.theme ? {
      primaryColor: settings.theme.primaryColor,
      darkMode: settings.theme.darkMode
    } : undefined
  };
}

const settingsController = {
  async get(req, res) {
    try {
      let settings = await Settings.findOne();
      if (!settings) settings = await Settings.create({});
      const data = sanitizeSettingsForUser(settings.toObject ? settings.toObject() : settings, req.user);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const settings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
      res.json({ success: true, data: settings });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getUsers(req, res) {
    try {
      const users = await User.find().select('-password');
      res.json({ success: true, data: users });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createUser(req, res) {
    try {
      const { name, email, password, role, phone, isActive } = req.body;
      if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const userRole = role || 'user';

      const exists = await User.findOne({ email: normalizedEmail });
      if (exists) return res.status(400).json({ success: false, message: 'Email already exists.' });
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: userRole,
        phone: phone || '',
        isActive: isActive !== false
      });
      res.status(201).json({ success: true, data: stripPassword(user), message: 'User created.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email, password, role, phone, isActive } = req.body;

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      if (email && email.toLowerCase() !== user.email) {
        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(400).json({ success: false, message: 'Email already exists.' });
        user.email = email.trim().toLowerCase();
      }
      if (name) user.name = name.trim();
      if (role) user.role = role;
      if (phone !== undefined) user.phone = phone;
      if (isActive !== undefined) user.isActive = isActive;
      if (password) user.password = password;
      await user.save();
      res.json({ success: true, data: stripPassword(user), message: 'User updated.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      if (req.user?.id === id) {
        return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
      }

      const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select('-password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      res.json({ success: true, data: stripPassword(user), message: 'User deactivated.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateRole(req, res) {
    try {
      const { roleName, name, permissions } = req.body;
      if (!roleName) {
        return res.status(400).json({ success: false, message: 'Role name is required.' });
      }
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'Permissions must be an array.' });
      }

      let settings = await Settings.findOne();
      if (!settings) settings = await Settings.create({});
      const roles = [...(settings.roles || [])];
      const idx = roles.findIndex(r => r.name === roleName);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Role not found.' });
      roles[idx] = { name: name || roleName, permissions };
      settings.roles = roles;
      await settings.save();
      res.json({ success: true, data: roles[idx], message: 'Role updated.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = settingsController;
