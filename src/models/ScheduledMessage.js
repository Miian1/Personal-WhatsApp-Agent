const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
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

scheduledMessageSchema.index({ status: 1, scheduledAt: 1 });
scheduledMessageSchema.index({ phone: 1 });

module.exports = mongoose.models.ScheduledMessage || mongoose.model('ScheduledMessage', scheduledMessageSchema);
