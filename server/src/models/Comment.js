const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { collection: 'comments', timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);
