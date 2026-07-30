const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  customerName: {
    type: String,
    trim: true,
    default: '',
  },
  lastMessage: {
    type: String,
    default: '',
  },
  humanMode: {
    type: Boolean,
    default: false,
  },
  unreadCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

chatSchema.index({ phone: 1 });
chatSchema.index({ userId: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
