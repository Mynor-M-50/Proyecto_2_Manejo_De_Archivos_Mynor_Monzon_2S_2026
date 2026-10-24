const mongoose = require('mongoose');
const AppError = require('./AppError');

// Entero entre 1 y max; si no viene, usa el valor por defecto
function parseLimit(value, defaultValue, max) {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new AppError('limit debe ser un entero entre 1 y ' + max, 400);
  }
  return n;
}

// Las agregaciones no convierten ids automaticamente, por eso se crea el ObjectId a mano
function parseObjectId(value, label) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new AppError(label + ' no es un identificador valido', 400);
  }
  return new mongoose.Types.ObjectId(value);
}

// 'true' o '1' es verdadero; cualquier otro valor, falso
function parseBoolean(value) {
  return value === 'true' || value === '1';
}

// Devuelve el valor si esta en la lista permitida, undefined si no viene, o error si es otro
function parseEnum(value, allowed, label) {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw new AppError(label + ' debe ser uno de: ' + allowed.join(', '), 400);
  }
  return value;
}

module.exports = { parseLimit, parseObjectId, parseBoolean, parseEnum };
