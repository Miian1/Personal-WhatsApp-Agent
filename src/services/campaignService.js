const Campaign = require('../models/Campaign');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

async function createCampaign(data) {
  const totalCount = data.recipients ? data.recipients.length : 0;
  const campaign = await Campaign.create({ ...data, totalCount });
  logger.info('Campaign created:', { name: campaign.name, recipients: totalCount });
  return campaign;
}

async function getCampaigns(filter = {}) {
  const query = {};
  if (filter.status) query.status = filter.status;
  return await Campaign.find(query).sort({ createdAt: -1 }).lean();
}

async function updateCampaign(id, updates) {
  const allowed = ['name', 'message', 'recipients', 'type', 'scheduledAt', 'status'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }
  if (data.recipients) data.totalCount = data.recipients.length;
  return await Campaign.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function deleteCampaign(id) {
  return await Campaign.findByIdAndDelete(id);
}

async function sendCampaign(id) {
  try {
    const campaign = await Campaign.findById(id);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status === 'sent') throw new Error('Campaign already sent');

    campaign.status = 'sending';
    await campaign.save();

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < campaign.recipients.length; i++) {
      const recipient = campaign.recipients[i];
      try {
        const personalizedMsg = campaign.message.replace(/\{name\}/g, recipient.name || 'there');
        await whatsappService.sendTextMessage(recipient.phone, personalizedMsg);
        campaign.recipients[i].status = 'sent';
        campaign.recipients[i].sentAt = new Date();
        sent++;
      } catch (err) {
        campaign.recipients[i].status = 'failed';
        campaign.recipients[i].error = err.message;
        failed++;
        logger.error('Campaign send failed for:', { phone: recipient.phone, error: err.message });
      }
    }

    campaign.sentCount = sent;
    campaign.failedCount = failed;
    campaign.status = 'sent';
    await campaign.save();

    logger.info('Campaign sent:', { name: campaign.name, sent, failed });
    return { sent, failed, total: campaign.totalCount };
  } catch (err) {
    logger.error('sendCampaign error:', err.message);
    throw err;
  }
}

async function checkAndSendScheduledCampaigns() {
  try {
    const now = new Date();
    const due = await Campaign.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
    });

    const results = [];
    for (const campaign of due) {
      const result = await sendCampaign(campaign._id);
      results.push({ name: campaign.name, ...result });
    }
    return results;
  } catch (err) {
    logger.error('checkAndSendScheduledCampaigns error:', err.message);
    throw err;
  }
}

module.exports = {
  createCampaign, getCampaigns, updateCampaign, deleteCampaign,
  sendCampaign, checkAndSendScheduledCampaigns,
};
