const Folder = require('../models/Folder');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');

// Indica si ya existe una carpeta activa con ese nombre en la misma ubicacion
async function folderNameTaken(ownerId, parentId, name, excludeId) {
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
  return Boolean(exists);
}

// Verifica que no exista otra carpeta activa con el mismo nombre en la misma ubicacion
async function assertNameAvailable(ownerId, parentId, name, excludeId) {
  if (await folderNameTaken(ownerId, parentId, name, excludeId)) {
    throw new AppError('Ya existe una carpeta con ese nombre en esta ubicacion', 409);
  }
}

// Para restaurar: si el nombre esta ocupado agrega " (restaurado)", " (restaurado 2)", etc.
async function uniqueFolderName(ownerId, parentId, name, excludeId) {
  let candidate = name;
  let n = 0;
  while (await folderNameTaken(ownerId, parentId, candidate, excludeId)) {
    n += 1;
    if (n > 1000) {
      throw new AppError('No se pudo encontrar un nombre disponible', 409);
    }
    candidate = name + (n === 1 ? ' (restaurado)' : ' (restaurado ' + n + ')');
  }
  return candidate;
}

// Cuando una carpeta cambia de lugar, todas sus subcarpetas (tambien las de la papelera)
// cambian la parte inicial de su ruta (ancestors)
async function rebaseDescendants(folderId, newAncestors) {
  const descendants = await Folder.find({ ancestors: folderId }).select('ancestors');
  const operations = descendants.map((d) => {
    const index = d.ancestors.findIndex((a) => String(a) === String(folderId));
    const tail = d.ancestors.slice(index); // desde la carpeta movida hacia abajo
    return {
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { ancestors: [...newAncestors, ...tail] } },
      },
    };
  });
  if (operations.length > 0) {
    await Folder.bulkWrite(operations);
  }
}

module.exports = { assertNameAvailable, uniqueFolderName, rebaseDescendants };
