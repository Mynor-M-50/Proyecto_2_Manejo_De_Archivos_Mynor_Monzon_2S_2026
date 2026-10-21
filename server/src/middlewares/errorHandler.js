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
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'El contenido enviado es demasiado grande';
  } else if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      message = 'El archivo supera el tamano maximo de 5 MB';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      message = 'Envia el archivo en el campo "file" y un solo archivo por peticion';
    } else {
      status = 400;
    }
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
