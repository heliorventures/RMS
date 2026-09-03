const jwt = require('jsonwebtoken');
const User = require('../models/User');

function jwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required.');
  }
  return process.env.JWT_SECRET;
}

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, jwtSecret());
    if (req.user.sv !== undefined) {
      const currentUser = await User.findById(req.user.id).select('isActive sessionVersion role permissions email name').lean();
      if (!currentUser || currentUser.isActive === false || Number(currentUser.sessionVersion || 0) !== Number(req.user.sv)) {
        return res.status(401).json({ success: false, message: 'Session expired. Sign in again.' });
      }
      req.user = { ...req.user, role: currentUser.role, permissions: currentUser.permissions || [] };
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], jwtSecret());
    } catch {
      /* ignore optional auth failures */
    }
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
  next();
};

module.exports = { auth, optionalAuth, requireAdmin };
