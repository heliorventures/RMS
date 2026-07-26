require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./server/config/db');
const { router: modulesRouter } = require('./server/routes/modules');
const { startDeliveryWorker, stopDeliveryWorker } = require('./server/services/deliveryQueue');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  throw new Error('JWT_SECRET is required and must be changed before starting RMS.');
}

const corsOrigin = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigin.length > 0) {
  app.use(cors({ origin: corsOrigin, credentials: true }));
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdn.datatables.net', 'https://code.jquery.com', 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://cdn.datatables.net'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again later.' }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'RMS API is running', mode: 'mongodb' });
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/contacts', require('./server/routes/contacts'));
app.use('/api/groups', require('./server/routes/groups'));
app.use('/api/dashboard', require('./server/routes/dashboard'));
app.use('/api/delivery', require('./server/routes/delivery'));
app.use('/api', modulesRouter);
app.use('/api', require('./server/routes/misc'));

async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`RMS Server running at http://localhost:${PORT}`);
    console.log('Mode: MongoDB');
    console.log(`Delivery worker active (dry-run: ${process.env.DELIVERY_DRY_RUN === 'true'})`);
    startDeliveryWorker();
  });

  process.on('SIGINT', () => {
    stopDeliveryWorker();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopDeliveryWorker();
    process.exit(0);
  });
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

start().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
