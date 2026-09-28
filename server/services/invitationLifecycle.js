const Event = require('../models/Event');
const logger = require('../utils/logger');

async function syncEventStatus(job, status) {
  if (!job?.eventId) return;
  try {
    // An older delivery is allowed to finish, but cannot own a newer delivery's UI.
    await Event.findOneAndUpdate({ _id: job.eventId, deliveryJobId: job._id },
      { $set: { status } }, { new: true, runValidators: true });
  } catch (error) {
    logger.error('Invitation delivery status update failed', { eventId: job.eventId, jobId: job._id, error: error.message });
  }
}

module.exports = { syncEventStatus };
