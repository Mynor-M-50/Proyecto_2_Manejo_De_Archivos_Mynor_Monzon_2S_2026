const Folder = require('../models/Folder');
const File = require('../models/File');
const Share = require('../models/Share');
const AppError = require('../utils/AppError');

// Niveles de acceso de menor a mayor. 'owner' es el propietario del recurso.
// Los permisos compartidos (read, comment, edit) usan el mismo nombre que su nivel.
const LEVELS = { read: 1, comment: 2, edit: 3, owner: 4 };

// El nivel mas alto de una lista de permisos
function highest(permissions) {
  return permissions.reduce((best, p) => (!best || LEVELS[p] > LEVELS[best] ? p : best), null);
}

// Nivel del usuario sobre una carpeta. Un permiso sobre una carpeta se hereda a todo su
// contenido, por eso se buscan permisos sobre la carpeta y sobre todas sus carpetas padre.
// rootId es la carpeta compartida mas alta de la ruta: desde ahi puede navegar el usuario.
async function getFolderLevel(folder, userId) {
  if (String(folder.ownerId) === String(userId)) {
    return { level: 'owner', rootId: null };
  }

  const chain = [...folder.ancestors, folder._id]; // de la raiz hacia abajo
  const shares = await Share.find({
    sharedWithId: userId,
    resourceType: 'folder',
    resourceId: { $in: chain },
  });
  if (shares.length === 0) {
    return { level: null, rootId: null };
  }

  const shared = new Set(shares.map((s) => String(s.resourceId)));
  const rootId = chain.find((id) => shared.has(String(id)));
  return { level: highest(shares.map((s) => s.permission)), rootId };
}

// Nivel del usuario sobre un archivo: permiso directo o heredado de alguna carpeta contenedora
async function getFileLevel(file, userId) {
  if (String(file.ownerId) === String(userId)) {
    return { level: 'owner', rootId: null };
  }

  const permissions = [];

  const direct = await Share.find({
    sharedWithId: userId,
    resourceType: 'file',
    resourceId: file._id,
  });
  direct.forEach((s) => permissions.push(s.permission));

  if (file.folderId) {
    const folder = await Folder.findOne({ _id: file.folderId });
    if (folder) {
      const chain = [...folder.ancestors, folder._id];
      const inherited = await Share.find({
        sharedWithId: userId,
        resourceType: 'folder',
        resourceId: { $in: chain },
      });
      inherited.forEach((s) => permissions.push(s.permission));
    }
  }

  return { level: highest(permissions), rootId: null };
}

function checkLevel(level, needed) {
  if (!level) {
    throw new AppError('No tienes acceso a este recurso', 403);
  }
  if (LEVELS[level] < LEVELS[needed]) {
    throw new AppError('No tienes permiso para realizar esta accion', 403);
  }
}

// Busca una carpeta activa y comprueba que el usuario tenga al menos el nivel pedido
async function getFolderWithAccess(folderId, userId, needed = 'read') {
  const folder = await Folder.findOne({ _id: folderId, deletedAt: null });
  if (!folder) {
    throw new AppError('Carpeta no encontrada', 404);
  }

  const { level, rootId } = await getFolderLevel(folder, userId);
  checkLevel(level, needed);
  return { folder, level, rootId };
}

// Igual que la anterior pero para archivos
async function getFileWithAccess(fileId, userId, needed = 'read') {
  const file = await File.findOne({ _id: fileId, deletedAt: null });
  if (!file) {
    throw new AppError('Archivo no encontrado', 404);
  }

  const { level } = await getFileLevel(file, userId);
  checkLevel(level, needed);
  return { file, level };
}

// Papelera: solo el propietario puede ver, restaurar o eliminar definitivamente
async function getTrashedFolder(folderId, userId) {
  const folder = await Folder.findOne({ _id: folderId, deletedAt: { $ne: null } });
  if (!folder) {
    throw new AppError('La carpeta no esta en la papelera', 404);
  }
  if (String(folder.ownerId) !== String(userId)) {
    throw new AppError('No tienes acceso a este recurso', 403);
  }
  return folder;
}

async function getTrashedFile(fileId, userId) {
  const file = await File.findOne({ _id: fileId, deletedAt: { $ne: null } });
  if (!file) {
    throw new AppError('El archivo no esta en la papelera', 404);
  }
  if (String(file.ownerId) !== String(userId)) {
    throw new AppError('No tienes acceso a este recurso', 403);
  }
  return file;
}

module.exports = { getFolderWithAccess, getFileWithAccess, getTrashedFolder, getTrashedFile };
