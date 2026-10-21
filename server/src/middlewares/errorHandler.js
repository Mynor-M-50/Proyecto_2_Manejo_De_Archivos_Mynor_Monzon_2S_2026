const AppError = require('../utils/AppError');

// Ruta que no existe
function notFound(req, res, next) {
  next(new AppError('Ruta no encontrada', 404));
}

// Manejador global de errores: siempre responde { message }
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Error interno del servidor';

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'El cuerpo de la peticion no es un JSON valido';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Identificador invalido';
  } else if (err.name === 'ValidationError') {
    status = 400;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Ya existe un registro con esos datos';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Error interno del servidor';
  }

  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
