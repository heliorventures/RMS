const SUPPORTED_CHANNELS = ['email', 'whatsapp', 'sms'];

async function getMonthlyChannelSeries(Message) {
  const rows = await Message.aggregate([
    {
      $match: {
        type: { $in: SUPPORTED_CHANNELS },
        $or: [
          { sentAt: { $type: 'date' } },
          { createdAt: { $type: 'date' } }
        ]
      }
    },
    {
      $project: {
        type: 1,
        activityAt: { $ifNull: ['$sentAt', '$createdAt'] }
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
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

module.exports = { getMonthlyChannelSeries };
