const Comment = require('../models/Comment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getFileWithAccess } = require('../services/access.service');
const { loadUserMap } = require('../services/share.service');
const { logActivity } = require('../services/activity.service');

const MAX_COMMENT_LENGTH = 1000;

// Datos del comentario con el nombre de su autor
function serializeComment(comment, users) {
  const author = users.get(String(comment.userId));
  return {
    id: comment._id,
    fileId: comment.fileId,
    author: { id: comment.userId, name: author ? author.name : '' },
    text: comment.text,
    createdAt: comment.createdAt,
  };
}

// Registra en el historial una operacion de comentarios (se asocia al archivo)
function logCommentAction(req, action, file, details) {
  return logActivity({
    userId: req.user.id,
    action,
    resourceType: 'file',
    resourceId: file._id,
    resourceName: file.name,
    details,
  });
}

// GET /api/files/:id/comments  (necesita al menos permiso de lectura)
const listComments = asyncHandler(async (req, res) => {
  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'read');

  const comments = await Comment.find({ fileId: file._id }).sort({ createdAt: 1 });
  const users = await loadUserMap(comments.map((c) => c.userId));
  res.json({ comments: comments.map((c) => serializeComment(c, users)) });
});

// POST /api/files/:id/comments  { text }  (necesita permiso de comentar o superior)
const createComment = asyncHandler(async (req, res) => {
  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'comment');

  const raw = (req.body || {}).text;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) {
    throw new AppError('El comentario no puede estar vacio', 400);
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new AppError('El comentario no puede superar ' + MAX_COMMENT_LENGTH + ' caracteres', 400);
  }

  const comment = await Comment.create({ fileId: file._id, userId: req.user.id, text });

  await logCommentAction(req, 'comment.create', file, { commentId: comment._id });
  const users = await loadUserMap([comment.userId]);
  res.status(201).json({ comment: serializeComment(comment, users) });
});

// DELETE /api/files/:id/comments/:commentId  (lo borra su autor o el propietario del archivo)
const deleteComment = asyncHandler(async (req, res) => {
  const { file, level } = await getFileWithAccess(req.params.id, req.user.id, 'read');

  const comment = await Comment.findOne({ _id: req.params.commentId, fileId: file._id });
  if (!comment) {
    throw new AppError('Comentario no encontrado', 404);
  }

  const isAuthor = String(comment.userId) === String(req.user.id);
  if (!isAuthor && level !== 'owner') {
    throw new AppError('Solo el autor o el propietario pueden borrar este comentario', 403);
  }

  await Comment.deleteOne({ _id: comment._id });
  await logCommentAction(req, 'comment.delete', file, { commentId: comment._id });
  res.json({ message: 'Comentario eliminado' });
});

module.exports = { listComments, createComment, deleteComment };
