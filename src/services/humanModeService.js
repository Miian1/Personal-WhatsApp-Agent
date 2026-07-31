const Chat = require('../models/Chat');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

const HANDOFF_KEYWORDS = [
  'human', 'agent', 'owner', 'mian', 'support',
  'talk to human', 'talk to a human', 'real person',
  'speak to human', 'speak to a human', 'live agent',
  'customer support', 'help desk', 'contact mian',
];

const RESTORE_KEYWORDS = [
  'back to ai', 'back to bot', 'ai mode', 'bot mode',
  'stop human mode', 'restore ai', 'turn ai back on',
  'automated again', 'back to aris', 'continue with ai',
];

function normalize(text) {
  return (text || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function matchesAny(text, keywords) {
  const normalized = normalize(text);
  if (!normalized) return false;
  return keywords.some(keyword => {
    if (normalized === keyword) return true;
    if (normalized.startsWith(keyword + ' ') || normalized.startsWith(keyword + ',')) return true;
    if (normalized.includes(' ' + keyword + ' ')) return true;
    if (normalized.includes(keyword + '?') || normalized.includes(keyword + '!')) return true;
    return false;
  });
}

function isHandoffRequest(text) {
  return matchesAny(text, HANDOFF_KEYWORDS);
}

function isRestoreRequest(text) {
  return matchesAny(text, RESTORE_KEYWORDS);
}

async function getHumanMode(chatId) {
  const chat = await Chat.findById(chatId);
  return chat ? chat.humanMode : false;
}

async function enableHumanMode(chatId, phone) {
  await Chat.findByIdAndUpdate(chatId, { humanMode: true });
  logger.info('Human mode ENABLED:', { phone, chatId });
  return true;
}

async function disableHumanMode(chatId, phone) {
  await Chat.findByIdAndUpdate(chatId, { humanMode: false });
  logger.info('Human mode DISABLED:', { phone, chatId });
  return true;
}

const HANDOFF_CONFIRMATION =
  'You are now connected with Mian Khizar. He will respond to you shortly. ' +
  'Please wait while he reviews your messages. If you need to return to the AI assistant, just say "back to ai".';

const RESTORE_CONFIRMATION =
  'AI mode has been restored. Aris is back and ready to help you! ' +
  'If you need Mian directly, just say "human".';

module.exports = {
  isHandoffRequest,
  isRestoreRequest,
  getHumanMode,
  enableHumanMode,
  disableHumanMode,
  HANDOFF_CONFIRMATION,
  RESTORE_CONFIRMATION,
};
