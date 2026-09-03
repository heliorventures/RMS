const MIN_PASSWORD_LENGTH = 12;

function assertPasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    const error = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    error.status = 400;
    error.code = 'PASSWORD_POLICY';
    throw error;
  }
  return password;
}

module.exports = { MIN_PASSWORD_LENGTH, assertPasswordPolicy };
