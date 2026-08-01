const knowledgeService = require('./knowledgeService');
const memoryService = require('./memoryService');
const logger = require('../utils/logger');

const MAX_CONTEXT_ENTRIES = 5;
const MAX_CONTEXT_CHARS = 3500;

function buildQueryContext(query, history) {
  const parts = [query];
  const recent = (history || []).slice(-4);
  for (const msg of recent) {
    if (msg.role === 'user' && msg.content && msg.content !== query) {
      parts.push(msg.content);
    }
  }
  return parts.join(' ');
}

async function retrieveContext(userMessage, chatId, userId) {
  try {
    const history = await memoryService.getChatHistory(chatId, 10);
    const expandedQuery = buildQueryContext(userMessage, history);

    const knowledge = await knowledgeService.searchKnowledge(expandedQuery, userId, MAX_CONTEXT_ENTRIES);
    if (!knowledge || knowledge.length === 0) return { context: '', sources: [], found: false };

    const context = buildKnowledgeContext(knowledge);
    const sources = knowledge.map(k => k.title).filter(Boolean);

    return { context, sources, found: true, entries: knowledge };
  } catch (err) {
    logger.error('retrieveContext error:', err.message);
    return { context: '', sources: [], found: false, entries: [] };
  }
}

function buildKnowledgeContext(entries) {
  let built = '';
  for (const k of entries) {
    const title = k.title || 'Untitled';
    const content = k.content || '';
    const category = k.category || 'general';
    const entryText = `[Source: ${title} | Category: ${category}]\n${content}`;
    if ((built + entryText).length > MAX_CONTEXT_CHARS) break;
    built += entryText + '\n\n';
  }
  return built.trim();
}

module.exports = { retrieveContext, buildKnowledgeContext };
