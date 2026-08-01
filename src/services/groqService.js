const logger = require('../utils/logger');

async function generateResponse({ message, history, knowledge, systemPrompt }) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not defined');

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    if (knowledge && knowledge.length > 0) {
      const knowledgeContext = knowledge
        .map(k => `<knowledge_entry>\n  <title>${k.title}</title>\n  <category>${k.category || 'general'}</category>\n  <content>${k.content}</content>\n</knowledge_entry>`)
        .join('\n\n');

      messages.push({
        role: 'system',
        content: `Knowledge Base Context\n===============\nThe following entries are the ONLY official facts you may use to answer business-related questions. Answer strictly from these entries.\n\n${knowledgeContext}\n\n===============\nINSTRUCTIONS:\n- Base your answer ONLY on the above knowledge entries.\n- If the user's question is not covered above, say: "I don't have that information right now. Let me connect you with Mian Khizar for the details." or ask a follow-up question.\n- Do not invent, guess, or add any business facts that are not in these entries.`,
      });
    } else {
      messages.push({
        role: 'system',
        content: `No knowledge base entries matched this question. IMPORTANT: If the user asks about business facts, services, prices, or policies, do NOT guess. Reply: "I don't have that information right now. Let me connect you with Mian Khizar for the details." You may still have a brief, helpful general conversation, but never state unverified business details.`,
      });
    }

    const recentHistory = (history || []).slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    messages.push({ role: 'user', content: message });

    logger.debug('Sending to Groq:', JSON.stringify({ messageCount: messages.length }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.3,
        max_tokens: 1024,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('Empty response from Groq');
    }

    return aiResponse.trim();
  } catch (err) {
    logger.error('generateResponse error:', err.message);
    throw err;
  }
}

module.exports = { generateResponse };
