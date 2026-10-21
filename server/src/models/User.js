const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    active: { type: Boolean, default: true },
    storageUsed: { type: Number, default: 0 },
  },
  { collection: 'users', timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
