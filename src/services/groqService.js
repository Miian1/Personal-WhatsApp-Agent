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
        .map(k => `[${k.title}]: ${k.content}`)
        .join('\n\n');
      messages.push({
        role: 'system',
        content: `Here is relevant knowledge for context:\n\n${knowledgeContext}`,
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
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 0.9,
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
