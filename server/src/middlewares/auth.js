const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Verifica el token JWT y carga al usuario en req.user
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Token requerido', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw new AppError('Token invalido o expirado', 401);
  }

  // Se consulta la base para detectar usuarios desactivados despues de emitir el token
  const user = await User.findById(payload.sub).select('name email role active');
  if (!user || !user.active) {
    throw new AppError('Usuario no autorizado', 401);
  }

  req.user = { id: user._id, name: user.name, email: user.email, role: user.role };
  next();
});

// Restringe una ruta a ciertos roles. Se usa despues de authenticate
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('No tienes permiso para realizar esta accion', 403));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
