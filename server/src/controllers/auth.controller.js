const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { serializeUser } = require('../utils/serializers');
const { logActivity } = require('../services/activity.service');

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new AppError('Correo y contrasena son obligatorios', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  const passwordOk = user && (await bcrypt.compare(password, user.passwordHash));
  if (!passwordOk) {
    throw new AppError('Credenciales invalidas', 401);
  }
  if (!user.active) {
    throw new AppError('El usuario esta inactivo', 403);
  }

  const token = jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: String(user._id),
    expiresIn: env.jwtExpiresIn,
  });

  await logActivity({
    userId: user._id,
    action: 'auth.login',
    resourceType: 'user',
    resourceId: user._id,
    resourceName: user.name,
  });

  res.json({ token, user: serializeUser(user) });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: serializeUser(user) });
});

module.exports = { login, me };
