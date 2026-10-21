const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    name: { type: String, required: true, trim: true },
    ext: { type: String, enum: ['txt', 'md'], required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    // Id del documento en fs.files (GridFS), donde esta el contenido real
    gridfsId: { type: mongoose.Schema.Types.ObjectId, required: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: 'files', timestamps: true }
);

module.exports = mongoose.model('File', fileSchema);
