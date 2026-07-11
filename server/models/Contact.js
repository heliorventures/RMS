const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  photo: String,
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
  dob: Date,
  anniversary: Date,
  mobile: String,
  whatsapp: String,
  email: String,
  religion: String,
  sector: String,
  occupation: String,
  company: String,
  designation: String,
  city: String,
  state: String,
  country: { type: String, default: 'India' },
  address: String,
  pincode: String,
  tags: [String],
  notes: String,
  status: { type: String, enum: ['Active', 'Inactive', 'VIP'], default: 'Active' },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  timeline: [{
    action: String,
    description: String,
    date: { type: Date, default: Date.now },
    user: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
