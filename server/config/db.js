const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('username:password')) {
    console.log('MongoDB URI not configured — using local JSON fallback mode');
    return false;
  }
  try {
    await mongoose.connect(uri);
    console.log('MongoDB Atlas connected');
    return true;
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.log('Falling back to local JSON data mode');
    return false;
  }
};

module.exports = connectDB;
