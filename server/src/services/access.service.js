const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');

// Niveles de acceso de menor a mayor. 'owner' es el propietario del recurso
const LEVELS = { read: 1, comment: 2, edit: 3, owner: 4 };

// Nivel de acceso del usuario sobre una carpeta, o null si no tiene ninguno.
// Por ahora solo existe el propietario; los permisos compartidos se suman
// en el modulo de comparticion, sin cambiar a quien llama a esta funcion.
async function getFolderLevel(folder, userId) {
  if (String(folder.ownerId) === String(userId)) {
    return 'owner';
  }
  return null;
}

// Busca una carpeta activa y comprueba que el usuario tenga al menos el nivel pedido
async function getFolderWithAccess(folderId, userId, needed = 'read') {
  const folder = await Folder.findOne({ _id: folderId, deletedAt: null });
  if (!folder) {
    throw new AppError('Carpeta no encontrada', 404);
  }

  const level = await getFolderLevel(folder, userId);
  if (!level) {
    throw new AppError('No tienes acceso a esta carpeta', 403);
  }
  if (LEVELS[level] < LEVELS[needed]) {
    throw new AppError('No tienes permiso para realizar esta accion', 403);
  }

  return { folder, level };
}

module.exports = { getFolderWithAccess };
