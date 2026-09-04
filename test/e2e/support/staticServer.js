const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = Number(process.env.RMS_E2E_PORT || 4173);
const publicDir = path.resolve(__dirname, '../../../public');
const manifestPath = path.join(publicDir, 'dist', 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

app.disable('x-powered-by');
app.get('/assets/*', (req, res, next) => {
  const hashedAsset = manifest[req.path];
  if (!hashedAsset) return next();
  return res.redirect(302, hashedAsset);
});
app.use(express.static(publicDir, { etag: false, lastModified: false }));
app.use((req, res) => res.status(404).type('text').send('Not found'));

const server = app.listen(port, '127.0.0.1', () => {
  process.stdout.write(`RMS E2E static server listening on ${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
