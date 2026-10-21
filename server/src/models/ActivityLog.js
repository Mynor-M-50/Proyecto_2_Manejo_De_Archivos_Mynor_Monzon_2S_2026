const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    resourceType: { type: String, enum: ['file', 'folder', 'user'], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    resourceName: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'activity_logs',
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false,
  }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
