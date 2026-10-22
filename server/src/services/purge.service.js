const mongoose = require('mongoose');
const File = require('../models/File');
const Folder = require('../models/Folder');
const { removeContent } = require('./gridfs.service');
const { adjustStorage } = require('./file.service');

// Borra los permisos y comentarios de recursos que se eliminan de forma definitiva.
// Se usan las colecciones directamente: no dependen de los modelos del modulo de compartir
async function removeRelated(type, ids) {
  if (ids.length === 0) {
    return;
  }
  await mongoose.connection.collection('shares').deleteMany({
    resourceType: type,
    resourceId: { $in: ids },
  });
  if (type === 'file') {
    await mongoose.connection.collection('comments').deleteMany({ fileId: { $in: ids } });
  }
}

// Elimina definitivamente una lista de archivos (documentos de File).
// Orden: primero el registro, luego el contenido en GridFS, luego permisos y espacio usado.
async function purgeFiles(files) {
  if (files.length === 0) {
    return { files: 0, bytes: 0 };
  }

  const ids = files.map((f) => f._id);
  await File.deleteMany({ _id: { $in: ids } });

  for (const file of files) {
    await removeContent(file.gridfsId);
  }
  await removeRelated('file', ids);

  // El espacio liberado se descuenta a cada propietario
  const bytesByOwner = new Map();
  let bytes = 0;
  for (const file of files) {
    const key = String(file.ownerId);
    bytesByOwner.set(key, (bytesByOwner.get(key) || 0) + file.size);
    bytes += file.size;
  }
  for (const [ownerId, total] of bytesByOwner) {
    await adjustStorage(ownerId, -total);
  }

  return { files: files.length, bytes };
}

// Elimina definitivamente una lista de carpetas por id (sin tocar sus archivos)
async function purgeFolderIds(folderIds) {
  if (folderIds.length === 0) {
    return 0;
  }
  await removeRelated('folder', folderIds);
  await Folder.deleteMany({ _id: { $in: folderIds } });
  return folderIds.length;
}

// Elimina una carpeta con todas sus subcarpetas y todos los archivos que contiene
async function purgeFolderTree(folder) {
  const descendants = await Folder.find({ ancestors: folder._id }).select('_id');
  const folderIds = [folder._id, ...descendants.map((d) => d._id)];

  const files = await File.find({ folderId: { $in: folderIds } });
  const purgedFiles = await purgeFiles(files);
  const purgedFolders = await purgeFolderIds(folderIds);

  return { folders: purgedFolders, files: purgedFiles.files, bytes: purgedFiles.bytes };
}

module.exports = { purgeFiles, purgeFolderIds, purgeFolderTree };
