const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const CommunicationHistory = require('../models/CommunicationHistory');
const Notification = require('../models/Notification');
const Event = require('../models/Event');

function countByField(items, field) {
  const map = {};
  items.forEach(i => {
    const v = i[field] || 'Unknown';
    map[v] = (map[v] || 0) + 1;
  });
  return map;
}

function birthdaysByMonth(contacts) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const counts = new Array(12).fill(0);
  contacts.forEach(c => {
    if (c.dob) counts[new Date(c.dob).getMonth()]++;
  });
  return months.map((m, i) => ({ month: m, count: counts[i] }));
}

const dashboardController = {
  async getStats(req, res) {
    try {
      const [contacts, messages, campaigns, events, commHistory, notifications] = await Promise.all([
        Contact.find(),
        Message.find(),
        Campaign.find(),
        Event.find(),
        CommunicationHistory.find().sort({ sentAt: -1 }).limit(10),
        Notification.find().sort({ createdAt: -1 }).limit(10)
      ]);

      const today = new Date();
      const todayBirthdays = contacts.filter(c => {
        if (!c.dob) return false;
        const d = new Date(c.dob);
        return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      });

      const upcomingBirthdays = contacts.filter(c => {
        if (!c.dob) return false;
        const d = new Date(c.dob);
        const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const diff = (next - today) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
      });

      const upcomingAnniversaries = contacts.filter(c => {
        if (!c.anniversary) return false;
        const d = new Date(c.anniversary);
        const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const diff = (next - today) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
      });

      const upcomingEvents = events.filter(e => e.date && new Date(e.date) >= today).slice(0, 5);

      const todayStr = today.toISOString().split('T')[0];
      const messagesToday = messages.filter(m => {
        const d = m.sentAt || m.createdAt;
        return d && d.startsWith(todayStr);
      });

      const pendingMessages = messages.filter(m => m.status === 'pending' || m.status === 'scheduled');
      const emailSent = messages.filter(m => m.type === 'email' && m.status === 'sent').length;
      const whatsappSent = messages.filter(m => m.type === 'whatsapp' && m.status === 'sent').length;

      const messagesByMonth = {};
      messages.forEach(m => {
        const d = new Date(m.sentAt || m.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        messagesByMonth[key] = (messagesByMonth[key] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          stats: {
            totalContacts: contacts.length,
            todayBirthdays: todayBirthdays.length,
            upcomingBirthdays: upcomingBirthdays.length,
            upcomingAnniversaries: upcomingAnniversaries.length,
            upcomingEvents: upcomingEvents.length,
            messagesToday: messagesToday.length,
            pendingMessages: pendingMessages.length,
            emailSent,
            whatsappSent,
            activeCampaigns: campaigns.filter(c => c.status === 'running' || c.status === 'scheduled').length
          },
          charts: {
            birthdaysByMonth: birthdaysByMonth(contacts),
            contactsBySector: countByField(contacts, 'sector'),
            contactsByReligion: countByField(contacts, 'religion'),
            messagesByMonth
          },
          recentActivities: commHistory,
          recentContacts: contacts.slice(-5).reverse(),
          notifications,
          todayBirthdaysList: todayBirthdays.slice(0, 5),
          upcomingBirthdaysList: upcomingBirthdays.slice(0, 5)
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = dashboardController;
