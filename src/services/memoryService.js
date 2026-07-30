const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const logger = require('../utils/logger');

function validId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null;
}

async function findOrCreateChat(phone) {
  try {
    let chat = await Chat.findOne({ phone, isActive: true });
    if (!chat) {
      chat = await Chat.create({ phone });
      logger.info('New chat created:', { phone, chatId: chat._id });
    }
    return chat;
  } catch (err) {
    logger.error('findOrCreateChat error:', err.message);
    throw err;
  }
}

async function getChatHistory(chatId, limit = 20) {
  try {
    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return messages.reverse();
  } catch (err) {
    logger.error('getChatHistory error:', err.message);
    throw err;
  }
}

async function saveMessage(chatId, role, content, messageType = 'text', mediaUrl = null) {
  try {
    const message = await Message.create({ chatId, role, content, messageType, mediaUrl });

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: content.substring(0, 100),
      updatedAt: new Date(),
      $inc: role === 'user' ? { unreadCount: 1 } : {},
    });

    return message;
  } catch (err) {
    logger.error('saveMessage error:', err.message);
    throw err;
  }
}

async function setHumanMode(chatId, enabled = true) {
  try {
    await Chat.findByIdAndUpdate(chatId, { humanMode: enabled });
    logger.info(`Human mode ${enabled ? 'enabled' : 'disabled'} for chat:`, chatId);
  } catch (err) {
    logger.error('setHumanMode error:', err.message);
    throw err;
  }
}

async function getChatById(chatId) {
  try {
    return await Chat.findById(chatId);
  } catch (err) {
    logger.error('getChatById error:', err.message);
    throw err;
  }
}

async function getAllChats(userId = null) {
  try {
    const filter = { isActive: true };
    const uid = validId(userId);
    if (uid) filter.userId = uid;
    return await Chat.find(filter).sort({ updatedAt: -1 }).lean();
  } catch (err) {
    logger.error('getAllChats error:', err.message);
    throw err;
  }
}

async function resetUnreadCount(chatId) {
  try {
    await Chat.findByIdAndUpdate(chatId, { unreadCount: 0 });
  } catch (err) {
    logger.error('resetUnreadCount error:', err.message);
  }
}

module.exports = {
  findOrCreateChat,
  getChatHistory,
  saveMessage,
  setHumanMode,
  getChatById,
  getAllChats,
  resetUnreadCount,
};
