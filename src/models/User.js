const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  businessName: {
    type: String,
    trim: true,
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'enterprise'],
    default: 'free',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  whatsappPhoneNumberId: {
    type: String,
  },
  whatsappAccessToken: {
    type: String,
  },
}, {
  timestamps: true,
});

userSchema.index({ email: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
