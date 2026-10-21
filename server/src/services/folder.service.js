const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');

// Verifica que no exista otra carpeta activa con el mismo nombre en la misma ubicacion
async function assertNameAvailable(ownerId, parentId, name, excludeId) {
  const filter = {
    ownerId,
    parentId: parentId || null,
    deletedAt: null,
    name: new RegExp('^' + escapeRegex(name) + '$', 'i'),
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const exists = await Folder.findOne(filter);
  if (exists) {
    throw new AppError('Ya existe una carpeta con ese nombre en esta ubicacion', 409);
  }
}

module.exports = { assertNameAvailable };
