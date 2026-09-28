const { v4: uuidv4 } = require('uuid');
const contactData = require('../../public/assets/js/contactData');

const CSV_HEADERS = [
  'First Name', 'Last Name', 'Gender', 'Date of Birth', 'Anniversary',
  'Mobile', 'WhatsApp', 'Email', 'Religion', 'Sector', 'Occupation',
  'Company', 'Designation', 'City', 'State', 'Pincode', 'Address',
  'Tags', 'Status', 'Notes'
];

const FIELD_MAP = {
  'first name': 'firstName',
  'firstname': 'firstName',
  'last name': 'lastName',
  'lastname': 'lastName',
  'gender': 'gender',
  'date of birth': 'dob',
  'dob': 'dob',
  'birthday': 'dob',
  'anniversary': 'anniversary',
  'mobile': 'mobile',
  'phone': 'mobile',
  'whatsapp': 'whatsapp',
  'email': 'email',
  'religion': 'religion',
  'sector': 'sector',
  'occupation': 'occupation',
  'company': 'company',
  'designation': 'designation',
  'city': 'city',
  'state': 'state',
  'pincode': 'pincode',
  'address': 'address',
  'tags': 'tags',
  'status': 'status',
  'notes': 'notes'
};

function parseCSV(text) {
  const lines = contactData.csvRecords(text);
  if (!lines.length) return [];

  const headers = lines[0].map(h => h.toLowerCase().trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.every(v => !v)) continue;
    const row = {};
    headers.forEach((header, idx) => {
      const key = FIELD_MAP[header] || header.replace(/\s+/g, '');
      row[key] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function normalizeRow(row) {
  const tags = row.tags
    ? (Array.isArray(row.tags) ? row.tags : String(row.tags).split(',')).map(t => String(t).trim()).filter(Boolean)
    : [];

  return contactData.normalize({
    firstName: String(row.firstName || row.firstname || '').trim(),
    lastName: String(row.lastName || row.lastname || '').trim(),
    gender: row.gender || 'Male',
    dob: row.dob,
    anniversary: row.anniversary,
    mobile: row.mobile || null,
    whatsapp: row.whatsapp || null,
    email: row.email || null,
    religion: row.religion || null,
    sector: row.sector || null,
    occupation: row.occupation || null,
    company: row.company || null,
    designation: row.designation || null,
    city: row.city || null,
    state: row.state || null,
    country: 'India',
    pincode: row.pincode || null,
    address: row.address || null,
    tags,
    status: row.status || 'Active',
    notes: row.notes || null,
    groups: [],
    photo: null,
    timeline: [{
      action: 'Imported',
      description: 'Contact imported via bulk upload',
      date: new Date().toISOString(),
      user: 'Admin User'
    }]
  });
}

function validateContact(contact) {
  return contactData.validate(contact);
}

function prepareContacts(rows) {
  const valid = [];
  const validRows = [];
  const errors = [];
  rows.forEach((row, index) => {
    try {
      const normalized = normalizeRow(row);
      const error = validateContact(normalized);
      if (error) errors.push({ row: index + 2, message: error });
      else {
        valid.push(normalized);
        validRows.push({ row: index + 2, contact: normalized });
      }
    } catch (error) { errors.push({ row: index + 2, message: error.message }); }
  });
  return { valid, validRows, errors };
}

module.exports = {
  CSV_HEADERS,
  parseCSV,
  normalizeRow,
  validateContact,
  prepareContacts,
  ensureIds(items) {
    return items.map(item => ({
      _id: item._id || uuidv4(),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...item
    }));
  }
};
