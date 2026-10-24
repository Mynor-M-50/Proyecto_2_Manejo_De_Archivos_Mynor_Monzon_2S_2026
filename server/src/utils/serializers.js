const env = require('../config/env');

// Datos del usuario que se envian al cliente (nunca el hash de la contrasena)
function serializeUser(user) {
  // Usuarios creados antes de existir la cuota toman el valor por defecto
  const quota = user.storageQuota || env.defaultQuota;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    storageUsed: user.storageUsed,
    storageQuota: quota,
    storageAvailable: Math.max(quota - user.storageUsed, 0),
    createdAt: user.createdAt,
  };
}

// Datos publicos de una carpeta
function serializeFolder(folder) {
  return {
    id: folder._id,
    ownerId: folder.ownerId,
    parentId: folder.parentId || null,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

// Datos publicos de un archivo (sin la referencia interna a GridFS)
function serializeFile(file) {
  return {
    id: file._id,
    ownerId: file.ownerId,
    folderId: file.folderId || null,
    name: file.name,
    ext: file.ext,
    mimeType: file.mimeType,
    size: file.size,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

module.exports = { serializeUser, serializeFolder, serializeFile };
