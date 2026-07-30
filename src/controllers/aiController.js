const groqService = require('../services/groqService');
const memoryService = require('../services/memoryService');
const knowledgeService = require('../services/knowledgeService');
const whatsappService = require('../services/whatsappService');
const Lead = require('../models/Lead');
const { getSystemPrompt } = require('../prompts/systemPrompt');
const logger = require('../utils/logger');

async function processMessage(chat, phone, userMessage) {
  try {
    const history = await memoryService.getChatHistory(chat._id, 20);
    const knowledge = await knowledgeService.searchKnowledge(userMessage, chat.userId);

    const systemPrompt = getSystemPrompt();

    const aiResponse = await groqService.generateResponse({
      message: userMessage,
      history,
      knowledge,
      systemPrompt,
    });

    await memoryService.saveMessage(chat._id, 'assistant', aiResponse);
    await whatsappService.sendTextMessage(phone, aiResponse);

    checkAndSaveLead(chat, userMessage, aiResponse);
  } catch (err) {
    logger.error('processMessage error:', err.message);
    try {
      await whatsappService.sendTextMessage(
        phone,
        'I apologize, but I encountered an error processing your request. Please try again or ask to speak with Mian Khizar for assistance.'
      );
    } catch (sendErr) {
      logger.error('Failed to send error message:', sendErr.message);
    }
  }
}

async function checkAndSaveLead(chat, userMessage, aiResponse) {
  try {
    const leadKeywords = ['interested', 'want to', 'need', 'looking for', 'quote', 'project', 'build', 'develop', 'hire', 'cost', 'price'];
    const lower = userMessage.toLowerCase();
    const isLead = leadKeywords.some(keyword => lower.includes(keyword));

    if (isLead) {
      const existingLead = await Lead.findOne({ phone: chat.phone, status: { $ne: 'lost' } });
      if (!existingLead) {
        await Lead.create({
          phone: chat.phone,
          name: chat.customerName || '',
          source: 'whatsapp',
          status: 'new',
          notes: `Lead captured from chat. User message: ${userMessage.substring(0, 200)}`,
        });
        logger.info('New lead captured:', { phone: chat.phone });
      }
    }
  } catch (err) {
    logger.error('checkAndSaveLead error:', err.message);
  }
}

module.exports = { processMessage };
