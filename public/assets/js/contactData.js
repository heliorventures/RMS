(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMS.contactData = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  const choices = {
    gender: ['Male', 'Female', 'Other'], status: ['Active', 'Inactive', 'VIP'],
    city: ['Pune', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad'],
    sector: ['Government', 'Supplier', 'Consultant', 'Builder', 'Friends', 'Associates', 'Flat Holder'],
    religion: ['Hindu', 'Jain', 'Muslim', 'Christian', 'Sikh']
  };
  const limits = { firstName: 100, lastName: 100, occupation: 150, company: 200,
    designation: 150, city: 100, state: 100, country: 100, address: 1000, notes: 5000 };
  function date(value) {
    if (value == null || value === '') return null;
    const text = value instanceof Date ? value.toISOString() : String(value).trim();
    let parts = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(text);
    if (!parts) {
      const local = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
      if (local) parts = [text, local[3], local[2], local[1]];
    }
    if (!parts) throw new Error('Use YYYY-MM-DD or DD-MM-YYYY');
    const [, year, month, day] = parts.map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (year < 1900 || year > 9999 || parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error('Enter a valid date from year 1900 onwards');
    return parsed.toISOString();
  }
  function phone(value) {
    let result = String(value ?? '').trim().replace(/^'/, '').replace(/[\s()-]/g, '');
    if (/^00\d+$/.test(result)) result = '+' + result.slice(2);
    // Restore a country-code prefix lost by spreadsheets; never guess a country for local numbers.
    if (/^[1-9]\d{10,14}$/.test(result)) result = '+' + result;
    return result || null;
  }
  function normalize(input) {
    const data = { ...input };
    for (const key of Object.keys(limits).concat(['email', 'pincode'])) {
      if (key in data) data[key] = String(data[key] ?? '').trim() || null;
    }
    for (const [key, options] of Object.entries(choices)) {
      if (key in data) {
        const text = String(data[key] ?? '').trim();
        data[key] = options.find(option => option.toLowerCase() === text.toLowerCase()) || text || null;
      }
    }
    for (const key of ['mobile', 'whatsapp']) if (key in data) data[key] = phone(data[key]);
    for (const key of ['dob', 'anniversary']) if (key in data) {
      try { data[key] = date(data[key]); } catch (error) { throw new Error(`${key === 'dob' ? 'Date of birth' : 'Anniversary'}: ${error.message}`); }
    }
    return data;
  }
  function validate(data, { partial = false } = {}) {
    for (const key of ['firstName', 'lastName']) {
      if ((!partial || key in data) && !data[key]) return `${key === 'firstName' ? 'First' : 'Last'} name is required`;
    }
    for (const [key, max] of Object.entries(limits)) if (data[key]?.length > max) return `${key} must be at most ${max} characters`;
    for (const key of ['gender', 'status']) if (data[key] && !choices[key].includes(data[key])) return `Invalid ${key}: use ${choices[key].join(', ')}`;
    if (data.email && (data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) return 'Invalid email address';
    for (const key of ['mobile', 'whatsapp']) if (data[key] && !/^\+?[1-9]\d{7,14}$/.test(data[key])) return `Invalid ${key}: enter 8 to 15 digits, optionally starting with +`;
    if (data.pincode && !/^\d{6}$/.test(data.pincode)) return 'Pincode must contain 6 digits';
    for (const key of ['dob', 'anniversary']) if (data[key] && new Date(data[key]) > new Date()) return `${key === 'dob' ? 'Date of birth' : 'Anniversary'} cannot be in the future`;
    return null;
  }
  function csvRecords(text) {
    const records = []; let row = []; let cell = ''; let quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && (ch === ',' || ch === '\n' || ch === '\r')) {
        row.push(cell.trim()); cell = '';
        if (ch !== ',') { if (row.some(Boolean)) records.push(row); row = []; if (ch === '\r' && text[i + 1] === '\n') i++; }
      } else cell += ch;
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted field');
    row.push(cell.trim()); if (row.some(Boolean)) records.push(row);
    return records;
  }
  return { choices, limits, date, phone, normalize, validate, csvRecords };
});
