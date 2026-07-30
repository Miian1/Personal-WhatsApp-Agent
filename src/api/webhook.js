const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const logger = require('../utils/logger');

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    logger.error('WHATSAPP_VERIFY_TOKEN is not configured');
    return res.status(500).send('Webhook not configured');
  }

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', { mode, token });
  return res.status(403).send('Verification failed');
});

router.post('/', whatsappController.handleIncomingMessage);

module.exports = router;
