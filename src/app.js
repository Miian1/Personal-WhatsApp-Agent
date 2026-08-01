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
const reminderService = require('./services/reminderService');
const campaignService = require('./services/campaignService');
const scheduledMessageService = require('./services/scheduledMessageService');
const { startAutoScheduler, kickScheduler } = require('./services/schedulerService');
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
    const allowed = ['name', 'email', 'phone', 'service', 'requirements', 'budget', 'timeline', 'status', 'notes'];
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
app.post('/api/chat/:id/reply', auth, requireDB, whatsappController.sendManualReply);

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
    const Reminder = require('./models/Reminder');
    const totalChats = await require('./models/Chat').countDocuments({ isActive: true });
    const totalLeads = await Lead.countDocuments({});
    const totalKnowledge = await Knowledge.countDocuments({ isActive: true });
    const newLeads = await Lead.countDocuments({ status: 'new' });
    const pendingReminders = await Reminder.countDocuments({ status: 'pending' });
    res.json({ success: true, data: { totalChats, totalLeads, totalKnowledge, newLeads, pendingReminders } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reminders
app.get('/api/reminders', auth, requireDB, async (req, res) => {
  try {
    const reminders = await reminderService.getReminders(req.query);
    res.json({ success: true, data: reminders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reminders', auth, requireDB, async (req, res) => {
  try {
    const { title, description, phone, scheduledAt, type, leadId } = req.body;
    if (!title || !phone || !scheduledAt) return res.status(400).json({ error: 'Title, phone, and scheduledAt are required' });
    const reminder = await reminderService.createReminder({ title, description, phone, scheduledAt: new Date(scheduledAt), type: type || 'custom', leadId });
    kickScheduler();
    res.json({ success: true, data: reminder });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/reminders/:id', auth, requireDB, async (req, res) => {
  try {
    const reminder = await reminderService.updateReminder(req.params.id, req.body);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    kickScheduler();
    res.json({ success: true, data: reminder });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/reminders/:id', auth, requireDB, async (req, res) => {
  try {
    await reminderService.deleteReminder(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Campaigns / Broadcasts
app.get('/api/campaigns', auth, requireDB, async (req, res) => {
  try {
    const campaigns = await campaignService.getCampaigns(req.query);
    res.json({ success: true, data: campaigns });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/campaigns', auth, requireDB, async (req, res) => {
  try {
    const { name, message, recipients, type, scheduledAt } = req.body;
    if (!name || !message || !recipients || !recipients.length) return res.status(400).json({ error: 'Name, message, and recipients are required' });
    const campaign = await campaignService.createCampaign({
      name, message, recipients,
      type: type || 'immediate',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });
    kickScheduler();
    res.json({ success: true, data: campaign });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/campaigns/:id/send', auth, requireDB, async (req, res) => {
  try {
    const result = await campaignService.sendCampaign(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/campaigns/:id', auth, requireDB, async (req, res) => {
  try {
    await campaignService.deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Scheduled Messages
app.get('/api/scheduled-messages', auth, requireDB, async (req, res) => {
  try {
    const scheduled = await scheduledMessageService.getScheduledMessages(req.query);
    res.json({ success: true, data: scheduled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/scheduled-messages', auth, requireDB, async (req, res) => {
  try {
    const { title, phone, message, scheduledAt } = req.body;
    if (!phone || !message || !scheduledAt) return res.status(400).json({ error: 'Phone, message, and scheduledAt are required' });
    const scheduled = await scheduledMessageService.createScheduledMessage({
      title: title || '',
      phone,
      message,
      scheduledAt: new Date(scheduledAt),
    });
    kickScheduler();
    res.json({ success: true, data: scheduled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/scheduled-messages/:id', auth, requireDB, async (req, res) => {
  try {
    const scheduled = await scheduledMessageService.updateScheduledMessage(req.params.id, req.body);
    if (!scheduled) return res.status(404).json({ error: 'Scheduled message not found' });
    kickScheduler();
    res.json({ success: true, data: scheduled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/scheduled-messages/:id', auth, requireDB, async (req, res) => {
  try {
    await scheduledMessageService.deleteScheduledMessage(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/scheduled-messages/:id/send', auth, requireDB, async (req, res) => {
  try {
    const result = await scheduledMessageService.sendScheduledMessage(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cron / Scheduler - can be called by an external service (cron-job.org etc)
// Reminders/campaigns are ALSO checked opportunistically via schedulerService on webhooks and admin views.
// In long-running Node environments (local/dev), an internal timer auto-sends due items without external cron.
app.get('/api/cron/check', async (req, res) => {
  try {
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const secret = req.query.secret || req.headers['x-cron-secret'];
    const secretOk = process.env.CRON_SECRET ? secret === process.env.CRON_SECRET : true;
    if (!isVercelCron && !secretOk) {
      return res.status(401).json({ error: 'Invalid secret' });
    }
    await connectDB();
    const { runDueChecks } = require('./services/schedulerService');
    const { reminders, campaigns } = await runDueChecks();
    res.json({ success: true, data: { reminders, campaigns } });
  } catch (err) {
    logger.error('Cron check error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger from the admin dashboard (authenticated) - useful for testing
app.get('/api/cron/run-now', auth, requireDB, async (req, res) => {
  try {
    const { runDueChecks } = require('./services/schedulerService');
    const { reminders, campaigns } = await runDueChecks();
    res.json({ success: true, data: { reminders, campaigns } });
  } catch (err) {
    logger.error('Run-now error:', err.message);
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

// Start the internal auto-scheduler for long-running Node processes (local/dev).
// On Vercel (VERCEL=1) serverless does not keep timers alive; use the /api/cron/check endpoint there.
if (process.env.VERCEL !== '1') {
  startAutoScheduler();
}

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
