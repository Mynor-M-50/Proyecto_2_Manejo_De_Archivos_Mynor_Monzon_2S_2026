const File = require('../models/File');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { serializeFile } = require('../utils/serializers');
const { MAX_FILE_SIZE } = require('../utils/upload');
const { ALLOWED_EXTENSIONS, parseFileName, fixFilename, assertTextBuffer } = require('../utils/files');
const { getFolderWithAccess, getFileWithAccess } = require('../services/access.service');
const { assertFileNameAvailable, assertQuotaAvailable, adjustStorage } = require('../services/file.service');
const { saveBuffer, openDownload, readBuffer, removeContent } = require('../services/gridfs.service');
const { logActivity } = require('../services/activity.service');

const SORT_FIELDS = { name: 'name', createdAt: 'createdAt', updatedAt: 'updatedAt', size: 'size' };

// Registra en el historial una operacion sobre un archivo
function logFileAction(req, action, file, details) {
  return logActivity({
    userId: req.user.id,
    action,
    resourceType: 'file',
    resourceId: file._id,
    resourceName: file.name,
    details,
  });
}

// POST /api/files  (multipart: campo "file" y, opcionalmente, "folderId")
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Debes enviar un archivo en el campo "file"', 400);
  }

  const { name, ext, mimeType } = parseFileName(fixFilename(req.file.originalname));
  assertTextBuffer(req.file.buffer);

  const body = req.body || {};
  let ownerId = req.user.id;
  let folder = null;
  if (body.folderId && body.folderId !== 'root') {
    const access = await getFolderWithAccess(body.folderId, req.user.id, 'edit');
    folder = access.folder;
    // El archivo pertenece al duenio del arbol donde se guarda
    ownerId = folder.ownerId;
  }

  await assertFileNameAvailable(ownerId, folder ? folder._id : null, name);

  const size = req.file.buffer.length;
  await assertQuotaAvailable(ownerId, size);
  const gridfsId = await saveBuffer(name, req.file.buffer, { ownerId, ext, mimeType });

  let file;
  try {
    file = await File.create({
      ownerId,
      folderId: folder ? folder._id : null,
      name,
      ext,
      mimeType,
      size,
      gridfsId,
    });
  } catch (err) {
    // Si no se pudo guardar el registro, no se deja el contenido huerfano
    await removeContent(gridfsId);
    throw err;
  }

  await adjustStorage(ownerId, size);
  await logFileAction(req, 'file.upload', file, { size, folderId: file.folderId });
  res.status(201).json({ file: serializeFile(file) });
});

// GET /api/files?folderId=&q=&ext=&sort=&order=
//   folderId=ID   -> archivos de esa carpeta
//   folderId=root -> archivos de la raiz
//   sin folderId  -> todos mis archivos (util para buscar)
const listFiles = asyncHandler(async (req, res) => {
  const { folderId, q, ext, sort, order } = req.query;
  const filter = { deletedAt: null };
  let access = 'owner';

  if (folderId === 'root') {
    filter.ownerId = req.user.id;
    filter.folderId = null;
  } else if (folderId) {
    const result = await getFolderWithAccess(folderId, req.user.id, 'read');
    access = result.level;
    filter.folderId = result.folder._id;
  } else {
    filter.ownerId = req.user.id;
  }

  if (ext) {
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new AppError('Extension invalida, usa txt o md', 400);
    }
    filter.ext = ext;
  }
  if (q) {
    filter.name = new RegExp(escapeRegex(q), 'i');
  }

  let sortField = 'name';
  if (sort) {
    if (!SORT_FIELDS[sort]) {
      throw new AppError('Campo de orden invalido, usa name, createdAt, updatedAt o size', 400);
    }
    sortField = SORT_FIELDS[sort];
  }
  const direction = order === 'desc' ? -1 : 1;

  const files = await File.find(filter)
    .collation({ locale: 'es', strength: 2 })
    .sort({ [sortField]: direction });

  res.json({ files: files.map(serializeFile), access });
});

// GET /api/files/:id
const getFile = asyncHandler(async (req, res) => {
  const { file, level } = await getFileWithAccess(req.params.id, req.user.id, 'read');
  res.json({ file: serializeFile(file), access: level });
});

// GET /api/files/:id/content  (el texto del archivo, para verlo o editarlo en pantalla)
const getContent = asyncHandler(async (req, res) => {
  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'read');
  const buffer = await readBuffer(file.gridfsId);

  await logFileAction(req, 'file.view', file);
  res.json({ file: serializeFile(file), content: buffer.toString('utf8') });
});

// GET /api/files/:id/download
const downloadFile = asyncHandler(async (req, res, next) => {
  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'read');

  await logFileAction(req, 'file.download', file);

  res.attachment(file.name);
  const stream = openDownload(file.gridfsId);
  stream.on('error', (err) => {
    if (res.headersSent) {
      return res.destroy();
    }
    res.removeHeader('Content-Disposition');
    res.removeHeader('Content-Type');
    next(err);
  });
  stream.pipe(res);
});

// PUT /api/files/:id/content  { content }  (reemplaza el contenido)
const updateContent = asyncHandler(async (req, res) => {
  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'edit');

  const content = (req.body || {}).content;
  if (typeof content !== 'string') {
    throw new AppError('El campo content debe ser texto', 400);
  }
  const buffer = Buffer.from(content, 'utf8');
  if (buffer.length > MAX_FILE_SIZE) {
    throw new AppError('El contenido supera el tamano maximo de 5 MB', 413);
  }
  assertTextBuffer(buffer);
  await assertQuotaAvailable(file.ownerId, buffer.length - file.size);

  const oldGridfsId = file.gridfsId;
  const oldSize = file.size;

  // Primero se guarda el contenido nuevo, luego se apunta a el y al final se borra el viejo
  const newGridfsId = await saveBuffer(file.name, buffer, {
    ownerId: file.ownerId,
    ext: file.ext,
    mimeType: file.mimeType,
  });

  file.gridfsId = newGridfsId;
  file.size = buffer.length;
  try {
    await file.save();
  } catch (err) {
    await removeContent(newGridfsId);
    throw err;
  }

  await removeContent(oldGridfsId);
  await adjustStorage(file.ownerId, buffer.length - oldSize);

  await logFileAction(req, 'file.edit', file, { size: file.size });
  res.json({ file: serializeFile(file) });
});

// PATCH /api/files/:id/rename  { name }  (debe terminar en .txt o .md)
const renameFile = asyncHandler(async (req, res) => {
  const { name, ext, mimeType } = parseFileName((req.body || {}).name);
  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'edit');

  if (file.name === name) {
    throw new AppError('El archivo ya tiene ese nombre', 400);
  }
  await assertFileNameAvailable(file.ownerId, file.folderId, name, file._id);

  const oldName = file.name;
  file.name = name;
  file.ext = ext;
  file.mimeType = mimeType;
  await file.save();

  await logFileAction(req, 'file.rename', file, { oldName, newName: name });
  res.json({ file: serializeFile(file) });
});

// PATCH /api/files/:id/move  { folderId }  (null para la raiz)
const moveFile = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!('folderId' in body)) {
    throw new AppError('folderId es obligatorio (usa null para la raiz)', 400);
  }

  const { file } = await getFileWithAccess(req.params.id, req.user.id, 'owner');

  let destination = null;
  if (body.folderId) {
    const access = await getFolderWithAccess(body.folderId, req.user.id, 'owner');
    destination = access.folder;
  }

  const currentFolderId = file.folderId ? String(file.folderId) : null;
  const newFolderId = destination ? String(destination._id) : null;
  if (currentFolderId === newFolderId) {
    throw new AppError('El archivo ya esta en ese destino', 400);
  }

  await assertFileNameAvailable(file.ownerId, destination ? destination._id : null, file.name, file._id);

  file.folderId = destination ? destination._id : null;
  await file.save();

  await logFileAction(req, 'file.move', file, { from: currentFolderId, to: newFolderId });
  res.json({ file: serializeFile(file) });
});

module.exports = {
  uploadFile,
  listFiles,
  getFile,
  getContent,
  downloadFile,
  updateContent,
  renameFile,
  moveFile,
};
