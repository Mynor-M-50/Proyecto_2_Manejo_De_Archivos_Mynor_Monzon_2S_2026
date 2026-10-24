const File = require('../models/File');
const Share = require('../models/Share');
const ActivityLog = require('../models/ActivityLog');

// Los reportes usan pipelines de agregacion de MongoDB ($match, $group, $sort, $lookup...).
// Las referencias a otras colecciones (usuarios, archivos) se resuelven con $lookup.

const TIMEZONE = 'America/Guatemala';
const PERIOD_FORMATS = { day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' };

// Une cada documento con su usuario (campo localField) y lo deja en el arreglo 'as'
const lookupUser = (localField, as) => ({
  $lookup: { from: 'users', localField, foreignField: '_id', as },
});

// ---------- Archivos y almacenamiento ----------

// Cantidad de archivos agrupados por tipo
async function filesByType({ includeTrash }) {
  return File.aggregate([
    { $match: includeTrash ? {} : { deletedAt: null } },
    { $group: { _id: '$ext', count: { $sum: 1 }, totalSize: { $sum: '$size' } } },
    { $sort: { count: -1, _id: 1 } },
    { $project: { _id: 0, type: '$_id', count: 1, totalSize: 1 } },
  ]);
}

// Archivos almacenados dentro de un rango de fechas (con filtros opcionales)
async function filesByDate({ dateFilter, ownerId, ext, includeTrash, limit }) {
  const match = {};
  if (dateFilter) match.createdAt = dateFilter;
  if (!includeTrash) match.deletedAt = null;
  if (ownerId) match.ownerId = ownerId;
  if (ext) match.ext = ext;

  const [result] = await File.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: 'n' }],
        items: [
          { $sort: { createdAt: -1 } },
          { $limit: limit },
          lookupUser('ownerId', 'owner'),
          {
            $project: {
              _id: 0,
              id: '$_id',
              name: 1,
              ext: 1,
              size: 1,
              createdAt: 1,
              deletedAt: 1,
              owner: { $arrayElemAt: ['$owner.name', 0] },
            },
          },
        ],
      },
    },
  ]);
  return { total: result.total.length > 0 ? result.total[0].n : 0, items: result.items };
}

// Archivos con mayor cantidad de operaciones registradas en el historial
async function filesMostOperations({ dateFilter, limit }) {
  const match = { resourceType: 'file' };
  if (dateFilter) match.createdAt = dateFilter;

  return ActivityLog.aggregate([
    { $match: match },
    // Se ordena primero para que $first tome el nombre mas reciente del archivo
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$resourceId',
        operations: { $sum: 1 },
        name: { $first: '$resourceName' },
        lastActivity: { $max: '$createdAt' },
      },
    },
    { $sort: { operations: -1, lastActivity: -1 } },
    { $limit: limit },
    { $lookup: { from: 'files', localField: '_id', foreignField: '_id', as: 'file' } },
    {
      $project: {
        _id: 0,
        fileId: '$_id',
        name: 1,
        operations: 1,
        lastActivity: 1,
        status: {
          $cond: [
            { $eq: [{ $size: '$file' }, 0] },
            'eliminado',
            {
              $cond: [
                { $ne: [{ $ifNull: [{ $arrayElemAt: ['$file.deletedAt', 0] }, null] }, null] },
                'en papelera',
                'activo',
              ],
            },
          ],
        },
      },
    },
  ]);
}

// Archivos activos que nunca se han compartido de forma directa (sin ningun permiso en shares)
async function neverSharedFiles({ ownerId, limit }) {
  const match = { deletedAt: null };
  if (ownerId) match.ownerId = ownerId;

  const [result] = await File.aggregate([
    { $match: match },
    { $lookup: { from: 'shares', localField: '_id', foreignField: 'resourceId', as: 'shares' } },
    { $match: { shares: { $size: 0 } } },
    {
      $facet: {
        total: [{ $count: 'n' }],
        items: [
          { $sort: { createdAt: -1 } },
          { $limit: limit },
          lookupUser('ownerId', 'owner'),
          {
            $project: {
              _id: 0,
              id: '$_id',
              name: 1,
              ext: 1,
              size: 1,
              createdAt: 1,
              owner: { $arrayElemAt: ['$owner.name', 0] },
            },
          },
        ],
      },
    },
  ]);
  return { total: result.total.length > 0 ? result.total[0].n : 0, items: result.items };
}

// Carpetas activas con mayor cantidad de archivos activos (contenido directo de cada carpeta)
async function foldersMostFiles({ ownerId, limit }) {
  const match = { deletedAt: null, folderId: { $ne: null } };
  if (ownerId) match.ownerId = ownerId;

  return File.aggregate([
    { $match: match },
    { $group: { _id: '$folderId', files: { $sum: 1 }, totalSize: { $sum: '$size' } } },
    { $lookup: { from: 'folders', localField: '_id', foreignField: '_id', as: 'folder' } },
    { $unwind: '$folder' },
    { $match: { 'folder.deletedAt': null } },
    { $sort: { files: -1, totalSize: -1, _id: 1 } },
    { $limit: limit },
    lookupUser('folder.ownerId', 'owner'),
    {
      $project: {
        _id: 0,
        folderId: '$_id',
        name: '$folder.name',
        owner: { $arrayElemAt: ['$owner.name', 0] },
        files: 1,
        totalSize: 1,
      },
    },
  ]);
}

// ---------- Usuarios ----------

// Usuarios con mayor cantidad de archivos almacenados
async function topUsersByFiles({ limit, includeTrash }) {
  return File.aggregate([
    { $match: includeTrash ? {} : { deletedAt: null } },
    { $group: { _id: '$ownerId', files: { $sum: 1 }, totalSize: { $sum: '$size' } } },
    { $sort: { files: -1, totalSize: -1 } },
    { $limit: limit },
    lookupUser('_id', 'user'),
    {
      $project: {
        _id: 0,
        userId: '$_id',
        name: { $arrayElemAt: ['$user.name', 0] },
        email: { $arrayElemAt: ['$user.email', 0] },
        files: 1,
        totalSize: 1,
      },
    },
  ]);
}

// Usuarios con mayor cantidad de recursos compartidos (archivos y carpetas distintos)
async function topUsersByShares({ limit }) {
  return Share.aggregate([
    // Primero se agrupa por recurso, luego por propietario
    {
      $group: {
        _id: { ownerId: '$ownerId', resourceType: '$resourceType', resourceId: '$resourceId' },
        recipients: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.ownerId',
        resources: { $sum: 1 },
        permissionsGranted: { $sum: '$recipients' },
      },
    },
    { $sort: { resources: -1, permissionsGranted: -1 } },
    { $limit: limit },
    lookupUser('_id', 'user'),
    {
      $project: {
        _id: 0,
        userId: '$_id',
        name: { $arrayElemAt: ['$user.name', 0] },
        email: { $arrayElemAt: ['$user.email', 0] },
        resources: 1,
        permissionsGranted: 1,
      },
    },
  ]);
}

// ---------- Comparticion ----------

// Archivos compartidos con mayor cantidad de usuarios
async function mostSharedFiles({ limit }) {
  return Share.aggregate([
    { $match: { resourceType: 'file' } },
    { $group: { _id: '$resourceId', users: { $sum: 1 } } },
    { $sort: { users: -1, _id: 1 } },
    { $limit: limit },
    { $lookup: { from: 'files', localField: '_id', foreignField: '_id', as: 'file' } },
    { $unwind: '$file' },
    lookupUser('file.ownerId', 'owner'),
    {
      $project: {
        _id: 0,
        fileId: '$_id',
        name: '$file.name',
        ext: '$file.ext',
        owner: { $arrayElemAt: ['$owner.name', 0] },
        users: 1,
        status: {
          $cond: [
            { $ne: [{ $ifNull: ['$file.deletedAt', null] }, null] },
            'en papelera',
            'activo',
          ],
        },
      },
    },
  ]);
}

// Recursos compartidos por un usuario (side 'by') o recibidos por un usuario (side 'with')
async function sharesList({ side, userId, dateFilter, permission, resourceType }) {
  const match = { [side === 'by' ? 'ownerId' : 'sharedWithId']: userId };
  if (permission) match.permission = permission;
  if (resourceType) match.resourceType = resourceType;
  if (dateFilter) match.createdAt = dateFilter;

  return Share.aggregate([
    { $match: match },
    lookupUser('ownerId', 'owner'),
    lookupUser('sharedWithId', 'recipient'),
    { $lookup: { from: 'files', localField: 'resourceId', foreignField: '_id', as: 'fileDoc' } },
    { $lookup: { from: 'folders', localField: 'resourceId', foreignField: '_id', as: 'folderDoc' } },
    {
      $addFields: {
        resource: {
          $cond: [
            { $eq: ['$resourceType', 'file'] },
            { $arrayElemAt: ['$fileDoc', 0] },
            { $arrayElemAt: ['$folderDoc', 0] },
          ],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $project: {
        _id: 0,
        shareId: '$_id',
        resourceType: 1,
        resourceId: 1,
        resourceName: '$resource.name',
        resourceStatus: {
          $cond: [
            { $eq: [{ $ifNull: ['$resource._id', null] }, null] },
            'eliminado',
            {
              $cond: [
                { $ne: [{ $ifNull: ['$resource.deletedAt', null] }, null] },
                'en papelera',
                'activo',
              ],
            },
          ],
        },
        owner: { $arrayElemAt: ['$owner.name', 0] },
        sharedWith: { $arrayElemAt: ['$recipient.name', 0] },
        sharedWithEmail: { $arrayElemAt: ['$recipient.email', 0] },
        permission: 1,
        createdAt: 1,
      },
    },
  ]);
}

// ---------- Actividad ----------

// Filtro comun del historial: usuario, rango de fechas y accion (todos opcionales)
function activityMatch({ userId, dateFilter, action }) {
  const match = {};
  if (userId) match.userId = userId;
  if (dateFilter) match.createdAt = dateFilter;
  if (action) match.action = action;
  return match;
}

// Historial de actividad de un usuario dentro de un rango de fechas
async function userActivity({ userId, dateFilter, action, limit }) {
  const [result] = await ActivityLog.aggregate([
    { $match: activityMatch({ userId, dateFilter, action }) },
    {
      $facet: {
        total: [{ $count: 'n' }],
        items: [
          { $sort: { createdAt: -1 } },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              action: 1,
              resourceType: 1,
              resourceId: 1,
              resourceName: 1,
              details: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
  ]);
  return { total: result.total.length > 0 ? result.total[0].n : 0, items: result.items };
}

// Cantidad de operaciones agrupadas por tipo
async function operationsByType({ userId, dateFilter }) {
  return ActivityLog.aggregate([
    { $match: activityMatch({ userId, dateFilter }) },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $project: { _id: 0, action: '$_id', count: 1 } },
  ]);
}

// Cantidad de operaciones agrupadas por periodo (dia, semana o mes, en hora de Guatemala)
async function operationsByPeriod({ userId, dateFilter, period }) {
  return ActivityLog.aggregate([
    { $match: activityMatch({ userId, dateFilter }) },
    {
      $group: {
        _id: { $dateToString: { format: PERIOD_FORMATS[period], date: '$createdAt', timezone: TIMEZONE } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, period: '$_id', count: 1 } },
  ]);
}

// Principales acciones del sistema, con su porcentaje sobre el total
async function topActions({ userId, dateFilter, limit }) {
  const [result] = await ActivityLog.aggregate([
    { $match: activityMatch({ userId, dateFilter }) },
    {
      $facet: {
        total: [{ $count: 'n' }],
        top: [
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: limit },
          { $project: { _id: 0, action: '$_id', count: 1 } },
        ],
      },
    },
  ]);

  const total = result.total.length > 0 ? result.total[0].n : 0;
  const items = result.top.map((t) => ({
    ...t,
    percentage: total > 0 ? Math.round((t.count * 1000) / total) / 10 : 0,
  }));
  return { total, items };
}

module.exports = {
  filesByType,
  filesByDate,
  filesMostOperations,
  topUsersByFiles,
  topUsersByShares,
  neverSharedFiles,
  foldersMostFiles,
  mostSharedFiles,
  sharesList,
  userActivity,
  operationsByType,
  operationsByPeriod,
  topActions,
};
