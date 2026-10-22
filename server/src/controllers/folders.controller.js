const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { cleanName } = require('../utils/validators');
const { serializeFolder } = require('../utils/serializers');
const { getFolderWithAccess } = require('../services/access.service');
const { assertNameAvailable, rebaseDescendants } = require('../services/folder.service');
const { logActivity } = require('../services/activity.service');

function logFolderAction(req, action, folder, details) {
  return logActivity({
    userId: req.user.id,
    action,
    resourceType: 'folder',
    resourceId: folder._id,
    resourceName: folder.name,
    details,
  });
}

// POST /api/folders  { name, parentId? }
const createFolder = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = cleanName(body.name, 'El nombre de la carpeta');

  let ownerId = req.user.id;
  let parent = null;
  if (body.parentId) {
    const access = await getFolderWithAccess(body.parentId, req.user.id, 'edit');
    parent = access.folder;
    // La carpeta nueva pertenece al duenio del arbol donde se crea
    ownerId = parent.ownerId;
  }

  await assertNameAvailable(ownerId, parent ? parent._id : null, name);

  const folder = await Folder.create({
    ownerId,
    parentId: parent ? parent._id : null,
    name,
    ancestors: parent ? [...parent.ancestors, parent._id] : [],
  });

  await logFolderAction(req, 'folder.create', folder, { parentId: folder.parentId });
  res.status(201).json({ folder: serializeFolder(folder) });
});

// GET /api/folders?parentId=...  (sin parentId lista las carpetas de la raiz)
const listFolders = asyncHandler(async (req, res) => {
  const { parentId } = req.query;
  let filter;

  if (parentId) {
    const { folder } = await getFolderWithAccess(parentId, req.user.id, 'read');
    filter = { parentId: folder._id, deletedAt: null };
  } else {
    filter = { ownerId: req.user.id, parentId: null, deletedAt: null };
  }

  const folders = await Folder.find(filter).collation({ locale: 'es', strength: 2 }).sort({ name: 1 });
  res.json({ folders: folders.map(serializeFolder) });
});

// GET /api/folders/:id  (la carpeta y su ruta de navegacion)
const getFolder = asyncHandler(async (req, res) => {
  const { folder } = await getFolderWithAccess(req.params.id, req.user.id, 'read');

  let breadcrumb = [];
  if (folder.ancestors.length > 0) {
    const parents = await Folder.find({ _id: { $in: folder.ancestors } }).select('name');
    const byId = new Map(parents.map((p) => [String(p._id), p]));
    // ancestors esta ordenado de la raiz hacia abajo
    breadcrumb = folder.ancestors
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map((p) => ({ id: p._id, name: p.name }));
  }

  res.json({ folder: serializeFolder(folder), breadcrumb });
});

// PATCH /api/folders/:id/rename  { name }
const renameFolder = asyncHandler(async (req, res) => {
  const name = cleanName((req.body || {}).name, 'El nombre de la carpeta');
  const { folder } = await getFolderWithAccess(req.params.id, req.user.id, 'edit');

  if (folder.name === name) {
    throw new AppError('La carpeta ya tiene ese nombre', 400);
  }
  await assertNameAvailable(folder.ownerId, folder.parentId, name, folder._id);

  const oldName = folder.name;
  folder.name = name;
  await folder.save();

  await logFolderAction(req, 'folder.rename', folder, { oldName, newName: name });
  res.json({ folder: serializeFolder(folder) });
});

// PATCH /api/folders/:id/move  { parentId }  (null para mover a la raiz)
const moveFolder = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!('parentId' in body)) {
    throw new AppError('parentId es obligatorio (usa null para la raiz)', 400);
  }

  const { folder } = await getFolderWithAccess(req.params.id, req.user.id, 'owner');

  let newParent = null;
  if (body.parentId) {
    const access = await getFolderWithAccess(body.parentId, req.user.id, 'owner');
    newParent = access.folder;
  }

  const currentParentId = folder.parentId ? String(folder.parentId) : null;
  const newParentId = newParent ? String(newParent._id) : null;
  if (currentParentId === newParentId) {
    throw new AppError('La carpeta ya esta en ese destino', 400);
  }

  // Un ciclo ocurre si el destino es la propia carpeta o esta dentro de ella
  if (newParent) {
    const insideItself =
      String(newParent._id) === String(folder._id) ||
      newParent.ancestors.some((a) => String(a) === String(folder._id));
    if (insideItself) {
      throw new AppError('No se puede mover una carpeta dentro de si misma o de una de sus subcarpetas', 400);
    }
  }

  await assertNameAvailable(folder.ownerId, newParent ? newParent._id : null, folder.name, folder._id);

  const newAncestors = newParent ? [...newParent.ancestors, newParent._id] : [];

  // Todas las subcarpetas (tambien las de la papelera) cambian la parte inicial de su ruta
  await rebaseDescendants(folder._id, newAncestors);

  folder.parentId = newParent ? newParent._id : null;
  folder.ancestors = newAncestors;
  await folder.save();

  await logFolderAction(req, 'folder.move', folder, { from: currentParentId, to: newParentId });
  res.json({ folder: serializeFolder(folder) });
});

module.exports = { createFolder, listFolders, getFolder, renameFolder, moveFolder };
