const ScheduledMessage = require('../models/ScheduledMessage');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

async function createScheduledMessage(data) {
  const scheduled = await ScheduledMessage.create(data);
  logger.info('Scheduled message created:', { title: scheduled.title, phone: scheduled.phone, scheduledAt: scheduled.scheduledAt });
  return scheduled;
}

async function getScheduledMessages(filter = {}) {
  const query = {};
  if (filter.status) query.status = filter.status;
  return await ScheduledMessage.find(query).sort({ scheduledAt: -1 }).lean();
}

async function updateScheduledMessage(id, updates) {
  const allowed = ['title', 'phone', 'message', 'scheduledAt', 'status'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }
  return await ScheduledMessage.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function deleteScheduledMessage(id) {
  return await ScheduledMessage.findByIdAndDelete(id);
}

async function sendScheduledMessage(id) {
  try {
    const scheduled = await ScheduledMessage.findById(id);
    if (!scheduled) throw new Error('Scheduled message not found');
    if (scheduled.status === 'sent') throw new Error('Message already sent');
    if (scheduled.status === 'cancelled') throw new Error('Message cancelled');

    await whatsappService.sendTextMessage(scheduled.phone, scheduled.message);
    scheduled.status = 'sent';
    scheduled.sentAt = new Date();
    await scheduled.save();
    logger.info('Scheduled message sent:', { title: scheduled.title, phone: scheduled.phone });
    return { success: true, sent: true };
  } catch (err) {
    logger.error('sendScheduledMessage error:', err.message);
    throw err;
  }
}

async function checkAndSendDueScheduledMessages() {
  try {
    const now = new Date();
    const due = await ScheduledMessage.find({
      status: 'pending',
      scheduledAt: { $lte: now },
    });

    let sent = 0;
    let failed = 0;
    for (const scheduled of due) {
      try {
        const claimed = await ScheduledMessage.updateOne(
          { _id: scheduled._id, status: 'pending' },
          { $set: { status: 'sending' } }
        );
        if (claimed.modifiedCount === 0) continue;

        await whatsappService.sendTextMessage(scheduled.phone, scheduled.message);
        scheduled.status = 'sent';
        scheduled.sentAt = new Date();
        await scheduled.save();
        sent++;
        logger.info('Scheduled message sent:', { title: scheduled.title, phone: scheduled.phone });
      } catch (err) {
        scheduled.retryCount = (scheduled.retryCount || 0) + 1;
        scheduled.lastError = err.message;
        if (scheduled.retryCount >= 3) {
          scheduled.status = 'failed';
          failed++;
        } else {
          scheduled.status = 'pending';
        }
        await scheduled.save();
        logger.error('Scheduled message send failed:', { title: scheduled.title, retry: scheduled.retryCount, error: err.message });
      }
    }
    return { sent, failed, pending: due.length - sent - failed };
  } catch (err) {
    logger.error('checkAndSendDueScheduledMessages error:', err.message);
    throw err;
  }
}

module.exports = {
  createScheduledMessage,
  getScheduledMessages,
  updateScheduledMessage,
  deleteScheduledMessage,
  sendScheduledMessage,
  checkAndSendDueScheduledMessages,
};
