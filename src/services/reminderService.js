const Reminder = require('../models/Reminder');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

async function createReminder(data) {
  const reminder = await Reminder.create(data);
  logger.info('Reminder created:', { title: reminder.title, phone: reminder.phone });
  return reminder;
}

async function getReminders(filter = {}) {
  const query = {};
  if (filter.status) query.status = filter.status;
  return await Reminder.find(query).sort({ scheduledAt: -1 }).lean();
}

async function updateReminder(id, updates) {
  const allowed = ['title', 'description', 'phone', 'scheduledAt', 'status', 'type'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }
  return await Reminder.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function deleteReminder(id) {
  return await Reminder.findByIdAndDelete(id);
}

async function checkAndSendDueReminders() {
  try {
    const now = new Date();
    const due = await Reminder.find({
      status: 'pending',
      scheduledAt: { $lte: now },
    });

    let sent = 0;
    let failed = 0;
    for (const reminder of due) {
      try {
        let text = `Reminder: ${reminder.title}`;
        if (reminder.description) text += `\n${reminder.description}`;
        text += `\n\nType: ${reminder.type.replace('_', ' ')}`;

        await whatsappService.sendTextMessage(reminder.phone, text);
        reminder.status = 'sent';
        reminder.sentAt = new Date();
        await reminder.save();
        sent++;
        logger.info('Reminder sent:', { title: reminder.title, phone: reminder.phone });
      } catch (err) {
        reminder.retryCount = (reminder.retryCount || 0) + 1;
        reminder.lastError = err.message;
        if (reminder.retryCount >= 3) {
          reminder.status = 'failed';
          failed++;
        }
        await reminder.save();
        logger.error('Reminder send failed:', { title: reminder.title, retry: reminder.retryCount, error: err.message });
      }
    }
    return { sent, failed, pending: due.length - sent - failed };
  } catch (err) {
    logger.error('checkAndSendDueReminders error:', err.message);
    throw err;
  }
}

module.exports = { createReminder, getReminders, updateReminder, deleteReminder, checkAndSendDueReminders };
