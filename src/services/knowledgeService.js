const mongoose = require('mongoose');
const Knowledge = require('../models/Knowledge');
const logger = require('../utils/logger');

function validId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
  'i', 'you', 'we', 'they', 'he', 'she', 'it', 'me', 'my', 'your',
  'what', 'how', 'why', 'when', 'where', 'who', 'which', 'please',
  'can', 'could', 'would', 'will', 'for', 'with', 'and', 'or', 'but',
  'to', 'from', 'of', 'in', 'on', 'at', 'about', 'want', 'need', 'tell',
  'know', 'have', 'has', 'been', 'being', 'some', 'any', 'all', 'this', 'that',
]);

function extractKeywords(query) {
  const words = (query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  return [...new Set(words.filter(w => w.length > 2 && !STOP_WORDS.has(w)))];
}

async function searchKnowledge(query, userId = null, limit = 5) {
  try {
    if (!query || query.trim().length === 0) return [];
    const uid = validId(userId);
    const filterBase = { isActive: true };
    if (uid) filterBase.userId = uid;

    // Hybrid retrieval: try text search first, then merge with keyword scores
    let textResults = [];
    try {
      textResults = await Knowledge.find(
        { ...filterBase, $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean();
    } catch (err) {
      if (err.code !== 27) logger.error('text search error:', err.message);
      textResults = [];
    }

    const keywordResults = await keywordSearch(query, uid, limit);

    // Merge by id, keeping highest relevance ordering
    const seen = new Set();
    const merged = [];
    for (const item of [...textResults, ...keywordResults]) {
      if (seen.has(String(item._id))) continue;
      seen.add(String(item._id));
      merged.push(item);
    }

    return merged.slice(0, limit);
  } catch (err) {
    logger.error('searchKnowledge error:', err.message);
    return [];
  }
}

async function keywordSearch(query, userId, limit) {
  try {
    const keywords = extractKeywords(query);
    if (keywords.length === 0) return [];

    const filter = {
      isActive: true,
      $or: keywords.map(kw => ({
        $or: [
          { title: new RegExp(kw, 'i') },
          { content: new RegExp(kw, 'i') },
          { tags: new RegExp(kw, 'i') },
        ],
      })),
    };
    if (userId) filter.userId = userId;

    const all = await Knowledge.find(filter).lean();
    if (all.length === 0) return [];

    const scored = all.map(entry => {
      let score = 0;
      const title = (entry.title || '').toLowerCase();
      const content = (entry.content || '').toLowerCase();
      const tags = (entry.tags || []).map(t => t.toLowerCase());
      for (const kw of keywords) {
        if (title.includes(kw)) score += 5;
        if (tags.includes(kw)) score += 4;
        if (content.includes(kw)) score += 2;
      }
      return { ...entry, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter(e => e.score > 0).slice(0, limit);
  } catch (err) {
    logger.error('keywordSearch error:', err.message);
    return [];
  }
}

async function fallbackSearch(query, userId = null, limit = 5) {
  return keywordSearch(query, validId(userId), limit);
}

async function createKnowledgeEntry({ title, content, tags = [], category = 'general', userId = null }) {
  try {
    const entry = await Knowledge.create({ title, content, tags, category, userId: validId(userId) });
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
    const uid = validId(userId);
    if (uid) filter.userId = uid;
    return await Knowledge.find(filter).sort({ createdAt: -1 }).lean();
  } catch (err) {
    logger.error('getAllKnowledge error:', err.message);
    return [];
  }
}

module.exports = { searchKnowledge, createKnowledgeEntry, getAllKnowledge };
