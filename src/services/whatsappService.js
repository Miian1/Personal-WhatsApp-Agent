const logger = require('../utils/logger');

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v21.0';

function getHeaders() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not defined');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function getPhoneNumberId() {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not defined');
  return id;
}

async function sendTextMessage(to, text) {
  try {
    const url = `${WHATSAPP_API_BASE}/${getPhoneNumberId()}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    };

    logger.debug('Sending WhatsApp text:', { to, textLength: text.length });

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      logger.error('WhatsApp API error:', response.status, data);
      throw new Error(`WhatsApp API error: ${data.error?.message || response.status}`);
    }

    return data;
  } catch (err) {
    logger.error('sendTextMessage error:', err.message);
    throw err;
  }
}

async function sendTemplate(to, templateName, parameters = []) {
  try {
    const url = `${WHATSAPP_API_BASE}/${getPhoneNumberId()}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: parameters.length > 0 ? [{
          type: 'body',
          parameters: parameters.map(p => ({ type: 'text', text: p })),
        }] : [],
      },
    };

    logger.debug('Sending WhatsApp template:', { to, templateName });

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      logger.error('WhatsApp template error:', response.status, data);
      throw new Error(`WhatsApp template error: ${data.error?.message || response.status}`);
    }

    return data;
  } catch (err) {
    logger.error('sendTemplate error:', err.message);
    throw err;
  }
}

async function markAsRead(messageId) {
  try {
    const url = `${WHATSAPP_API_BASE}/${getPhoneNumberId()}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error('markAsRead error:', err.message);
  }
}

async function downloadMedia(mediaId) {
  try {
    const mediaUrl = `${WHATSAPP_API_BASE}/${mediaId}`;
    const response = await fetch(mediaUrl, { headers: getHeaders() });
    const data = await response.json();

    if (data.url) {
      const downloadResponse = await fetch(data.url, { headers: getHeaders() });
      const buffer = await downloadResponse.arrayBuffer();
      return { mimeType: data.mime_type, buffer, filename: data.filename };
    }
    return null;
  } catch (err) {
    logger.error('downloadMedia error:', err.message);
    return null;
  }
}

module.exports = { sendTextMessage, sendTemplate, markAsRead, downloadMedia };
