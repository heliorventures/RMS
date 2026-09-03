const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const deployScript = fs.readFileSync(path.join(__dirname, '../scripts/deploy-on-vps.ps1'), 'utf8');

test('VPS reconciliation sets the public reset-link base URL and requires a real settings encryption key', () => {
  assert.match(deployScript, /PUBLIC_BASE_URL="\$3"/);
  assert.match(deployScript, /set_env_value \.env APP_BASE_URL "\$PUBLIC_BASE_URL"/);
  assert.match(deployScript, /settings_encryption_keys="\$\(get_env_value \.env SETTINGS_ENCRYPTION_KEYS\)"/);
  assert.match(deployScript, /SETTINGS_ENCRYPTION_KEYS must be configured/);
  assert.match(deployScript, /\$AppDirQ \$TagQ \$PublicBaseUrlQ/);
});
