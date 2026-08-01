const groqService = require('../services/groqService');
const memoryService = require('../services/memoryService');
const ragService = require('../services/ragService');
const leadService = require('../services/leadService');
const whatsappService = require('../services/whatsappService');
const { getSystemPrompt } = require('../prompts/systemPrompt');
const logger = require('../utils/logger');

async function processMessage(chat, phone, userMessage) {
  try {
    const history = await memoryService.getChatHistory(chat._id, 20);

    // RAG retrieval: expand query with recent history, then fetch knowledge
    const { context, sources } = await ragService.retrieveContext(userMessage, chat._id, chat.userId);
    const knowledge = context
      ? [{ title: 'Retrieved Context', content: context }]
      : [];

    // Lead context: known fields + what's still missing
    const lead = await leadService.findOrCreateLead(phone, chat.customerName);
    const { known, missing } = leadService.buildLeadContext(lead);
    const leadContext = `Lead Profile Context\n===============\nKnown lead fields:\n${Object.keys(known).length ? JSON.stringify(known) : '(none yet)'}\n\nFields still missing (collect these, ONE at a time, by asking natural follow-up questions):\n${missing.length ? missing.join(', ') : '(all collected - just confirm details if they offer more)'}`;

    const systemPrompt = getSystemPrompt();

    const rawResponse = await groqService.generateResponse({
      message: userMessage,
      history,
      knowledge,
      systemPrompt,
      leadContext,
    });

    // Extract hidden lead data, persist it, then strip the marker before delivery
    const parsedLead = await leadService.updateLeadFromMessage(phone, chat.customerName, rawResponse);
    if (parsedLead) {
      const updated = await leadService.buildLeadContext(parsedLead);
      logger.debug('Lead progress:', { phone, known: updated.known, missing: updated.missing });
    }
    const aiResponse = leadService.stripLeadDataMarker(rawResponse);

    await memoryService.saveMessage(chat._id, 'assistant', aiResponse);
    await whatsappService.sendTextMessage(phone, aiResponse);

    if (sources.length) logger.debug('RAG sources used:', sources);
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

module.exports = { processMessage };
