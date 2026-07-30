const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  category: {
    type: String,
    trim: true,
    default: 'general',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

knowledgeSchema.index({ title: 'text', content: 'text', tags: 'text' });
knowledgeSchema.index({ userId: 1 });
knowledgeSchema.index({ category: 1 });

module.exports = mongoose.models.Knowledge || mongoose.model('Knowledge', knowledgeSchema);
