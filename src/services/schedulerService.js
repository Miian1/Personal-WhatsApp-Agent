const logger = require('../utils/logger');

async function runDueChecks() {
  try {
    const connectDB = require('../config/db');
    await connectDB();
    const reminderService = require('./reminderService');
    const campaignService = require('./campaignService');
    const scheduledMessageService = require('./scheduledMessageService');
    const reminders = await reminderService.checkAndSendDueReminders();
    const campaigns = await campaignService.checkAndSendScheduledCampaigns();
    const scheduledMessages = await scheduledMessageService.checkAndSendDueScheduledMessages();
    const anyWork = (reminders && reminders.sent > 0) || campaigns.length > 0 || (scheduledMessages && scheduledMessages.sent > 0);
    if (anyWork) {
      logger.info('Due checks executed:', { reminders, campaigns, scheduledMessages });
    }
    return { reminders, campaigns, scheduledMessages };
  } catch (err) {
    logger.error('runDueChecks error:', err.message);
    return { reminders: null, campaigns: null, scheduledMessages: null };
  }
}

async function runDueChecksFireAndForget() {
  return runDueChecks().catch(() => null);
}

module.exports = { runDueChecks, runDueChecksFireAndForget };
