const ids = {
  contact: '507f1f77bcf86cd799439011',
  group: '507f1f77bcf86cd799439012',
  template: '507f1f77bcf86cd799439013',
  campaign: '507f1f77bcf86cd799439014',
  event: '507f1f77bcf86cd799439015',
  festival: '507f1f77bcf86cd799439016',
  job: '507f1f77bcf86cd799439017',
  message: '507f1f77bcf86cd799439018',
  user: '507f1f77bcf86cd799439019'
};

const user = {
  _id: ids.user,
  id: ids.user,
  name: 'RMS Test Admin',
  email: 'admin@example.com',
  role: 'admin',
  phone: '9999999999',
  isActive: true,
  notificationPrefs: {
    email: true,
    whatsapp: true,
    birthday: true,
    anniversary: true,
    festival: true,
    campaign: true
  }
};

const contact = {
  _id: ids.contact,
  firstName: 'Asha',
  lastName: 'Patil',
  gender: 'Female',
  dob: '1990-09-01T00:00:00.000Z',
  anniversary: '2015-09-02T00:00:00.000Z',
  mobile: '9876543210',
  whatsapp: '9876543210',
  email: 'asha@example.com',
  designation: 'Director',
  occupation: 'Business',
  company: 'Example Pvt Ltd',
  city: 'Pune',
  sector: 'Associates',
  religion: 'Hindu',
  state: 'Maharashtra',
  pincode: '411001',
  address: '1 Test Road',
  country: 'India',
  tags: ['priority'],
  groups: [ids.group],
  status: 'Active',
  notes: 'Deterministic browser fixture'
};

const group = {
  _id: ids.group,
  name: 'Pune Associates',
  description: 'Deterministic group',
  type: 'static',
  members: [ids.contact],
  excludedMembers: [],
  rules: [],
  memberCount: 1,
  color: '#2563eb',
  createdAt: '2026-09-01T08:00:00.000Z'
};

const template = {
  _id: ids.template,
  name: 'Birthday Greeting',
  type: 'birthday',
  subject: 'Happy Birthday {{Name}}',
  body: 'Dear {{Name}}, happy birthday!',
  isDefault: true,
  updatedAt: '2026-09-01T08:00:00.000Z'
};

const campaign = {
  _id: ids.campaign,
  name: 'September Greeting',
  type: 'email',
  channel: 'email',
  content: 'Hello {{Name}}',
  status: 'completed',
  scheduledAt: '2026-09-01T09:00:00.000Z',
  stats: { total: 1, sent: 1, delivered: 1, failed: 0 },
  createdAt: '2026-09-01T08:00:00.000Z'
};

const event = {
  _id: ids.event,
  title: 'Annual Meeting',
  description: 'Annual member meeting',
  venue: 'Pune Hall',
  mapsLink: 'https://maps.example.test/location',
  date: '2026-09-30T00:00:00.000Z',
  time: '10:00',
  status: 'draft',
  channel: 'email'
};

const festival = {
  _id: ids.festival,
  name: 'Diwali',
  date: '2026-11-08T00:00:00.000Z',
  type: 'Religious',
  message: 'Warm wishes',
  channel: 'email',
  status: 'draft',
  sentCount: 0
};

const job = {
  _id: ids.job,
  name: 'September Greeting Delivery',
  type: 'campaign',
  channel: 'email',
  status: 'completed',
  createdAt: '2026-09-01T08:00:00.000Z',
  stats: {
    total: 1,
    processed: 1,
    sent: 0,
    delivered: 1,
    failed: 0,
    skipped: 0,
    pending: 0,
    retrying: 0
  }
};

const message = {
  _id: ids.message,
  jobId: ids.job,
  contactId: ids.contact,
  contactName: 'Asha Patil',
  recipient: 'asha@example.com',
  type: 'email',
  subject: 'September Greeting',
  status: 'delivered',
  retryCount: 0,
  sentAt: '2026-09-01T08:01:00.000Z',
  deliveredAt: '2026-09-01T08:01:00.000Z'
};

const notification = {
  _id: '507f1f77bcf86cd799439020',
  title: 'Campaign delivered',
  message: 'September Greeting was delivered successfully.',
  link: '/pages/delivery.html',
  isRead: false,
  createdAt: '2026-09-01T08:02:00.000Z'
};

const dashboard = {
  stats: {
    totalContacts: 1,
    todayBirthdays: 1,
    upcomingBirthdays: 0,
    upcomingAnniversaries: 1,
    upcomingEvents: 1,
    messagesToday: 1,
    pendingMessages: 0,
    emailSent: 1,
    whatsappSent: 0,
    activeCampaigns: 0
  },
  charts: {
    birthdaysByMonth: [{ month: 'Sep', count: 1 }],
    contactsBySector: { Associates: 1 },
    contactsByReligion: { Hindu: 1 },
    messagesByMonth: { '2026-09': 12 }
  },
  recentActivities: [{
    contactName: 'Asha Patil',
    type: 'email',
    message: 'September greeting delivered',
    sentAt: '2026-09-01T08:01:00.000Z'
  }],
  recentContacts: [contact],
  notifications: [notification],
  todayBirthdaysList: [contact],
  upcomingBirthdaysList: []
};

const settings = {
  company: {
    name: 'RMS Test Company',
    email: 'company@example.com',
    phone: '0200000000',
    website: 'https://example.test',
    address: '1 Test Road, Pune'
  },
  smtp: {
    host: 'smtp.example.test',
    port: 587,
    user: 'mailer@example.com',
    fromEmail: 'mailer@example.com',
    fromName: 'RMS Test'
  },
  whatsapp: {
    apiUrl: 'https://graph.example.test/v1',
    phoneNumberId: 'phone-id',
    businessAccountId: 'business-id'
  },
  theme: { primaryColor: '#2563eb', darkMode: false },
  roles: [
    { name: 'admin', permissions: ['all'] },
    { name: 'manager', permissions: ['contacts', 'campaigns'] },
    { name: 'user', permissions: ['contacts'] }
  ],
  labels: {},
  autoBirthdayWish: true,
  autoAnniversaryWish: true
};

module.exports = {
  ids,
  user,
  contact,
  group,
  template,
  campaign,
  event,
  festival,
  job,
  message,
  notification,
  dashboard,
  settings
};
