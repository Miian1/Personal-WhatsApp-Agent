const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  name: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  service: {
    type: String,
    trim: true,
  },
  requirements: {
    type: String,
    trim: true,
    default: '',
  },
  budget: {
    type: String,
    trim: true,
  },
  timeline: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
    default: 'new',
  },
  notes: {
    type: String,
    trim: true,
  },
  source: {
    type: String,
    default: 'whatsapp',
  },
}, {
  timestamps: true,
});

leadSchema.index({ phone: 1 });
leadSchema.index({ userId: 1 });
leadSchema.index({ status: 1 });

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
