const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads');
const allowedUploadTypes = new Set(['contacts', 'festivals', 'invitations', 'templates', 'company', 'general']);
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx']);
const invitationExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']);

['contacts', 'festivals', 'invitations', 'templates', 'company', 'general'].forEach(sub => {
  const dir = path.join(uploadDir, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function resolveUploadType(req) {
  const type = req.params.type || req.body.uploadType || 'general';
  return allowedUploadTypes.has(type) ? type : 'general';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = resolveUploadType(req);
    const dir = path.join(uploadDir, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (req.params.type === 'invitations') {
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' };
    if (types[ext] !== file.mimetype) return cb(Object.assign(new Error('Invitation attachments must be PNG, JPEG, GIF, WebP or PDF files.'), { status: 400 }));
  }
  const validExtension = allowedExtensions.has(ext);
  const validMime = allowedMimeTypes.has(file.mimetype);
  cb(null, validExtension && validMime);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

function hasSignature(buffer, expected) {
  return buffer.length >= expected.length && expected.every((byte, index) => buffer[index] === byte);
}

function isValidInvitationFile(file) {
  const ext = path.extname(file?.originalname || '').toLowerCase();
  const buffer = file?.buffer;
  if (!invitationExtensions.has(ext) || !Buffer.isBuffer(buffer)) return false;

  if (ext === '.pdf') return hasSignature(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (ext === '.png') return hasSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (ext === '.gif') return hasSignature(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || hasSignature(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  if (ext === '.webp') return hasSignature(buffer, [0x52, 0x49, 0x46, 0x46]) && hasSignature(buffer.subarray(8), [0x57, 0x45, 0x42, 0x50]);
  return hasSignature(buffer, [0xff, 0xd8, 0xff]);
}

const invitationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!invitationExtensions.has(ext)) return cb(Object.assign(new Error('Invitation attachments must be PNG, JPEG, GIF, WebP or PDF files.'), { status: 400 }));
    cb(null, true);
  }
});

async function saveInvitationFile(file) {
  if (!isValidInvitationFile(file)) {
    throw Object.assign(new Error('Invitation attachment content does not match its file type.'), { status: 400 });
  }
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${uuidv4()}${ext}`;
  const target = path.join(uploadDir, 'invitations', filename);
  await fs.promises.writeFile(target, file.buffer, { flag: 'wx' });
  return filename;
}

module.exports = Object.assign(upload, { invitationUpload, saveInvitationFile, isValidInvitationFile });
