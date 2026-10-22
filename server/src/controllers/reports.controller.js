const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { buildDateFilter } = require('../utils/dates');
const { parseLimit, parseObjectId, parseBoolean, parseEnum } = require('../utils/params');
const reports = require('../services/reports.service');

const EXTENSIONS = ['txt', 'md'];
const PERMISSIONS = ['read', 'comment', 'edit'];
const RESOURCE_TYPES = ['file', 'folder'];
const PERIODS = ['day', 'week', 'month'];

// Catalogo de reportes: sirve para armar el menu del cliente segun el rol
const CATALOG = [
  { key: 'files-by-type', group: 'Archivos y almacenamiento', title: 'Cantidad de archivos por tipo', adminOnly: true, params: ['includeTrash'] },
  { key: 'files-by-date', group: 'Archivos y almacenamiento', title: 'Archivos almacenados en un rango de fechas', adminOnly: true, params: ['from', 'to', 'ownerId', 'ext', 'includeTrash', 'limit'] },
  { key: 'files-most-operations', group: 'Archivos y almacenamiento', title: 'Archivos con mayor cantidad de operaciones', adminOnly: true, params: ['from', 'to', 'limit'] },
  { key: 'top-users-by-files', group: 'Usuarios', title: 'Usuarios con mayor cantidad de archivos', adminOnly: true, params: ['limit', 'includeTrash'] },
  { key: 'top-users-by-shares', group: 'Usuarios', title: 'Usuarios con mayor cantidad de recursos compartidos', adminOnly: true, params: ['limit'] },
  { key: 'most-shared-files', group: 'Comparticion', title: 'Archivos compartidos con mayor cantidad de usuarios', adminOnly: true, params: ['limit'] },
  { key: 'shared-by-user', group: 'Comparticion', title: 'Recursos compartidos por un usuario', adminOnly: false, params: ['userId', 'from', 'to', 'permission', 'resourceType'] },
  { key: 'shared-with-user', group: 'Comparticion', title: 'Recursos recibidos por un usuario', adminOnly: false, params: ['userId', 'from', 'to', 'permission', 'resourceType'] },
  { key: 'user-activity', group: 'Actividad', title: 'Historial de actividad de un usuario', adminOnly: false, params: ['userId', 'from', 'to', 'action', 'limit'] },
  { key: 'operations-by-type', group: 'Actividad', title: 'Operaciones agrupadas por tipo', adminOnly: false, params: ['userId', 'from', 'to'] },
  { key: 'operations-by-period', group: 'Actividad', title: 'Operaciones agrupadas por periodo', adminOnly: false, params: ['userId', 'from', 'to', 'period'] },
  { key: 'top-actions', group: 'Actividad', title: 'Principales acciones del sistema', adminOnly: false, params: ['userId', 'from', 'to', 'limit'] },
];

function isAdmin(req) {
  return req.user.role === 'admin';
}

function selfId(req) {
  return new mongoose.Types.ObjectId(String(req.user.id));
}

// Usuario "seleccionado" del reporte. Si no se indica es el propio usuario;
// solo el administrador puede consultar a otros.
function targetUserId(req) {
  const requested = req.query.userId;
  if (!requested) {
    return selfId(req);
  }
  const id = parseObjectId(requested, 'userId');
  if (!isAdmin(req) && String(id) !== String(req.user.id)) {
    throw new AppError('Solo puedes consultar tu propia informacion', 403);
  }
  return id;
}

// Filtro opcional por usuario: el administrador ve a todos (o a uno si lo indica),
// un usuario normal solo ve lo suyo.
function optionalUserId(req) {
  const requested = req.query.userId;
  if (!isAdmin(req)) {
    if (requested && String(requested) !== String(req.user.id)) {
      throw new AppError('Solo puedes consultar tu propia informacion', 403);
    }
    return selfId(req);
  }
  return requested ? parseObjectId(requested, 'userId') : null;
}

// GET /api/reports
const catalog = asyncHandler(async (req, res) => {
  const items = CATALOG.filter((r) => isAdmin(req) || !r.adminOnly);
  res.json({ reports: items });
});

// ---------- Solo administrador ----------

const filesByType = asyncHandler(async (req, res) => {
  const items = await reports.filesByType({ includeTrash: parseBoolean(req.query.includeTrash) });
  res.json({ items });
});

const filesByDate = asyncHandler(async (req, res) => {
  const result = await reports.filesByDate({
    dateFilter: buildDateFilter(req.query),
    ownerId: req.query.ownerId ? parseObjectId(req.query.ownerId, 'ownerId') : null,
    ext: parseEnum(req.query.ext, EXTENSIONS, 'ext'),
    includeTrash: parseBoolean(req.query.includeTrash),
    limit: parseLimit(req.query.limit, 200, 1000),
  });
  res.json(result);
});

const filesMostOperations = asyncHandler(async (req, res) => {
  const items = await reports.filesMostOperations({
    dateFilter: buildDateFilter(req.query),
    limit: parseLimit(req.query.limit, 10, 100),
  });
  res.json({ items });
});

const topUsersByFiles = asyncHandler(async (req, res) => {
  const items = await reports.topUsersByFiles({
    limit: parseLimit(req.query.limit, 10, 100),
    includeTrash: parseBoolean(req.query.includeTrash),
  });
  res.json({ items });
});

const topUsersByShares = asyncHandler(async (req, res) => {
  const items = await reports.topUsersByShares({ limit: parseLimit(req.query.limit, 10, 100) });
  res.json({ items });
});

const mostSharedFiles = asyncHandler(async (req, res) => {
  const items = await reports.mostSharedFiles({ limit: parseLimit(req.query.limit, 10, 100) });
  res.json({ items });
});

// ---------- Administrador (cualquier usuario) o usuario (solo el suyo) ----------

function sharesReport(side) {
  return asyncHandler(async (req, res) => {
    const userId = targetUserId(req);
    const items = await reports.sharesList({
      side,
      userId,
      dateFilter: buildDateFilter(req.query),
      permission: parseEnum(req.query.permission, PERMISSIONS, 'permission'),
      resourceType: parseEnum(req.query.resourceType, RESOURCE_TYPES, 'resourceType'),
    });
    res.json({ userId, total: items.length, items });
  });
}

const sharedByUser = sharesReport('by');
const sharedWithUser = sharesReport('with');

const userActivity = asyncHandler(async (req, res) => {
  const userId = targetUserId(req);
  const result = await reports.userActivity({
    userId,
    dateFilter: buildDateFilter(req.query),
    action: req.query.action ? String(req.query.action) : undefined,
    limit: parseLimit(req.query.limit, 100, 500),
  });
  res.json({ userId, ...result });
});

const operationsByType = asyncHandler(async (req, res) => {
  const items = await reports.operationsByType({
    userId: optionalUserId(req),
    dateFilter: buildDateFilter(req.query),
  });
  res.json({ total: items.reduce((sum, i) => sum + i.count, 0), items });
});

const operationsByPeriod = asyncHandler(async (req, res) => {
  const period = parseEnum(req.query.period, PERIODS, 'period') || 'day';
  const items = await reports.operationsByPeriod({
    userId: optionalUserId(req),
    dateFilter: buildDateFilter(req.query),
    period,
  });
  res.json({ period, total: items.reduce((sum, i) => sum + i.count, 0), items });
});

const topActions = asyncHandler(async (req, res) => {
  const result = await reports.topActions({
    userId: optionalUserId(req),
    dateFilter: buildDateFilter(req.query),
    limit: parseLimit(req.query.limit, 5, 50),
  });
  res.json(result);
});

module.exports = {
  catalog,
  filesByType,
  filesByDate,
  filesMostOperations,
  topUsersByFiles,
  topUsersByShares,
  mostSharedFiles,
  sharedByUser,
  sharedWithUser,
  userActivity,
  operationsByType,
  operationsByPeriod,
  topActions,
};
