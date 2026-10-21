const Folder = require('../models/Folder');
const File = require('../models/File');
const AppError = require('../utils/AppError');

// Niveles de acceso de menor a mayor. 'owner' es el propietario del recurso
const LEVELS = { read: 1, comment: 2, edit: 3, owner: 4 };

// Nivel de acceso del usuario sobre una carpeta, o null si no tiene ninguno.
// Por ahora solo existe el propietario; los permisos compartidos se suman
// en el modulo de comparticion, sin cambiar a quien llama a estas funciones.
async function getFolderLevel(folder, userId) {
  if (String(folder.ownerId) === String(userId)) {
    return 'owner';
  }
  return null;
}

async function getFileLevel(file, userId) {
  if (String(file.ownerId) === String(userId)) {
    return 'owner';
  }
  return null;
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

  const level = await getFolderLevel(folder, userId);
  checkLevel(level, needed);
  return { folder, level };
}

// Igual que la anterior pero para archivos
async function getFileWithAccess(fileId, userId, needed = 'read') {
  const file = await File.findOne({ _id: fileId, deletedAt: null });
  if (!file) {
    throw new AppError('Archivo no encontrado', 404);
  }

  const level = await getFileLevel(file, userId);
  checkLevel(level, needed);
  return { file, level };
}

module.exports = { getFolderWithAccess, getFileWithAccess };
