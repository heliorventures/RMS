const crypto = require('node:crypto');
const { assertPasswordPolicy } = require('../auth/passwordPolicy');

const PUBLIC_RESET_RESPONSE = Object.freeze({
  message: 'If an account exists and email delivery succeeds, a reset link will arrive shortly.'
});

function tokenHash(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function createPasswordResetService({
  User,
  ResetToken,
  settingsStore,
  emailSender,
  now = () => new Date(),
  randomBytes = crypto.randomBytes,
  appBaseUrl
}) {
  const baseUrl = String(appBaseUrl || '').replace(/\/$/, '');

  return {
    async request(email, metadata = {}) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const user = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;
      if (!user) return PUBLIC_RESET_RESPONSE;

      const requestedAt = now();
      const rawToken = randomBytes(32).toString('hex');
      await ResetToken.deleteMany({ userId: user._id, consumedAt: null });
      await ResetToken.create({
        userId: user._id,
        tokenHash: tokenHash(rawToken),
        expiresAt: new Date(requestedAt.getTime() + 30 * 60 * 1000),
        consumedAt: null,
        requestedIp: metadata.ip,
        requestedUserAgent: metadata.userAgent
      });

      const settings = await settingsStore.get();
      const link = `${baseUrl}/pages/reset-password.html?token=${encodeURIComponent(rawToken)}`;
      await emailSender.sendEmail({
        smtp: settings.smtp,
        to: user.email,
        subject: 'Reset your RMS password',
        body: `A password reset was requested for your RMS account. This link expires in 30 minutes and can be used once:\n\n${link}\n\nIf you did not request this, ignore this email.`,
        fromName: settings.smtp?.fromName || 'RMS Team'
      });
      return PUBLIC_RESET_RESPONSE;
    },

    async consume(rawToken, newPassword) {
      assertPasswordPolicy(newPassword);
      if (typeof rawToken !== 'string' || !rawToken.trim()) {
        const error = new Error('Password reset link is invalid or expired.');
        error.status = 400;
        throw error;
      }

      const consumedAt = now();
      const record = await ResetToken.findOneAndUpdate(
        { tokenHash: tokenHash(rawToken), consumedAt: null, expiresAt: { $gt: consumedAt } },
        { $set: { consumedAt } },
        { new: true }
      );
      if (!record) {
        const error = new Error('Password reset link is invalid or expired.');
        error.status = 400;
        throw error;
      }

      const user = await User.findById(record.userId);
      if (!user || user.isActive === false) {
        const error = new Error('Password reset link is invalid or expired.');
        error.status = 400;
        throw error;
      }
      user.password = newPassword;
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      await user.save();
      return { message: 'Password reset successfully. Sign in with your new password.' };
    }
  };
}

module.exports = { createPasswordResetService, PUBLIC_RESET_RESPONSE, tokenHash };
