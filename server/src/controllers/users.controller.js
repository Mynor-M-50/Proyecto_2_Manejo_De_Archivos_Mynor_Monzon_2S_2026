const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { serializeUser } = require('../utils/serializers');
const { cleanPersonName, cleanEmail, cleanPassword } = require('../utils/validators');
const { logActivity } = require('../services/activity.service');

const ROLES = ['admin', 'user'];
const MB = 1024 * 1024;
const MIN_QUOTA = 1 * MB;
const MAX_QUOTA = 10 * 1024 * MB;

// Valida el espacio asignado (bytes, entero entre 1 MB y 10 GB)
function parseQuota(value) {
  const quota = Number(value);
  if (!Number.isInteger(quota) || quota < MIN_QUOTA || quota > MAX_QUOTA) {
    throw new AppError('El espacio asignado debe estar entre 1 MB y 10 GB', 400);
  }
  return quota;
}

// Registra en el historial una accion del administrador sobre un usuario
function logUserAction(req, action, target, details) {
  return logActivity({
    userId: req.user.id,
    action,
    resourceType: 'user',
    resourceId: target._id,
    resourceName: target.name,
    details,
  });
}

// GET /api/users?search=&role=&active=
const listUsers = asyncHandler(async (req, res) => {
  const { search, role, active } = req.query;
  const filter = {};

  if (role) {
    if (!ROLES.includes(role)) {
      throw new AppError('Rol invalido', 400);
    }
    filter.role = role;
  }
  if (active === 'true' || active === 'false') {
    filter.active = active === 'true';
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const users = await User.find(filter).sort({ createdAt: 1 });
  res.json({ users: users.map(serializeUser) });
});

// POST /api/users
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, storageQuota } = req.body || {};

  const cleanName = cleanPersonName(name);
  const normalizedEmail = cleanEmail(email);
  const cleanPass = cleanPassword(password);
  const finalRole = role === undefined ? 'user' : role;
  if (!ROLES.includes(finalRole)) {
    throw new AppError('Rol invalido', 400);
  }
  const quota = storageQuota === undefined ? undefined : parseQuota(storageQuota);

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new AppError('Ya existe un usuario con ese correo', 409);
  }

  const user = await User.create({
    name: cleanName,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(cleanPass, 10),
    role: finalRole,
    ...(quota !== undefined && { storageQuota: quota }),
  });

  await logUserAction(req, 'user.create', user, { email: user.email, role: user.role });
  res.status(201).json({ user: serializeUser(user) });
});

// PUT /api/users/:id  (nombre, rol, contrasena y/o espacio asignado)
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  const { name, role, password, storageQuota } = req.body || {};
  const changed = [];

  if (name !== undefined) {
    user.name = cleanPersonName(name);
    changed.push('name');
  }

  if (role !== undefined) {
    if (!ROLES.includes(role)) {
      throw new AppError('Rol invalido', 400);
    }
    // Evita que el administrador se quite el acceso a si mismo
    if (String(user._id) === String(req.user.id) && role !== 'admin') {
      throw new AppError('No puedes quitarte el rol de administrador', 400);
    }
    user.role = role;
    changed.push('role');
  }

  if (password !== undefined) {
    user.passwordHash = await bcrypt.hash(cleanPassword(password), 10);
    changed.push('password');
  }

  if (storageQuota !== undefined) {
    const quota = parseQuota(storageQuota);
    if (quota < user.storageUsed) {
      throw new AppError('El espacio asignado no puede ser menor al espacio que el usuario ya usa', 400);
    }
    user.storageQuota = quota;
    changed.push('storageQuota');
  }

  if (changed.length === 0) {
    throw new AppError('No hay cambios para aplicar', 400);
  }

  await user.save();
  await logUserAction(req, 'user.update', user, { fields: changed });
  res.json({ user: serializeUser(user) });
});

// PATCH /api/users/:id/active  (activar o desactivar, sin borrar nada)
const setActive = asyncHandler(async (req, res) => {
  const { active } = req.body || {};
  if (typeof active !== 'boolean') {
    throw new AppError('El campo active debe ser true o false', 400);
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }
  if (String(user._id) === String(req.user.id) && !active) {
    throw new AppError('No puedes desactivar tu propia cuenta', 400);
  }

  user.active = active;
  await user.save();

  await logUserAction(req, active ? 'user.activate' : 'user.deactivate', user);
  res.json({ user: serializeUser(user) });
});

module.exports = { listUsers, createUser, updateUser, setActive };
