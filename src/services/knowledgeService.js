const Knowledge = require('../models/Knowledge');
const logger = require('../utils/logger');

async function searchKnowledge(query, userId = null, limit = 5) {
  try {
    if (!query || query.trim().length === 0) return [];

    const searchQuery = {
      isActive: true,
      $text: { $search: query },
    };
    if (userId) searchQuery.userId = userId;

    const results = await Knowledge.find(
      searchQuery,
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();

    return results;
  } catch (err) {
    if (err.code === 27) {
      logger.warn('Text index not found, falling back to regex search');
      return await fallbackSearch(query, userId, limit);
    }
    logger.error('searchKnowledge error:', err.message);
    return [];
  }
}

async function fallbackSearch(query, userId = null, limit = 5) {
  try {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const filter = {
      isActive: true,
      $or: [
        { title: regex },
        { content: regex },
        { tags: regex },
      ],
    };
    if (userId) filter.userId = userId;

    return await Knowledge.find(filter).limit(limit).lean();
  } catch (err) {
    logger.error('fallbackSearch error:', err.message);
    return [];
  }
}

async function createKnowledgeEntry({ title, content, tags = [], category = 'general', userId = null }) {
  try {
    const entry = await Knowledge.create({ title, content, tags, category, userId });
    logger.info('Knowledge entry created:', { title });
    return entry;
  } catch (err) {
    logger.error('createKnowledgeEntry error:', err.message);
    throw err;
  }
}

async function getAllKnowledge(userId = null) {
  try {
    const filter = { isActive: true };
    if (userId) filter.userId = userId;
    return await Knowledge.find(filter).sort({ createdAt: -1 }).lean();
  } catch (err) {
    logger.error('getAllKnowledge error:', err.message);
    return [];
  }
}

module.exports = { searchKnowledge, createKnowledgeEntry, getAllKnowledge };
