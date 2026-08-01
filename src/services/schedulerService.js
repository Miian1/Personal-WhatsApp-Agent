const logger = require('../utils/logger');

let schedulerTimer = null;

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

function startAutoScheduler() {
  if (schedulerTimer) return schedulerTimer;
  const intervalMs = Math.max(5000, parseInt(process.env.SCHEDULER_INTERVAL_MS || '30000', 10) || 30000);
  logger.info(`Auto scheduler started (checks every ${intervalMs}ms)`);
  schedulerTimer = setInterval(() => {
    runDueChecksFireAndForget();
  }, intervalMs);
  if (schedulerTimer.unref) schedulerTimer.unref();
  return schedulerTimer;
}

function stopAutoScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Auto scheduler stopped');
  }
}

module.exports = { runDueChecks, runDueChecksFireAndForget, startAutoScheduler, stopAutoScheduler };
