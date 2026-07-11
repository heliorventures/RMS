require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./server/config/db');

const authController = require('./server/controllers/authController');
const contactController = require('./server/controllers/contactController');
const groupController = require('./server/controllers/groupController');
const dashboardController = require('./server/controllers/dashboardController');
const reportsController = require('./server/controllers/reportsController');
const settingsController = require('./server/controllers/settingsController');
const { router: modulesRouter, setUseMongo: setModulesMongo } = require('./server/routes/modules');
const deliveryController = require('./server/controllers/deliveryController');
const messageStore = require('./server/services/messageStore');
const { startDeliveryWorker, stopDeliveryWorker } = require('./server/services/deliveryQueue');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'RMS API is running', mode: global.useMongo ? 'mongodb' : 'json' });
});

app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/contacts', require('./server/routes/contacts'));
app.use('/api/groups', require('./server/routes/groups'));
app.use('/api/dashboard', require('./server/routes/dashboard'));
app.use('/api/delivery', require('./server/routes/delivery'));
app.use('/api', modulesRouter);
app.use('/api', require('./server/routes/misc'));

async function start() {
  global.useMongo = await connectDB();

  authController.setUseMongo(global.useMongo);
  contactController.setUseMongo(global.useMongo);
  groupController.setUseMongo(global.useMongo);
  dashboardController.setUseMongo(global.useMongo);
  reportsController.setUseMongo(global.useMongo);
  settingsController.setUseMongo(global.useMongo);
  deliveryController.setUseMongo(global.useMongo);
  messageStore.setUseMongo(global.useMongo);
  setModulesMongo(global.useMongo);

  if (!global.useMongo) {
    const fs = require('fs');
    const dataPath = path.join(__dirname, 'data/sample-data.json');
    if (!fs.existsSync(dataPath)) {
      console.log('Sample data not found. Running seed...');
      require('./server/seed/seed');
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 RMS Server running at http://localhost:${PORT}`);
    console.log(`📊 Mode: ${global.useMongo ? 'MongoDB Atlas' : 'Local JSON'}`);
    console.log(`📬 Delivery: worker active (dry-run: ${process.env.DELIVERY_DRY_RUN === 'true'})`);
    console.log(`🔐 Login: admin@rms.com / admin123\n`);
    startDeliveryWorker();
  });

  process.on('SIGINT', () => { stopDeliveryWorker(); process.exit(0); });
  process.on('SIGTERM', () => { stopDeliveryWorker(); process.exit(0); });
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

start();
