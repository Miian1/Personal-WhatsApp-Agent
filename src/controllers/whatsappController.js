const mongoose = require('mongoose');
const connectDB = require('../config/db');
const whatsappService = require('../services/whatsappService');
const memoryService = require('../services/memoryService');
const humanModeService = require('../services/humanModeService');
const aiController = require('./aiController');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');

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

          if (text && humanModeService.isRestoreRequest(text)) {
            await humanModeService.disableHumanMode(chat._id, phone);
            await memoryService.saveMessage(chat._id, 'assistant', humanModeService.RESTORE_CONFIRMATION);
            await whatsappService.sendTextMessage(phone, humanModeService.RESTORE_CONFIRMATION);
            continue;
          }

          if (text && humanModeService.isHandoffRequest(text)) {
            await humanModeService.enableHumanMode(chat._id, phone);
            await memoryService.saveMessage(chat._id, 'assistant', humanModeService.HANDOFF_CONFIRMATION);
            await whatsappService.sendTextMessage(phone, humanModeService.HANDOFF_CONFIRMATION);
            continue;
          }

          if (chat.humanMode) {
            logger.info('Skipped AI reply - chat is in human mode:', { phone, chatId: chat._id });
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

async function getChats(req, res) {
  try {
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
    if (enabled === false) {
      await humanModeService.disableHumanMode(chatId, null);
    } else {
      await humanModeService.enableHumanMode(chatId, null);
    }
    res.json({ success: true, message: `Human mode ${enabled === false ? 'disabled' : 'enabled'}` });
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
