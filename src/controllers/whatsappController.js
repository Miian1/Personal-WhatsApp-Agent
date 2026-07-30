const connectDB = require('../config/db');
const whatsappService = require('../services/whatsappService');
const memoryService = require('../services/memoryService');
const aiController = require('./aiController');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');

const HUMAN_HANDOFF_KEYWORDS = ['human', 'agent', 'owner', 'mian', 'support', 'talk to human', 'real person'];

async function handleIncomingMessage(req, res) {
  try {
    await connectDB();
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.status(400).json({ error: 'Invalid webhook object' });
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value.messages || [];
        const metadata = value.metadata || {};

        for (const msg of messages) {
          const phone = msg.from;
          const messageId = msg.id;
          const msgType = msg.type || 'unknown';

          await whatsappService.markAsRead(messageId);

          let text = '';
          let messageType = 'text';
          let mediaUrl = null;

          if (msgType === 'text' && msg.text) {
            text = msg.text.body || '';
          } else if (msgType === 'audio') {
            messageType = 'audio';
            text = '[Voice message received]';
            if (msg.audio?.id) {
              const media = await whatsappService.downloadMedia(msg.audio.id);
              mediaUrl = msg.audio.id;
            }
          } else if (msgType === 'image') {
            messageType = 'image';
            text = '[Image received]';
            if (msg.image?.id) {
              const media = await whatsappService.downloadMedia(msg.image.id);
              mediaUrl = msg.image.id;
            }
          } else if (msgType === 'video') {
            messageType = 'video';
            text = '[Video received]';
          } else if (msgType === 'document') {
            messageType = 'document';
            text = '[Document received]';
          } else {
            text = '[Unsupported message type]';
          }

          const chat = await memoryService.findOrCreateChat(phone);
          await memoryService.saveMessage(chat._id, 'user', text, messageType, mediaUrl);

          if (text && isHumanHandoffRequested(text)) {
            await memoryService.setHumanMode(chat._id, true);
            await memoryService.saveMessage(
              chat._id,
              'assistant',
              'You are now connected with Mian Khizar. He will respond to you shortly. Please wait while he reviews your messages.'
            );
            await whatsappService.sendTextMessage(
              phone,
              'You are now connected with Mian Khizar. He will respond to you shortly. Please wait while he reviews your messages.'
            );
            continue;
          }

          if (chat.humanMode) {
            continue;
          }

          await aiController.processMessage(chat, phone, text);
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error('handleIncomingMessage error:', err.message);
    res.status(200).json({ success: true });
  }
}

function isHumanHandoffRequested(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return HUMAN_HANDOFF_KEYWORDS.some(keyword => {
    if (lower === keyword) return true;
    if (lower.startsWith(keyword + ' ') || lower.startsWith(keyword + ',')) return true;
    if (lower.includes(' ' + keyword + ' ')) return true;
    return false;
  });
}

async function getChats(req, res) {
  try {
    const mongoose = require('mongoose');
    const userId = req.user?.id || null;
    const isValid = userId && mongoose.Types.ObjectId.isValid(userId);
    const chats = await memoryService.getAllChats(isValid ? userId : null);
    res.json({ success: true, data: chats });
  } catch (err) {
    logger.error('getChats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
}

async function getChatMessages(req, res) {
  try {
    const { id } = req.params;
    const messages = await memoryService.getChatHistory(id, 50);
    await memoryService.resetUnreadCount(id);
    res.json({ success: true, data: messages });
  } catch (err) {
    logger.error('getChatMessages error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

async function getLeads(req, res) {
  try {
    const mongoose = require('mongoose');
    const userId = req.user?.id || null;
    const isValid = userId && mongoose.Types.ObjectId.isValid(userId);
    const filter = {};
    if (isValid) filter.userId = userId;
    const leads = await Lead.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: leads });
  } catch (err) {
    logger.error('getLeads error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
}

async function setHumanMode(req, res) {
  try {
    const { chatId, enabled } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    await memoryService.setHumanMode(chatId, enabled !== false);
    res.json({ success: true, message: `Human mode ${enabled !== false ? 'enabled' : 'disabled'}` });
  } catch (err) {
    logger.error('setHumanMode error:', err.message);
    res.status(500).json({ error: 'Failed to update human mode' });
  }
}

module.exports = {
  handleIncomingMessage,
  getChats,
  getChatMessages,
  getLeads,
  setHumanMode,
};
