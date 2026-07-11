/**
 * RMS Sample Data Generator
 * Run: npm run seed
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const firstNames = {
  Male: ['Rajesh', 'Amit', 'Vikram', 'Suresh', 'Rahul', 'Anil', 'Deepak', 'Sanjay', 'Manoj', 'Prakash', 'Nitin', 'Ashok', 'Ravi', 'Kiran', 'Mahesh', 'Ganesh', 'Sunil', 'Vijay', 'Rohit', 'Arun', 'Harsh', 'Kunal', 'Varun', 'Aditya', 'Nikhil'],
  Female: ['Priya', 'Anjali', 'Sunita', 'Kavita', 'Meera', 'Pooja', 'Neha', 'Rekha', 'Sneha', 'Divya', 'Shweta', 'Nisha', 'Ritu', 'Geeta', 'Lata', 'Usha', 'Asha', 'Maya', 'Jyoti', 'Swati', 'Tanvi', 'Isha', 'Riya', 'Aditi', 'Komal']
};
const lastNames = ['Sharma', 'Patel', 'Jain', 'Gupta', 'Mehta', 'Shah', 'Desai', 'Kulkarni', 'Joshi', 'Rao', 'Reddy', 'Singh', 'Kumar', 'Agarwal', 'Verma', 'Malhotra', 'Chopra', 'Kapoor', 'Bhatia', 'Nair', 'Iyer', 'Menon', 'Pillai', 'Thakur', 'Pandey'];
const cities = ['Pune', 'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad'];
const states = { Pune: 'Maharashtra', Mumbai: 'Maharashtra', Delhi: 'Delhi', Bangalore: 'Karnataka', Hyderabad: 'Telangana', Ahmedabad: 'Gujarat' };
const religions = ['Hindu', 'Jain', 'Muslim', 'Christian', 'Sikh'];
const sectors = ['Government', 'Supplier', 'Consultant', 'Builder', 'Friends', 'Associates', 'Flat Holder'];
const occupations = ['Engineer', 'Doctor', 'Lawyer', 'Business Owner', 'Manager', 'Consultant', 'Architect', 'CA', 'Teacher', 'Retired'];
const companies = ['Tata Group', 'Reliance Industries', 'Infosys', 'Wipro', 'Mahindra', 'L&T', 'Godrej', 'Bajaj Auto', 'Persistent Systems', 'KPIT Technologies', 'Self Employed', 'Govt of Maharashtra'];
const designations = ['Director', 'Manager', 'Senior Executive', 'Partner', 'CEO', 'VP Sales', 'Consultant', 'Officer', 'Head of Operations'];
const tags = ['VIP', 'Client', 'Partner', 'Lead', 'Referral', 'Family', 'Colleague'];
const festivalNames = [
  { name: 'Diwali', religion: 'Hindu', month: 10, day: 20 },
  { name: 'Holi', religion: 'Hindu', month: 2, day: 14 },
  { name: 'Eid ul-Fitr', religion: 'Muslim', month: 3, day: 31 },
  { name: 'Christmas', religion: 'Christian', month: 11, day: 25 },
  { name: 'Guru Nanak Jayanti', religion: 'Sikh', month: 10, day: 15 },
  { name: 'Mahavir Jayanti', religion: 'Jain', month: 3, day: 21 },
  { name: 'Ganesh Chaturthi', religion: 'Hindu', month: 8, day: 7 },
  { name: 'Navratri', religion: 'Hindu', month: 9, day: 3 },
  { name: 'Raksha Bandhan', religion: 'Hindu', month: 7, day: 19 },
  { name: 'Pongal', religion: 'Hindu', month: 0, day: 14 },
  { name: 'Onam', religion: 'Hindu', month: 8, day: 5 },
  { name: 'Baisakhi', religion: 'Sikh', month: 3, day: 13 }
];
const eventTitles = ['Annual Business Meet 2026', 'Product Launch Event', 'Networking Dinner', 'Charity Gala', 'Team Building Retreat', 'Investor Meet', 'Client Appreciation Day', 'Industry Conference', 'Workshop on Digital Marketing', 'New Office Inauguration', 'Founders Day Celebration', 'Awards Ceremony', 'Partnership Signing', 'Community Outreach Program', 'Tech Summit 2026', 'Real Estate Expo', 'Jain Community Gathering', 'Supplier Meet', 'Board Meeting Reception', 'Holiday Party'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(2, '0'); }

function randomDate(yearMin, yearMax) {
  const y = randInt(yearMin, yearMax);
  const m = randInt(0, 11);
  const d = randInt(1, 28);
  return new Date(y, m, d).toISOString();
}

function randomPhone() {
  return `+91 ${randInt(70, 99)}${randInt(10000000, 99999999)}`;
}

function makeContact(i, groups, useFastId = false) {
  const gender = rand(['Male', 'Female']);
  const fn = rand(firstNames[gender]);
  const ln = rand(lastNames);
  const city = rand(cities);
  const sector = rand(sectors);
  const status = Math.random() < 0.1 ? 'VIP' : (Math.random() < 0.05 ? 'Inactive' : 'Active');
  const dob = randomDate(1960, 2000);
  const hasAnniversary = Math.random() > 0.4;

  return {
    _id: useFastId ? `c-${String(i + 1).padStart(6, '0')}` : uuidv4(),
    firstName: fn,
    lastName: ln,
    gender,
    dob,
    anniversary: hasAnniversary ? randomDate(1990, 2020) : null,
    mobile: randomPhone(),
    whatsapp: randomPhone(),
    email: `contact${i + 1}@${ln.toLowerCase()}.com`,
    religion: rand(religions),
    sector,
    occupation: rand(occupations),
    company: rand(companies),
    designation: rand(designations),
    city,
    state: states[city],
    country: 'India',
    address: `${randInt(1, 500)}, ${rand(['MG Road', 'FC Road', 'Link Road', 'Park Street', 'Ring Road'])}, ${city}`,
    pincode: String(randInt(400000, 411999)),
    tags: [rand(tags), ...(Math.random() > 0.5 ? [rand(tags)] : [])],
    notes: `Contact added via RMS. ${sector} professional based in ${city}.`,
    status,
    groups: Math.random() > 0.7 ? [rand(groups)._id] : [],
    photo: null,
    timeline: [
      { action: 'Created', description: 'Contact profile created', date: new Date(Date.now() - randInt(1, 365) * 86400000).toISOString(), user: 'Admin User' }
    ],
    createdAt: new Date(Date.now() - randInt(1, 730) * 86400000).toISOString()
  };
}

async function generate() {
  const contactCount = parseInt(process.argv[2] || process.env.CONTACT_COUNT || '200', 10);
  console.log(`Generating RMS sample data (${contactCount.toLocaleString()} contacts)...`);
  const password = await bcrypt.hash('admin123', 12);

  const users = [
    { _id: uuidv4(), name: 'Admin User', email: 'admin@rms.com', password, role: 'admin', phone: '+91 9876543210', isActive: true, createdAt: new Date().toISOString() },
    { _id: uuidv4(), name: 'Manager User', email: 'manager@rms.com', password, role: 'manager', phone: '+91 9876543211', isActive: true, createdAt: new Date().toISOString() },
    { _id: uuidv4(), name: 'Demo User', email: 'demo@rms.com', password, role: 'user', phone: '+91 9876543212', isActive: true, createdAt: new Date().toISOString() }
  ];

  const groups = [
    { _id: uuidv4(), name: 'Government', description: 'Government officials and contacts', color: '#1e40af', icon: 'bi-building', type: 'dynamic', rules: [{ field: 'sector', operator: 'equals', value: 'Government' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Builders', description: 'Construction and real estate builders', color: '#dc2626', icon: 'bi-hammer', type: 'dynamic', rules: [{ field: 'sector', operator: 'equals', value: 'Builder' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Consultants', description: 'Professional consultants', color: '#7c3aed', icon: 'bi-briefcase', type: 'dynamic', rules: [{ field: 'sector', operator: 'equals', value: 'Consultant' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Suppliers', description: 'Material and service suppliers', color: '#059669', icon: 'bi-truck', type: 'dynamic', rules: [{ field: 'sector', operator: 'equals', value: 'Supplier' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Friends', description: 'Personal friends network', color: '#0891b2', icon: 'bi-heart', type: 'dynamic', rules: [{ field: 'sector', operator: 'equals', value: 'Friends' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Associates', description: 'Business associates', color: '#ca8a04', icon: 'bi-people', type: 'dynamic', rules: [{ field: 'sector', operator: 'equals', value: 'Associates' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Flat Holders', description: 'Residential flat owners', color: '#6366f1', icon: 'bi-house', type: 'dynamic', rules: [{ field: 'sector', operator: 'equals', value: 'Flat Holder' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'VIP', description: 'Very important persons', color: '#be185d', icon: 'bi-star-fill', type: 'dynamic', rules: [{ field: 'status', operator: 'equals', value: 'VIP' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Investors', description: 'Investment partners', color: '#0d9488', icon: 'bi-graph-up-arrow', type: 'static', rules: [], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Pune Clients', description: 'Clients based in Pune', color: '#2563eb', icon: 'bi-geo-alt', type: 'dynamic', rules: [{ field: 'city', operator: 'equals', value: 'Pune' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Mumbai Clients', description: 'Clients based in Mumbai', color: '#2563eb', icon: 'bi-geo-alt-fill', type: 'dynamic', rules: [{ field: 'city', operator: 'equals', value: 'Mumbai' }], memberCount: 0, isActive: true },
    { _id: uuidv4(), name: 'Jain Community', description: 'Jain community members', color: '#f59e0b', icon: 'bi-peace', type: 'dynamic', rules: [{ field: 'religion', operator: 'equals', value: 'Jain' }], memberCount: 0, isActive: true }
  ];

  const contacts = [];
  const useFastId = contactCount >= 5000;
  for (let i = 0; i < contactCount; i++) {
    contacts.push(makeContact(i, groups, useFastId));
  }

  // Ensure some birthdays today and upcoming
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    contacts[i].dob = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate()).toISOString();
  }
  for (let i = 5; i < 15; i++) {
    const future = new Date(today);
    future.setDate(today.getDate() + randInt(1, 25));
    contacts[i].dob = new Date(today.getFullYear() - 35, future.getMonth(), future.getDate()).toISOString();
  }

  const templates = [
    { _id: uuidv4(), name: 'Classic Birthday Wish', type: 'birthday', subject: 'Happy Birthday {{Name}}!', body: 'Dear {{Name}},\n\nWishing you a very Happy Birthday! May your special day be filled with joy, laughter, and wonderful memories.\n\nWarm regards,\nRMS Team', variables: ['Name', 'City', 'Company'], isDefault: true, isActive: true },
    { _id: uuidv4(), name: 'Professional Birthday', type: 'birthday', subject: 'Birthday Greetings - {{Name}}', body: 'Dear {{Name}},\n\nOn behalf of {{Company}}, we extend our heartfelt birthday wishes. May this year bring you success and happiness.\n\nBest wishes!', variables: ['Name', 'Company'], isDefault: false, isActive: true },
    { _id: uuidv4(), name: 'Anniversary Wishes', type: 'anniversary', subject: 'Happy Anniversary {{Name}}!', body: 'Dear {{Name}},\n\nCongratulations on your anniversary! Wishing you many more years of togetherness and joy.\n\nWith warm wishes!', variables: ['Name'], isDefault: true, isActive: true },
    { _id: uuidv4(), name: 'Diwali Greetings', type: 'festival', subject: 'Happy Diwali {{Name}}!', body: 'Dear {{Name}},\n\nWishing you and your family a very Happy Diwali! May the festival of lights bring prosperity and happiness to your home in {{City}}.\n\nShubh Deepavali!', variables: ['Name', 'City'], isDefault: true, isActive: true },
    { _id: uuidv4(), name: 'Festival General', type: 'festival', subject: 'Festival Greetings', body: 'Dear {{Name}},\n\nWarm festival greetings to you and your family. May this occasion bring joy and blessings.\n\nRegards,\nRMS Team', variables: ['Name'], isDefault: false, isActive: true },
    { _id: uuidv4(), name: 'Event Invitation Email', type: 'invitation', subject: 'You are Invited - {{EventTitle}}', body: 'Dear {{Name}},\n\nYou are cordially invited to {{EventTitle}}.\n\nVenue: {{Venue}}\nDate: {{Date}}\n\nWe look forward to your presence.\n\nRSVP required.', variables: ['Name', 'EventTitle', 'Venue', 'Date'], isDefault: true, isActive: true },
    { _id: uuidv4(), name: 'WhatsApp Birthday', type: 'whatsapp', subject: '', body: '🎂 Happy Birthday {{Name}}! 🎉\n\nWishing you a fantastic day filled with love and laughter from all of us at RMS!\n\n- Team RMS', variables: ['Name'], isDefault: true, isActive: true },
    { _id: uuidv4(), name: 'Email Newsletter', type: 'email', subject: 'Monthly Update - {{Company}}', body: 'Dear {{Name}},\n\nHere is your monthly update from RMS. We value your relationship and look forward to connecting with you.\n\nBest regards,\nRMS Team', variables: ['Name', 'Company', 'Sector'], isDefault: false, isActive: true },
    { _id: uuidv4(), name: 'VIP Birthday Special', type: 'birthday', subject: 'Special Birthday Wishes for {{Name}}', body: 'Dear {{Name}},\n\nAs a valued VIP contact, we extend our exclusive birthday wishes. May this year exceed all your expectations!\n\nWith highest regards,\nManagement Team', variables: ['Name', 'Company'], isDefault: false, isActive: true },
    { _id: uuidv4(), name: 'Jain Festival Wishes', type: 'festival', subject: 'Mahavir Jayanti Greetings', body: 'Dear {{Name}},\n\nWishing you peace and prosperity on this auspicious occasion of Mahavir Jayanti.\n\nJai Jinendra!', variables: ['Name', 'City'], isDefault: false, isActive: true }
  ];

  const year = new Date().getFullYear();
  const festivals = festivalNames.map((f, i) => ({
    _id: uuidv4(),
    name: f.name,
    date: new Date(year, f.month, f.day).toISOString(),
    religion: f.religion,
    message: `Warm wishes on the occasion of ${f.name}! May this festival bring joy and prosperity to you and your family.`,
    image: null,
    templateId: templates.find(t => t.type === 'festival')?._id,
    recipients: { cities: rand(cities.slice(0, 3)), sectors: [], religions: [f.religion], groups: [] },
    scheduledAt: null,
    status: i < 4 ? 'sent' : (i < 8 ? 'scheduled' : 'draft'),
    sentCount: i < 4 ? randInt(50, 150) : 0,
    createdAt: new Date().toISOString()
  }));

  const events = eventTitles.map((title, i) => ({
    _id: uuidv4(),
    title,
    description: `Join us for ${title}. An exclusive event for our valued contacts and partners.`,
    venue: `${rand(['Taj Hotel', 'Marriott', 'Hyatt', 'Convention Center', 'Club House'])}, ${rand(cities)}`,
    date: new Date(year, randInt(0, 11), randInt(1, 28)).toISOString(),
    time: `${pad(randInt(9, 18))}:${pad(randInt(0, 3) * 15)}`,
    mapsLink: 'https://maps.google.com',
    invitationImage: null,
    invitationPdf: null,
    recipients: { contacts: [], groups: [rand(groups)._id], cities: [rand(cities)], sectors: [rand(sectors)] },
    scheduledAt: null,
    status: ['draft', 'scheduled', 'sent', 'completed'][i % 4],
    deliveryStats: { email: { sent: randInt(20, 80), delivered: randInt(15, 75), failed: randInt(0, 5) }, whatsapp: { sent: randInt(10, 50), delivered: randInt(8, 48), failed: randInt(0, 3) } },
    createdAt: new Date().toISOString()
  }));

  const campaignTypes = ['birthday', 'anniversary', 'festival', 'invitation', 'email', 'whatsapp'];
  const campaigns = [];
  for (let i = 0; i < 15; i++) {
    const type = rand(campaignTypes);
    campaigns.push({
      _id: uuidv4(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Campaign ${i + 1}`,
      type,
      channel: rand(['email', 'whatsapp', 'both']),
      templateId: rand(templates)._id,
      recipients: { contacts: [], groups: [rand(groups)._id], filters: { city: rand(cities) } },
      content: 'Campaign message content with {{Name}} variable.',
      scheduledAt: Math.random() > 0.5 ? new Date(Date.now() + randInt(1, 30) * 86400000).toISOString() : null,
      status: rand(['draft', 'scheduled', 'running', 'completed', 'completed']),
      stats: { total: randInt(50, 200), sent: randInt(40, 180), delivered: randInt(35, 170), failed: randInt(0, 10), opened: randInt(20, 100) },
      createdAt: new Date(Date.now() - randInt(1, 90) * 86400000).toISOString()
    });
  }

  const messages = [];
  for (let i = 0; i < 80; i++) {
    const contact = rand(contacts);
    const type = rand(['email', 'whatsapp', 'sms']);
    const status = rand(['sent', 'delivered', 'pending', 'failed', 'scheduled']);
    messages.push({
      _id: uuidv4(),
      contactId: contact._id,
      campaignId: rand(campaigns)._id,
      type,
      subject: type === 'email' ? `Message for ${contact.firstName}` : '',
      body: `Hello ${contact.firstName}, this is a sample ${type} message.`,
      status,
      scheduledAt: status === 'scheduled' ? new Date(Date.now() + randInt(1, 7) * 86400000).toISOString() : null,
      sentAt: ['sent', 'delivered'].includes(status) ? new Date(Date.now() - randInt(0, 30) * 86400000).toISOString() : null,
      createdAt: new Date(Date.now() - randInt(0, 60) * 86400000).toISOString()
    });
  }

  const commTypes = ['email', 'whatsapp', 'sms', 'call', 'meeting'];
  const commStatuses = ['sent', 'delivered', 'read', 'failed'];
  const communicationHistory = [];
  for (let i = 0; i < 50; i++) {
    const contact = rand(contacts);
    communicationHistory.push({
      _id: uuidv4(),
      contactId: contact._id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      type: rand(commTypes),
      subject: `Communication with ${contact.firstName}`,
      message: `Follow-up ${rand(commTypes)} regarding ${contact.sector} engagement.`,
      status: rand(commStatuses),
      sentBy: rand(users).name,
      sentAt: new Date(Date.now() - randInt(0, 45) * 86400000).toISOString(),
      createdAt: new Date(Date.now() - randInt(0, 45) * 86400000).toISOString()
    });
  }

  const notifications = [
    { _id: uuidv4(), title: '5 Birthdays Today', message: 'You have 5 contacts celebrating birthdays today.', type: 'birthday', link: '/pages/birthdays.html', isRead: false, createdAt: new Date().toISOString() },
    { _id: uuidv4(), title: 'Campaign Completed', message: 'Diwali Campaign reached 150 recipients successfully.', type: 'campaign', link: '/pages/campaigns.html', isRead: false, createdAt: new Date().toISOString() },
    { _id: uuidv4(), title: 'New Contact Added', message: 'Rajesh Sharma was added to your contacts.', type: 'info', link: '/pages/contacts.html', isRead: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { _id: uuidv4(), title: 'Upcoming Event', message: 'Annual Business Meet 2026 is scheduled for next week.', type: 'info', link: '/pages/invitations.html', isRead: false, createdAt: new Date().toISOString() },
    { _id: uuidv4(), title: 'Anniversary Reminder', message: '3 anniversaries coming up this week.', type: 'anniversary', link: '/pages/anniversaries.html', isRead: false, createdAt: new Date().toISOString() }
  ];

  const settings = {
    company: { name: 'RMS Solutions Pvt Ltd', logo: '/assets/images/logo.svg', address: '123 Business Park, Baner, Pune 411045', phone: '+91 20 1234 5678', email: 'info@rms.com', website: 'www.rms.com' },
    smtp: { host: 'smtp.gmail.com', port: 587, user: '', password: '', fromEmail: 'noreply@rms.com', fromName: 'RMS Team', secure: true },
    whatsapp: { apiUrl: 'https://graph.facebook.com/v18.0', apiKey: '', phoneNumberId: '', businessAccountId: '' },
    theme: { primaryColor: '#2563eb', darkMode: false },
    roles: [
      { name: 'Admin', permissions: ['all'] },
      { name: 'Manager', permissions: ['contacts', 'campaigns', 'reports'] },
      { name: 'User', permissions: ['contacts', 'view_reports'] }
    ],
    autoBirthdayWish: true,
    autoAnniversaryWish: true,
    labels: {
      toFormat: '{{fullName}}\n{{designation}}\n{{company}}\n{{address}}\n{{city}}, {{state}} {{pincode}}',
      fromFormat: '{{companyName}}\n{{companyAddress}}\n{{companyPhone}}',
      layout: 'stacked',
      fontSize: 11,
      toHeading: 'To',
      fromHeading: 'From',
      showBorder: true,
      sizePreset: 'envelope',
      width: 100,
      height: 50
    }
  };

  // Update group member counts
  groups.forEach(g => {
    if (g.type === 'dynamic' && g.rules.length) {
      g.memberCount = contacts.filter(c => {
        const rule = g.rules[0];
        return c[rule.field] === rule.value;
      }).length;
    }
  });

  const data = { users, contacts, groups, festivals, events, templates, campaigns, messages, communicationHistory, deliveryJobs: [], settings, notifications };
  const outPath = path.join(__dirname, '../../data/sample-data.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const compact = contactCount >= 5000;
  fs.writeFileSync(outPath, JSON.stringify(data, null, compact ? 0 : 2));
  console.log(`✓ Generated sample data:`);
  console.log(`  - ${users.length} users`);
  console.log(`  - ${contacts.length} contacts`);
  console.log(`  - ${groups.length} groups`);
  console.log(`  - ${festivals.length} festivals`);
  console.log(`  - ${events.length} events`);
  console.log(`  - ${templates.length} templates`);
  console.log(`  - ${campaigns.length} campaigns`);
  console.log(`  - ${messages.length} messages`);
  console.log(`  - ${communicationHistory.length} communication records`);
  console.log(`\nLogin: admin@rms.com / admin123`);
}

generate().catch(console.error);
