function applyTemplate(text, contact) {
  if (!text) return '';
  const data = {
    Name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
    FirstName: contact.firstName || '',
    LastName: contact.lastName || '',
    City: contact.city || '',
    Sector: contact.sector || '',
    Company: contact.company || '',
    Designation: contact.designation || '',
    Occupation: contact.occupation || '',
    Mobile: contact.mobile || '',
    Email: contact.email || ''
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? data[key.charAt(0).toUpperCase() + key.slice(1)] ?? '');
}

function matchRule(contact, rule) {
  const val = contact[rule.field];
  switch (rule.operator) {
    case 'equals':
      if (val == null || rule.value == null) return false;
      if (['city', 'sector', 'religion', 'status'].includes(rule.field)) {
        return String(val).toLowerCase() === String(rule.value).toLowerCase();
      }
      return val === rule.value;
    case 'contains':
      return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
    default:
      return true;
  }
}

function resolveGroupMembers(group, allContacts) {
  const excluded = new Set((group.excludedMembers || []).map(String));
  let members;
  if (group.type === 'dynamic') {
    members = allContacts.filter(c => (group.rules || []).every(rule => matchRule(c, rule)));
  } else if (group.members?.length) {
    const ids = group.members.map(String);
    members = allContacts.filter(c => ids.includes(String(c._id)));
  } else {
    members = allContacts.filter(c => (c.groups || []).map(String).includes(String(group._id)));
  }
  return members.filter(c => !excluded.has(String(c._id)));
}

function resolveRecipients({ contactIds = [], groupIds = [], allContacts = [], allGroups = [] }) {
  const map = new Map();
  (contactIds || []).forEach(id => {
    const c = allContacts.find(x => String(x._id) === String(id));
    if (c) map.set(String(c._id), c);
  });
  (groupIds || []).forEach(gid => {
    const group = allGroups.find(g => String(g._id) === String(gid));
    if (!group) return;
    resolveGroupMembers(group, allContacts).forEach(c => map.set(String(c._id), c));
  });
  return [...map.values()];
}

function channelsForJob(channel) {
  if (channel === 'both') return ['email', 'whatsapp'];
  return [channel];
}

function filterContacts(contacts, filters = {}) {
  if (!filters || !contacts?.length) return contacts || [];
  let list = contacts.filter(c => c.status !== 'Inactive');
  if (filters.cities?.length) {
    const cities = new Set(filters.cities.map(c => String(c).toLowerCase()));
    list = list.filter(c => cities.has(String(c.city || '').toLowerCase()));
  }
  if (filters.sectors?.length) {
    const sectors = new Set(filters.sectors.map(s => String(s).toLowerCase()));
    list = list.filter(c => sectors.has(String(c.sector || '').toLowerCase()));
  }
  if (filters.religions?.length) {
    const religions = new Set(filters.religions.map(r => String(r).toLowerCase()));
    list = list.filter(c => religions.has(String(c.religion || '').toLowerCase()));
  }
  return list;
}

module.exports = { applyTemplate, resolveRecipients, channelsForJob, filterContacts };
