const File = require('../models/File');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');
const env = require('../config/env');

// Indica si ya existe un archivo activo con ese nombre en la misma ubicacion
async function fileNameTaken(ownerId, folderId, name, excludeId) {
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
  return Boolean(exists);
}

// Verifica que no exista otro archivo activo con el mismo nombre en la misma ubicacion
async function assertFileNameAvailable(ownerId, folderId, name, excludeId) {
  if (await fileNameTaken(ownerId, folderId, name, excludeId)) {
    throw new AppError('Ya existe un archivo con ese nombre en esta ubicacion', 409);
  }
}

// "informe.txt" -> "informe (restaurado).txt", "informe (restaurado 2).txt", ...
function withRestoredSuffix(name, n) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const suffix = n === 1 ? ' (restaurado)' : ' (restaurado ' + n + ')';
  return base + suffix + ext;
}

// Para restaurar: si el nombre esta ocupado se le agrega un sufijo
async function uniqueFileName(ownerId, folderId, name, excludeId) {
  let candidate = name;
  let n = 0;
  while (await fileNameTaken(ownerId, folderId, candidate, excludeId)) {
    n += 1;
    if (n > 1000) {
      throw new AppError('No se pudo encontrar un nombre disponible', 409);
    }
    candidate = withRestoredSuffix(name, n);
  }
  return candidate;
}

// Verifica que el propietario tenga espacio disponible para guardar extraBytes mas
async function assertQuotaAvailable(ownerId, extraBytes) {
  if (extraBytes <= 0) {
    return;
  }
  const owner = await User.findById(ownerId).select('storageUsed storageQuota');
  if (!owner) {
    throw new AppError('Propietario no encontrado', 404);
  }
  const quota = owner.storageQuota || env.defaultQuota;
  if (owner.storageUsed + extraBytes > quota) {
    throw new AppError('No hay espacio suficiente: se superaria el espacio asignado al propietario', 413);
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

module.exports = { assertFileNameAvailable, uniqueFileName, assertQuotaAvailable, adjustStorage };
