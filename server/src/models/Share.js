const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWithId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resourceType: { type: String, enum: ['file', 'folder'], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    permission: { type: String, enum: ['read', 'comment', 'edit'], required: true },
  },
  { collection: 'shares', timestamps: true }
);

module.exports = mongoose.model('Share', shareSchema);
