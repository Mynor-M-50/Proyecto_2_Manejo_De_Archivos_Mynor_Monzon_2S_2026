// Datos del usuario que se envian al cliente (nunca el hash de la contrasena)
function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    storageUsed: user.storageUsed,
    createdAt: user.createdAt,
  };
}

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

module.exports = { serializeUser, serializeFolder };
