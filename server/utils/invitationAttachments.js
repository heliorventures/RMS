const path = require('path');
const fs = require('fs/promises');

const uploadRoot = path.resolve(__dirname, '../../public/uploads/invitations');
const uploadPattern = /^\/uploads\/invitations\/([\w-]+\.(?:png|jpe?g|gif|webp|pdf))$/i;

function attachmentPath(url) {
  const match = typeof url === 'string' && uploadPattern.exec(url);
  if (!match) throw Object.assign(new Error('Invalid invitation attachment path'), { status: 400 });
  return path.join(uploadRoot, match[1]);
}

async function eventAttachments(event) {
  const urls = [event?.invitationImage, event?.invitationPdf].filter(Boolean);
  for (const url of urls) {
    try { await fs.access(attachmentPath(url)); }
    catch (error) { throw Object.assign(new Error('Invitation attachment is unavailable. Upload the file again.'), { status: 400 }); }
  }
  return urls;
}

async function mailAttachments(urls = []) {
  // Only files in the invitation upload directory can become email attachments.
  // Read buffers here; never let Nodemailer fetch client-supplied URLs or paths.
  return Promise.all(urls.map(async url => ({ filename: path.basename(attachmentPath(url)), content: await fs.readFile(attachmentPath(url)) })));
}

module.exports = { attachmentPath, eventAttachments, mailAttachments };
