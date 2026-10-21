const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { serializeUser } = require('../utils/serializers');
const { logActivity } = require('../services/activity.service');

const ROLES = ['admin', 'user'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

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
  const { name, email, password, role } = req.body || {};

  if (!name || !String(name).trim()) {
    throw new AppError('El nombre es obligatorio', 400);
  }
  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    throw new AppError('El correo no es valido', 400);
  }
  if (!password || String(password).length < MIN_PASSWORD) {
    throw new AppError('La contrasena debe tener al menos ' + MIN_PASSWORD + ' caracteres', 400);
  }
  const finalRole = role || 'user';
  if (!ROLES.includes(finalRole)) {
    throw new AppError('Rol invalido', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new AppError('Ya existe un usuario con ese correo', 409);
  }

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(String(password), 10),
    role: finalRole,
  });

  await logUserAction(req, 'user.create', user, { email: user.email, role: user.role });
  res.status(201).json({ user: serializeUser(user) });
});

// PUT /api/users/:id  (nombre, rol y/o contrasena)
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  const { name, role, password } = req.body || {};
  const changed = [];

  if (name !== undefined) {
    if (!String(name).trim()) {
      throw new AppError('El nombre no puede estar vacio', 400);
    }
    user.name = String(name).trim();
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
    if (String(password).length < MIN_PASSWORD) {
      throw new AppError('La contrasena debe tener al menos ' + MIN_PASSWORD + ' caracteres', 400);
    }
    user.passwordHash = await bcrypt.hash(String(password), 10);
    changed.push('password');
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
