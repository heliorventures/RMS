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
  const validExtension = allowedExtensions.has(ext);
  const validMime = allowedMimeTypes.has(file.mimetype);
  cb(null, validExtension && validMime);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

module.exports = upload;
