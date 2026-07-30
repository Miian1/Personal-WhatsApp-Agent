const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { auth } = require('./middleware/auth');

const webhookRoutes = require('./api/webhook');
const sendRoutes = require('./api/send');
const whatsappController = require('./controllers/whatsappController');
const knowledgeService = require('./services/knowledgeService');

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

async function requireDB(req, res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    logger.error('DB connection error:', err.message);
    res.status(500).json({ error: 'Database connection failed' });
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/webhook', webhookRoutes);
app.use('/api/send', requireDB, sendRoutes);

app.get('/api/chats', auth, requireDB, whatsappController.getChats);
app.get('/api/chat/:id', auth, requireDB, whatsappController.getChatMessages);
app.get('/api/leads', auth, requireDB, whatsappController.getLeads);

app.post('/api/human-mode', auth, requireDB, whatsappController.setHumanMode);

app.post('/api/knowledge', auth, requireDB, async (req, res) => {
  try {
    const { title, content, tags, category } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const userId = req.user?.id || null;
    const entry = await knowledgeService.createKnowledgeEntry({
      title,
      content,
      tags: tags || [],
      category: category || 'general',
      userId,
    });
    res.json({ success: true, data: entry });
  } catch (err) {
    logger.error('create knowledge error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/knowledge', auth, requireDB, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const knowledge = await knowledgeService.getAllKnowledge(userId);
    res.json({ success: true, data: knowledge });
  } catch (err) {
    logger.error('get knowledge error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

async function startServer() {
  try {
    await connectDB();
    logger.info('MongoDB connected');

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
