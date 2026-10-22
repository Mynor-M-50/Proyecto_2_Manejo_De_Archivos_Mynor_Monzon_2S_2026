const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');

// Mapa id -> { name, email } de una lista de usuarios
async function loadUserMap(ids) {
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await User.find({ _id: { $in: unique } }).select('name email');
  return new Map(users.map((u) => [String(u._id), u]));
}

// Arma la informacion que se muestra de cada permiso (recurso, propietario, destinatario).
// Los permisos cuyo recurso esta en la papelera o ya no existe no se muestran.
async function buildShareViews(shares) {
  const fileIds = shares.filter((s) => s.resourceType === 'file').map((s) => s.resourceId);
  const folderIds = shares.filter((s) => s.resourceType === 'folder').map((s) => s.resourceId);

  const files = fileIds.length > 0 ? await File.find({ _id: { $in: fileIds }, deletedAt: null }) : [];
  const folders =
    folderIds.length > 0 ? await Folder.find({ _id: { $in: folderIds }, deletedAt: null }) : [];
  const fileMap = new Map(files.map((f) => [String(f._id), f]));
  const folderMap = new Map(folders.map((f) => [String(f._id), f]));

  const users = await loadUserMap(shares.flatMap((s) => [s.ownerId, s.sharedWithId]));

  const views = [];
  for (const share of shares) {
    const isFile = share.resourceType === 'file';
    const resource = (isFile ? fileMap : folderMap).get(String(share.resourceId));
    if (!resource) {
      continue;
    }
    const owner = users.get(String(share.ownerId));
    const target = users.get(String(share.sharedWithId));
    views.push({
      id: share._id,
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      resource: isFile
        ? { name: resource.name, ext: resource.ext, size: resource.size }
        : { name: resource.name },
      owner: { id: share.ownerId, name: owner ? owner.name : '' },
      sharedWith: {
        id: share.sharedWithId,
        name: target ? target.name : '',
        email: target ? target.email : '',
      },
      permission: share.permission,
      createdAt: share.createdAt,
    });
  }
  return views;
}

// Busca el recurso de un permiso aunque este en la papelera (para el historial)
async function findResourceAnyState(share) {
  const Model = share.resourceType === 'file' ? File : Folder;
  return Model.findOne({ _id: share.resourceId });
}

module.exports = { loadUserMap, buildShareViews, findResourceAnyState };
