const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const CommunicationHistory = require('../models/CommunicationHistory');
const Notification = require('../models/Notification');
const Event = require('../models/Event');
const { getMonthlyChannelSeries } = require('../services/reportService');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function datesFromToday(daysAhead, includeToday = false) {
  const dates = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let offset = includeToday ? 0 : 1; offset <= daysAhead; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    dates.push({ month: date.getMonth() + 1, day: date.getDate() });
  }
  return dates;
}

function annualDateFilter(field, dates) {
  return {
    [field]: { $type: 'date' },
    $expr: {
      $or: dates.map(({ month, day }) => ({
        $and: [
          { $eq: [{ $month: `$${field}` }, month] },
          { $eq: [{ $dayOfMonth: `$${field}` }, day] }
        ]
      }))
    }
  };
}

async function countBy(field) {
  const rows = await Contact.aggregate([
    { $group: { _id: { $ifNull: [`$${field}`, 'Unknown'] }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  return Object.fromEntries(rows.map(row => [row._id, row.count]));
}

async function birthdaysByMonth() {
  const rows = await Contact.aggregate([
    { $match: { dob: { $type: 'date' } } },
    { $group: { _id: { $month: '$dob' }, count: { $sum: 1 } } }
  ]);
  const counts = new Array(12).fill(0);
  rows.forEach(row => { counts[row._id - 1] = row.count; });
  return MONTHS.map((month, index) => ({ month, count: counts[index] }));
}

const dashboardController = {
  async getStats(req, res) {
    try {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const todayBirthdayFilter = annualDateFilter('dob', datesFromToday(0, true));
      const upcomingBirthdayFilter = annualDateFilter('dob', datesFromToday(30));
      const upcomingAnniversaryFilter = annualDateFilter('anniversary', datesFromToday(30));
      const messagesTodayFilter = {
        $or: [
          { sentAt: { $gte: startOfToday, $lt: startOfTomorrow } },
          { sentAt: null, createdAt: { $gte: startOfToday, $lt: startOfTomorrow } }
        ]
      };

      const [
        totalContacts, todayBirthdays, upcomingBirthdays, upcomingAnniversaries, upcomingEvents,
        messagesToday, pendingMessages, emailSent, whatsappSent, activeCampaigns,
        birthdayMonths, contactsBySector, contactsByReligion, messagesByMonth,
        recentActivities, recentContacts, notifications, todayBirthdaysList, upcomingBirthdaysList
      ] = await Promise.all([
        Contact.countDocuments(),
        Contact.countDocuments(todayBirthdayFilter),
        Contact.countDocuments(upcomingBirthdayFilter),
        Contact.countDocuments(upcomingAnniversaryFilter),
        Event.countDocuments({ date: { $gte: startOfToday } }),
        Message.countDocuments(messagesTodayFilter),
        Message.countDocuments({ status: { $in: ['pending', 'scheduled'] } }),
        Message.countDocuments({ type: 'email', status: 'sent' }),
        Message.countDocuments({ type: 'whatsapp', status: 'sent' }),
        Campaign.countDocuments({ status: { $in: ['running', 'scheduled'] } }),
        birthdaysByMonth(),
        countBy('sector'),
        countBy('religion'),
        getMonthlyChannelSeries(Message),
        CommunicationHistory.find().sort({ sentAt: -1 }).limit(10).lean(),
        Contact.find().sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
        Notification.find().sort({ createdAt: -1 }).limit(10).lean(),
        Contact.find(todayBirthdayFilter).sort({ firstName: 1, _id: 1 }).limit(5).lean(),
        Contact.find(upcomingBirthdayFilter).sort({ firstName: 1, _id: 1 }).limit(5).lean()
      ]);

      res.json({
        success: true,
        data: {
          stats: { totalContacts, todayBirthdays, upcomingBirthdays, upcomingAnniversaries, upcomingEvents, messagesToday, pendingMessages, emailSent, whatsappSent, activeCampaigns },
          charts: { birthdaysByMonth: birthdayMonths, contactsBySector, contactsByReligion, messagesByMonth },
          recentActivities,
          recentContacts,
          notifications,
          todayBirthdaysList,
          upcomingBirthdaysList
        }
      });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
};

module.exports = dashboardController;
