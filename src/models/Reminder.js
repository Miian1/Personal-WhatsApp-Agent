const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  scheduledAt: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
  },
  type: {
    type: String,
    enum: ['follow_up', 'meeting', 'call_back', 'custom'],
    default: 'custom',
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },
  createdBy: {
    type: String,
    default: 'admin',
  },
  sentAt: {
    type: Date,
    default: null,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  lastError: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

reminderSchema.index({ status: 1, scheduledAt: 1 });
reminderSchema.index({ phone: 1 });

module.exports = mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);
