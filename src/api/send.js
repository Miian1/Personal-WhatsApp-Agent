const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

router.post('/', auth, async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number (to) and message are required' });
    }

    const phone = to.replace(/[^0-9]/g, '');
    if (phone.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const result = await whatsappService.sendTextMessage(phone, message);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('send message error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
