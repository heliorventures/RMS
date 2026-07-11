const { v4: uuidv4 } = require('uuid');

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

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === '"') {
      if (inQuotes && line.charAt(i + 1) === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
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

function parseDate(value) {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeRow(row) {
  const tags = row.tags
    ? String(row.tags).split(',').map(t => t.trim()).filter(Boolean)
    : [];

  return {
    firstName: String(row.firstName || row.firstname || '').trim(),
    lastName: String(row.lastName || row.lastname || '').trim(),
    gender: row.gender || 'Male',
    dob: parseDate(row.dob),
    anniversary: parseDate(row.anniversary),
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
  };
}

function validateContact(contact) {
  if (!contact.firstName) return 'First name is required';
  if (!contact.lastName) return 'Last name is required';
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    return 'Invalid email address';
  }
  return null;
}

function prepareContacts(rows) {
  const valid = [];
  const errors = [];
  rows.forEach((row, index) => {
    const normalized = normalizeRow(row);
    const error = validateContact(normalized);
    if (error) {
      errors.push({ row: index + 2, message: error });
    } else {
      valid.push(normalized);
    }
  });
  return { valid, errors };
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
