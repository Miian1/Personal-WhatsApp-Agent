const logger = require('../utils/logger');

async function runDueChecks() {
  try {
    const connectDB = require('../config/db');
    await connectDB();
    const reminderService = require('./reminderService');
    const campaignService = require('./campaignService');
    const reminders = await reminderService.checkAndSendDueReminders();
    const campaigns = await campaignService.checkAndSendScheduledCampaigns();
    if (reminders.sent > 0 || campaigns.length > 0) {
      logger.info('Due checks executed:', { reminders, campaigns });
    }
    return { reminders, campaigns };
  } catch (err) {
    logger.error('runDueChecks error:', err.message);
    return { reminders: null, campaigns: null };
  }
}

async function runDueChecksFireAndForget() {
  return runDueChecks().catch(() => null);
}

module.exports = { runDueChecks, runDueChecksFireAndForget };
