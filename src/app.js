const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { auth } = require('./middleware/auth');
const path = require('path');

const webhookRoutes = require('./api/webhook');
const sendRoutes = require('./api/send');
const whatsappController = require('./controllers/whatsappController');
const knowledgeService = require('./services/knowledgeService');
const Knowledge = require('./models/Knowledge');
const Lead = require('./models/Lead');

const app = express();
app.set('trust proxy', 1);

app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
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

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', requireDB, async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ error: 'JWT not configured' });

    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: 'admin', role: 'admin' }, jwtSecret, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (err) {
    logger.error('login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/verify', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.use('/api/webhook', webhookRoutes);
app.use('/api/send', requireDB, sendRoutes);

app.get('/api/chats', auth, requireDB, whatsappController.getChats);
app.get('/api/chat/:id', auth, requireDB, whatsappController.getChatMessages);
app.get('/api/leads', auth, requireDB, whatsappController.getLeads);

app.patch('/api/leads/:id', auth, requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'email', 'phone', 'service', 'budget', 'timeline', 'status', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const lead = await Lead.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    logger.error('update lead error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/leads/:id', auth, requireDB, async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.put('/api/knowledge/:id', auth, requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags, category } = req.body;
    const entry = await Knowledge.findByIdAndUpdate(id,
      { title, content, tags, category },
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ error: 'Knowledge entry not found' });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/knowledge/:id', auth, requireDB, async (req, res) => {
  try {
    const entry = await Knowledge.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Knowledge entry not found' });
    res.json({ success: true });
  } catch (err) {
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

app.get('/api/stats', auth, requireDB, async (req, res) => {
  try {
    const totalChats = await require('./models/Chat').countDocuments({ isActive: true });
    const totalLeads = await Lead.countDocuments({});
    const totalKnowledge = await Knowledge.countDocuments({ isActive: true });
    const newLeads = await Lead.countDocuments({ status: 'new' });
    res.json({ success: true, data: { totalChats, totalLeads, totalKnowledge, newLeads } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seed', auth, requireDB, async (req, res) => {
  try {
    const entries = [
      { title: 'Web Development Services', category: 'services', tags: ['web', 'development', 'react', 'nextjs', 'node'], content: 'We build modern web applications using React, Next.js, Node.js, and Python. Services include custom websites, web portals, e-commerce solutions, and enterprise applications. Each project follows a structured process: requirement gathering, UI/UX design, development, testing, and deployment.' },
      { title: 'Mobile App Development', category: 'services', tags: ['mobile', 'react native', 'flutter', 'ios', 'android'], content: 'We develop cross-platform and native mobile apps using React Native and Flutter. Services include iOS and Android app development, app maintenance, and app store submission assistance.' },
      { title: 'AI Automation Services', category: 'services', tags: ['ai', 'automation', 'chatbot', 'rag', 'llm'], content: 'We provide AI automation solutions including custom chatbots, RAG systems, AI agents, workflow automation, and LLM integration. Our AI solutions help businesses automate customer support, lead generation, and internal processes.' },
      { title: 'UI/UX Design', category: 'services', tags: ['design', 'ui', 'ux', 'figma', 'prototype'], content: 'We offer professional UI/UX design services including wireframing, prototyping, user research, and visual design. We use Figma for collaborative design and create modern, user-friendly interfaces.' },
      { title: 'SaaS Development', category: 'services', tags: ['saas', 'cloud', 'api', 'full-stack'], content: 'We build scalable SaaS platforms from idea to launch. Services include full-stack development, multi-tenant architecture, payment integration, API development, and cloud deployment on AWS/GCP/Azure.' },
      { title: 'How We Work', category: 'process', tags: ['process', 'workflow', 'timeline', 'project'], content: 'Our process: 1) Discovery call to understand requirements, 2) Proposal and planning, 3) Design phase with wireframes, 4) Development in sprints, 5) Testing and QA, 6) Deployment and handover. Typical timeline: Websites 2-4 weeks, Mobile apps 4-8 weeks, AI solutions 3-6 weeks.' },
      { title: 'Contact Information', category: 'business', tags: ['contact', 'owner', 'mian', 'khizar'], content: 'Mian Khizar is the owner and lead developer. For direct inquiries, you can request to speak with Mian by saying "human" or "Mian" in the chat. Business hours are Monday to Saturday, 10 AM to 8 PM.' },
      { title: 'Why Choose Us', category: 'business', tags: ['why us', 'benefits', 'quality', 'support'], content: 'Clients choose us for: 1) End-to-end service from design to deployment, 2) Modern tech stack (React, Node.js, AI), 3) Affordable pricing with no hidden costs, 4) Fast turnaround times, 5) Post-deployment support and maintenance, 6) Clear communication throughout the project.' },
    ];

    for (const entry of entries) {
      const existing = await Knowledge.findOne({ title: entry.title });
      if (!existing) {
        await Knowledge.create(entry);
      }
    }

    res.json({ success: true, message: 'Knowledge base seeded with business information' });
  } catch (err) {
    logger.error('seed error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
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
