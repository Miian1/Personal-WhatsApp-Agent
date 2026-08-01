const Lead = require('../models/Lead');
const logger = require('../utils/logger');

const LEAD_DATA_START = '[LEAD_DATA]';
const LEAD_DATA_END = '[/LEAD_DATA]';

const COLLECT_FIELDS = ['name', 'email', 'service', 'requirements', 'budget', 'timeline'];

function stripLeadDataMarker(text) {
  if (!text) return text;
  const start = text.indexOf(LEAD_DATA_START);
  if (start === -1) return text;
  const end = text.indexOf(LEAD_DATA_END, start);
  if (end === -1) return text.slice(0, start).trim();
  const cleaned = (text.slice(0, start) + text.slice(end + LEAD_DATA_END.length)).trim();
  return cleaned;
}

function parseLeadData(text) {
  if (!text) return null;
  const start = text.indexOf(LEAD_DATA_START);
  if (start === -1) return null;
  const end = text.indexOf(LEAD_DATA_END, start);
  if (end === -1) return null;

  const raw = text.slice(start + LEAD_DATA_START.length, end).trim();
  try {
    const data = JSON.parse(raw);
    return typeof data === 'object' && data ? data : null;
  } catch (err) {
    logger.warn('Failed to parse lead data JSON:', raw);
    return null;
  }
}

function getMissingFields(lead) {
  const missing = [];
  for (const field of COLLECT_FIELDS) {
    if (!lead[field]) missing.push(field);
  }
  return missing;
}

function buildLeadContext(lead) {
  const known = {};
  for (const field of COLLECT_FIELDS) {
    if (lead[field]) known[field] = lead[field];
  }
  const missing = getMissingFields(lead);
  return { known, missing };
}

function mergeLeadData(lead, data) {
  if (!data || !lead) return lead;
  let updated = false;

  for (const field of COLLECT_FIELDS) {
    const value = typeof data[field] === 'string' ? data[field].trim() : '';
    if (value && value.toLowerCase() !== 'unknown' && value.toLowerCase() !== 'n/a' && value !== lead[field]) {
      lead[field] = value;
      updated = true;
    }
  }

  if (updated) {
    if (lead.status === 'new') lead.status = 'qualified';
    return lead.save().then(saved => {
      logger.info('Lead updated from chat:', { phone: lead.phone, data });
      return saved;
    });
  }
  return lead;
}

async function findOrCreateLead(phone, customerName = '') {
  let lead = await Lead.findOne({ phone, status: { $ne: 'lost' } });
  if (!lead) {
    lead = await Lead.create({ phone, name: customerName || '', source: 'whatsapp', status: 'new' });
    logger.info('New lead created:', { phone });
  }
  return lead;
}

async function updateLeadFromMessage(phone, customerName, aiResponse) {
  try {
    const lead = await findOrCreateLead(phone, customerName);
    const data = parseLeadData(aiResponse);
    if (data) {
      await mergeLeadData(lead, data);
    }
    return lead;
  } catch (err) {
    logger.error('updateLeadFromMessage error:', err.message);
    return null;
  }
}

module.exports = {
  COLLECT_FIELDS,
  LEAD_DATA_START,
  LEAD_DATA_END,
  stripLeadDataMarker,
  parseLeadData,
  getMissingFields,
  buildLeadContext,
  mergeLeadData,
  findOrCreateLead,
  updateLeadFromMessage,
};
