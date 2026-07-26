require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    const key = rawKey.trim();
    const value = inlineValue !== undefined ? inlineValue : argv[index + 1];
    if (inlineValue === undefined) index += 1;
    args[key] = value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  const email = (args.email || '').trim().toLowerCase();
  const password = args.password || '';
  const name = (args.name || 'RMS Admin').trim();

  if (!uri || uri.includes('username:password')) {
    throw new Error('MONGODB_URI is required.');
  }
  if (!email) {
    throw new Error('Admin email is required. Use --email admin@example.com.');
  }
  if (password.length < 8) {
    throw new Error('Admin password must be at least 8 characters. Use --password <value>.');
  }

  await mongoose.connect(uri, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000)
  });

  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = name;
    existing.role = 'admin';
    existing.isActive = true;
    existing.password = password;
    await existing.save();
    console.log(`Updated admin user: ${email}`);
  } else {
    await User.create({
      name,
      email,
      password,
      role: 'admin',
      isActive: true
    });
    console.log(`Created admin user: ${email}`);
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err.message);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore disconnect errors */
    }
    process.exit(1);
  });
}

module.exports = { main, parseArgs };
