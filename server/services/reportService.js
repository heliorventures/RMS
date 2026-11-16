const SUPPORTED_CHANNELS = ['email', 'whatsapp', 'sms'];
const SENT_STATUSES = ['sent', 'delivered', 'read'];

async function getMonthlyChannelSeries(Message) {
  const rows = await Message.aggregate([
    {
      $match: {
        type: { $in: SUPPORTED_CHANNELS },
        status: { $in: SENT_STATUSES },
        sentAt: { $type: 'date' }
      }
    },
    {
      $project: {
        type: 1,
        activityAt: '$sentAt'
      }
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$activityAt', timezone: 'UTC' } },
          channel: '$type'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.month': 1, '_id.channel': 1 } }
  ]);

  const byMonth = new Map();
  for (const row of rows) {
    const month = row?._id?.month;
    const channel = row?._id?.channel;
    if (!month || !SUPPORTED_CHANNELS.includes(channel)) continue;
    if (!byMonth.has(month)) byMonth.set(month, { month, email: 0, whatsapp: 0, sms: 0 });
    byMonth.get(month)[channel] = Number(row.count) || 0;
  }
  const months = [...byMonth.keys()].sort();
  if (!months.length) return [];
  const result = [];
  const cursor = new Date(`${months[0]}-01T00:00:00Z`);
  const end = months[months.length - 1];
  while (cursor.toISOString().slice(0, 7) <= end) {
    const month = cursor.toISOString().slice(0, 7);
    result.push(byMonth.get(month) || { month, email: 0, whatsapp: 0, sms: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

module.exports = { getMonthlyChannelSeries, SENT_STATUSES };
