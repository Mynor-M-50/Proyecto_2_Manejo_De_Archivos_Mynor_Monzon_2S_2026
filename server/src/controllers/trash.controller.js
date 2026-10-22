const File = require('../models/File');
const Folder = require('../models/Folder');
const asyncHandler = require('../utils/asyncHandler');
const { serializeFile, serializeFolder } = require('../utils/serializers');
const {
  getFileWithAccess,
  getFolderWithAccess,
  getTrashedFile,
  getTrashedFolder,
} = require('../services/access.service');
const { uniqueFileName } = require('../services/file.service');
const { uniqueFolderName, rebaseDescendants } = require('../services/folder.service');
const { purgeFiles, purgeFolderIds, purgeFolderTree } = require('../services/purge.service');
const { logActivity } = require('../services/activity.service');

function logAction(req, action, resourceType, resource, details) {
  return logActivity({
    userId: req.user.id,
    action,
    resourceType,
    resourceId: resource._id,
    resourceName: resource.name,
    details,
  });
}

// ---------- Enviar a la papelera ----------

// DELETE /api/files/:id
const trashFile = asyncHandler(async (req, res) => {
  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'owner');

  file.deletedAt = new Date();
  await file.save();

  await logAction(req, 'file.trash', 'file', file, { folderId: file.folderId });
  res.json({ message: 'Archivo enviado a la papelera' });
});

// DELETE /api/folders/:id  (la carpeta, sus subcarpetas y todos sus archivos)
const trashFolder = asyncHandler(async (req, res) => {
  const { folder } = await getFolderWithAccess(req.params.id, req.user.id, 'owner');

  // Todo lo que se elimina en esta operacion lleva la misma fecha; asi se puede restaurar junto
  const now = new Date();
  const descendants = await Folder.find({ ancestors: folder._id, deletedAt: null }).select('_id');
  const descendantIds = descendants.map((d) => d._id);
  const allIds = [folder._id, ...descendantIds];

  // Orden: archivos, subcarpetas y al final la carpeta. Si algo falla a la mitad,
  // lo que quedo eliminado sigue siendo un estado valido y consistente
  const filesResult = await File.updateMany(
    { folderId: { $in: allIds }, deletedAt: null },
    { $set: { deletedAt: now } }
  );
  if (descendantIds.length > 0) {
    await Folder.updateMany({ _id: { $in: descendantIds } }, { $set: { deletedAt: now } });
  }
  folder.deletedAt = now;
  await folder.save();

  const counts = { folders: allIds.length, files: filesResult.modifiedCount };
  await logAction(req, 'folder.trash', 'folder', folder, counts);
  res.json({ message: 'Carpeta enviada a la papelera', ...counts });
});

// ---------- Ver la papelera ----------

// GET /api/trash
// Solo se listan los elementos que se eliminaron directamente. Lo que cayo junto con una
// carpeta (misma fecha de eliminacion) se muestra como parte de ella.
const listTrash = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const folders = await Folder.find({ ownerId, deletedAt: { $ne: null } });
  const files = await File.find({ ownerId, deletedAt: { $ne: null } });

  const folderById = new Map(folders.map((f) => [String(f._id), f]));
  const sameStamp = (a, b) => a.deletedAt.getTime() === b.deletedAt.getTime();
  const isRoot = (item, parentId) => {
    if (!parentId) {
      return true;
    }
    const parent = folderById.get(String(parentId));
    return !parent || !sameStamp(parent, item);
  };

  const items = [];

  for (const folder of folders) {
    if (!isRoot(folder, folder.parentId)) {
      continue;
    }
    const inside = folders.filter(
      (f) => f.ancestors.some((a) => String(a) === String(folder._id)) && sameStamp(f, folder)
    );
    const ids = new Set([String(folder._id), ...inside.map((f) => String(f._id))]);
    const filesInside = files.filter(
      (f) => f.folderId && ids.has(String(f.folderId)) && sameStamp(f, folder)
    );
    items.push({
      type: 'folder',
      id: folder._id,
      name: folder.name,
      parentId: folder.parentId || null,
      deletedAt: folder.deletedAt,
      contains: { folders: inside.length, files: filesInside.length },
    });
  }

  for (const file of files) {
    if (!isRoot(file, file.folderId)) {
      continue;
    }
    items.push({
      type: 'file',
      id: file._id,
      name: file.name,
      ext: file.ext,
      size: file.size,
      folderId: file.folderId || null,
      deletedAt: file.deletedAt,
    });
  }

  items.sort((a, b) => b.deletedAt - a.deletedAt);
  res.json({ items });
});

// ---------- Restaurar ----------

// POST /api/trash/files/:id/restore
// Vuelve a su carpeta; si esa carpeta sigue en la papelera, pasa a la raiz.
// Si el nombre ya esta ocupado en el destino se agrega " (restaurado)".
const restoreFile = asyncHandler(async (req, res) => {
  const file = await getTrashedFile(req.params.id, req.user.id);
  const oldName = file.name;

  let folderId = null;
  if (file.folderId) {
    const parent = await Folder.findOne({ _id: file.folderId, deletedAt: null });
    if (parent) {
      folderId = parent._id;
    }
  }
  const movedToRoot = Boolean(file.folderId && !folderId);

  const name = await uniqueFileName(file.ownerId, folderId, file.name, file._id);

  file.deletedAt = null;
  file.folderId = folderId;
  file.name = name;
  await file.save();

  await logAction(req, 'file.restore', 'file', file, { folderId, movedToRoot });
  res.json({ file: serializeFile(file), movedToRoot, renamed: name !== oldName });
});

// POST /api/trash/folders/:id/restore
// Restaura la carpeta y todo lo que se elimino junto con ella (misma fecha de eliminacion).
// Si su carpeta padre sigue en la papelera, pasa a la raiz.
const restoreFolder = asyncHandler(async (req, res) => {
  const folder = await getTrashedFolder(req.params.id, req.user.id);
  const stamp = folder.deletedAt;
  const oldName = folder.name;

  let parent = null;
  if (folder.parentId) {
    parent = await Folder.findOne({ _id: folder.parentId, deletedAt: null });
  }
  const parentId = parent ? parent._id : null;
  const newAncestors = parent ? [...parent.ancestors, parent._id] : [];
  const movedToRoot = Boolean(folder.parentId && !parent);

  const name = await uniqueFolderName(folder.ownerId, parentId, folder.name, folder._id);

  // La ruta de las subcarpetas se recalcula por si el destino cambio
  await rebaseDescendants(folder._id, newAncestors);

  const descendants = await Folder.find({ ancestors: folder._id, deletedAt: stamp }).select('_id');
  const descendantIds = descendants.map((d) => d._id);

  // Orden: primero la carpeta, luego sus subcarpetas y al final los archivos
  folder.deletedAt = null;
  folder.parentId = parentId;
  folder.ancestors = newAncestors;
  folder.name = name;
  await folder.save();

  if (descendantIds.length > 0) {
    await Folder.updateMany({ _id: { $in: descendantIds } }, { $set: { deletedAt: null } });
  }
  const filesResult = await File.updateMany(
    { folderId: { $in: [folder._id, ...descendantIds] }, deletedAt: stamp },
    { $set: { deletedAt: null } }
  );

  const counts = { folders: 1 + descendantIds.length, files: filesResult.modifiedCount };
  await logAction(req, 'folder.restore', 'folder', folder, { ...counts, movedToRoot });
  res.json({
    folder: serializeFolder(folder),
    movedToRoot,
    renamed: name !== oldName,
    ...counts,
  });
});

// ---------- Eliminar definitivamente ----------

// DELETE /api/trash/files/:id
const deleteFilePermanently = asyncHandler(async (req, res) => {
  const file = await getTrashedFile(req.params.id, req.user.id);

  await purgeFiles([file]);

  await logAction(req, 'file.delete', 'file', file, { size: file.size });
  res.json({ message: 'Archivo eliminado de forma definitiva' });
});

// DELETE /api/trash/folders/:id  (con todo su contenido)
const deleteFolderPermanently = asyncHandler(async (req, res) => {
  const folder = await getTrashedFolder(req.params.id, req.user.id);

  const result = await purgeFolderTree(folder);

  await logAction(req, 'folder.delete', 'folder', folder, {
    folders: result.folders,
    files: result.files,
  });
  res.json({
    message: 'Carpeta eliminada de forma definitiva',
    folders: result.folders,
    files: result.files,
  });
});

// DELETE /api/trash  (vacia toda la papelera del usuario)
const emptyTrash = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const folders = await Folder.find({ ownerId, deletedAt: { $ne: null } }).select('_id');
  const files = await File.find({ ownerId, deletedAt: { $ne: null } });

  const purgedFiles = await purgeFiles(files);
  const purgedFolders = await purgeFolderIds(folders.map((f) => f._id));

  await logActivity({
    userId: ownerId,
    action: 'trash.empty',
    resourceType: 'user',
    resourceId: ownerId,
    resourceName: req.user.name,
    details: { folders: purgedFolders, files: purgedFiles.files },
  });
  res.json({
    message: 'Papelera vaciada',
    folders: purgedFolders,
    files: purgedFiles.files,
  });
});

module.exports = {
  trashFile,
  trashFolder,
  listTrash,
  restoreFile,
  restoreFolder,
  deleteFilePermanently,
  deleteFolderPermanently,
  emptyTrash,
};
