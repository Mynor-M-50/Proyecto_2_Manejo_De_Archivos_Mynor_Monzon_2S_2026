const Share = require('../models/Share');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getFileWithAccess, getFolderWithAccess } = require('../services/access.service');
const { buildShareViews, findResourceAnyState } = require('../services/share.service');
const { cleanEmail } = require('../utils/validators');
const { logActivity } = require('../services/activity.service');

const RESOURCE_TYPES = ['file', 'folder'];
const PERMISSIONS = ['read', 'comment', 'edit'];

// Registra en el historial una operacion de comparticion
function logShareAction(req, action, resourceType, resource, details) {
  return logActivity({
    userId: req.user.id,
    action,
    resourceType,
    resourceId: resource._id,
    resourceName: resource.name,
    details,
  });
}

// Devuelve el recurso (archivo o carpeta activo) solo si el usuario es su propietario
async function getOwnedResource(resourceType, resourceId, userId) {
  if (!RESOURCE_TYPES.includes(resourceType)) {
    throw new AppError('resourceType debe ser file o folder', 400);
  }
  if (!resourceId) {
    throw new AppError('resourceId es obligatorio', 400);
  }
  if (resourceType === 'file') {
    return (await getFileWithAccess(resourceId, userId, 'owner')).file;
  }
  return (await getFolderWithAccess(resourceId, userId, 'owner')).folder;
}

// Un permiso solo lo puede modificar o retirar quien lo otorgo
async function getOwnedShare(shareId, userId) {
  const share = await Share.findOne({ _id: shareId });
  if (!share) {
    throw new AppError('Permiso no encontrado', 404);
  }
  if (String(share.ownerId) !== String(userId)) {
    throw new AppError('No tienes acceso a este recurso', 403);
  }
  return share;
}

// POST /api/shares  { resourceType, resourceId, email, permission }
const createShare = asyncHandler(async (req, res) => {
  const { resourceType, resourceId, email, permission } = req.body || {};

  if (!PERMISSIONS.includes(permission)) {
    throw new AppError('permission debe ser read, comment o edit', 400);
  }
  const targetEmail = cleanEmail(email);

  const resource = await getOwnedResource(resourceType, resourceId, req.user.id);

  const target = await User.findOne({ email: targetEmail });
  if (!target) {
    throw new AppError('No existe un usuario con ese correo', 404);
  }
  if (!target.active) {
    throw new AppError('El usuario esta inactivo', 400);
  }
  if (String(target._id) === String(req.user.id)) {
    throw new AppError('No puedes compartir un recurso contigo mismo', 400);
  }

  const exists = await Share.findOne({
    resourceType,
    resourceId: resource._id,
    sharedWithId: target._id,
  });
  if (exists) {
    throw new AppError('Ya compartiste este recurso con ese usuario, modifica su permiso', 409);
  }

  const share = await Share.create({
    ownerId: resource.ownerId,
    sharedWithId: target._id,
    resourceType,
    resourceId: resource._id,
    permission,
  });

  await logShareAction(req, 'share.create', resourceType, resource, {
    sharedWith: target.email,
    permission,
  });

  const [view] = await buildShareViews([share]);
  res.status(201).json({ share: view });
});

// GET /api/shares?resourceType=&resourceId=  (con quien esta compartido un recurso)
const listResourceShares = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.query;
  const resource = await getOwnedResource(resourceType, resourceId, req.user.id);

  const shares = await Share.find({ resourceType, resourceId: resource._id }).sort({ createdAt: 1 });
  res.json({ shares: await buildShareViews(shares) });
});

// GET /api/shares/by-me  (lo que yo comparti)
const sharedByMe = asyncHandler(async (req, res) => {
  const shares = await Share.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
  res.json({ shares: await buildShareViews(shares) });
});

// GET /api/shares/with-me  (lo que otros compartieron conmigo)
const sharedWithMe = asyncHandler(async (req, res) => {
  const shares = await Share.find({ sharedWithId: req.user.id }).sort({ createdAt: -1 });
  res.json({ shares: await buildShareViews(shares) });
});

// PATCH /api/shares/:id  { permission }
const updateShare = asyncHandler(async (req, res) => {
  const { permission } = req.body || {};
  if (!PERMISSIONS.includes(permission)) {
    throw new AppError('permission debe ser read, comment o edit', 400);
  }

  const share = await getOwnedShare(req.params.id, req.user.id);
  if (share.permission === permission) {
    throw new AppError('El usuario ya tiene ese permiso', 400);
  }

  const before = share.permission;
  share.permission = permission;
  await share.save();

  const resource = await findResourceAnyState(share);
  if (resource) {
    const target = await User.findOne({ _id: share.sharedWithId });
    await logShareAction(req, 'share.update', share.resourceType, resource, {
      sharedWith: target ? target.email : '',
      from: before,
      to: permission,
    });
  }

  const [view] = await buildShareViews([share]);
  res.json({ share: view || null });
});

// DELETE /api/shares/:id  (retira el permiso)
const removeShare = asyncHandler(async (req, res) => {
  const share = await getOwnedShare(req.params.id, req.user.id);
  await Share.deleteOne({ _id: share._id });

  const resource = await findResourceAnyState(share);
  if (resource) {
    const target = await User.findOne({ _id: share.sharedWithId });
    await logShareAction(req, 'share.remove', share.resourceType, resource, {
      sharedWith: target ? target.email : '',
      permission: share.permission,
    });
  }

  res.json({ message: 'Permiso retirado' });
});

module.exports = {
  createShare,
  listResourceShares,
  sharedByMe,
  sharedWithMe,
  updateShare,
  removeShare,
};
