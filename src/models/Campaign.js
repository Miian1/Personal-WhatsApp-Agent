const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  recipients: [{
    phone: { type: String, required: true },
    name: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    sentAt: { type: Date, default: null },
    error: { type: String, default: '' },
  }],
  type: {
    type: String,
    enum: ['immediate', 'scheduled'],
    default: 'immediate',
  },
  scheduledAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'cancelled'],
    default: 'draft',
  },
  sentCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
  failedCount: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: String,
    default: 'admin',
  },
}, {
  timestamps: true,
});

campaignSchema.index({ status: 1 });
campaignSchema.index({ scheduledAt: 1 });

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
