const File = require('../models/File');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');

// Verifica que no exista otro archivo activo con el mismo nombre en la misma ubicacion
async function assertFileNameAvailable(ownerId, folderId, name, excludeId) {
  const filter = {
    ownerId,
    folderId: folderId || null,
    deletedAt: null,
    name: new RegExp('^' + escapeRegex(name) + '$', 'i'),
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const exists = await File.findOne(filter);
  if (exists) {
    throw new AppError('Ya existe un archivo con ese nombre en esta ubicacion', 409);
  }
}

// Suma o resta bytes al espacio usado del propietario
async function adjustStorage(ownerId, delta) {
  if (!delta) {
    return;
  }
  try {
    await User.updateOne({ _id: ownerId }, { $inc: { storageUsed: delta } });
  } catch (err) {
    console.error('No se pudo actualizar el espacio usado:', err.message);
  }
}

module.exports = { assertFileNameAvailable, adjustStorage };
