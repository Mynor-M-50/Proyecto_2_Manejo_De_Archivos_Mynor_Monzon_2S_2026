const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    name: { type: String, required: true, trim: true },
    ancestors: [{ type: mongoose.Schema.Types.ObjectId }],
    deletedAt: { type: Date, default: null },
  },
  { collection: 'folders', timestamps: true }
);

module.exports = mongoose.model('Folder', folderSchema);
