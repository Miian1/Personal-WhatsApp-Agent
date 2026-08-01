const logger = require('../utils/logger');

let schedulerTimer = null;
let exactTimer = null;

function getIntervalMs() {
  return Math.max(5000, parseInt(process.env.SCHEDULER_INTERVAL_MS || '30000', 10) || 30000);
}

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

async function getNextDueTime() {
  try {
    const connectDB = require('../config/db');
    await connectDB();
    const Reminder = require('../models/Reminder');
    const ScheduledMessage = require('../models/ScheduledMessage');
    const Campaign = require('../models/Campaign');
    const [reminder, scheduled, campaign] = await Promise.all([
      Reminder.findOne({ status: 'pending' }).sort({ scheduledAt: 1 }).select('scheduledAt').lean(),
      ScheduledMessage.findOne({ status: 'pending' }).sort({ scheduledAt: 1 }).select('scheduledAt').lean(),
      Campaign.findOne({ status: 'scheduled', scheduledAt: { $ne: null } }).sort({ scheduledAt: 1 }).select('scheduledAt').lean(),
    ]);
    const times = [reminder, scheduled, campaign]
      .map(x => (x && x.scheduledAt ? new Date(x.scheduledAt).getTime() : Infinity));
    const next = Math.min(...times);
    return Number.isFinite(next) ? next : null;
  } catch (err) {
    logger.error('getNextDueTime error:', err.message);
    return null;
  }
}

function clearExactTimer() {
  if (exactTimer) {
    clearTimeout(exactTimer);
    exactTimer = null;
  }
}

async function scheduleExact() {
  clearExactTimer();
  const next = await getNextDueTime();
  if (!next) return;
  const delay = Math.max(0, next - Date.now());
  logger.info(`Next due item in ${Math.ceil(delay / 1000)}s, sending at ${new Date(next).toISOString()}`);
  exactTimer = setTimeout(async () => {
    exactTimer = null;
    await runDueChecksFireAndForget();
    scheduleExact();
  }, delay);
  if (exactTimer.unref) exactTimer.unref();
}

function kickScheduler() {
  scheduleExact().catch(() => null);
}

function startAutoScheduler() {
  if (schedulerTimer) return schedulerTimer;
  const intervalMs = getIntervalMs();
  logger.info(`Auto scheduler started (checks every ${intervalMs}ms)`);
  runDueChecksFireAndForget();
  scheduleExact().catch(() => null);
  schedulerTimer = setInterval(() => {
    runDueChecksFireAndForget();
    scheduleExact().catch(() => null);
  }, intervalMs);
  if (schedulerTimer.unref) schedulerTimer.unref();
  return schedulerTimer;
}

function stopAutoScheduler() {
  clearExactTimer();
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Auto scheduler stopped');
  }
}

module.exports = {
  runDueChecks,
  runDueChecksFireAndForget,
  startAutoScheduler,
  stopAutoScheduler,
  kickScheduler,
};
