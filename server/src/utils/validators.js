const AppError = require('./AppError');

const MAX_NAME_LENGTH = 100;

// Limpia y valida el nombre de una carpeta o archivo
function cleanName(value, label = 'El nombre') {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) {
    throw new AppError(label + ' es obligatorio', 400);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new AppError(label + ' no puede superar ' + MAX_NAME_LENGTH + ' caracteres', 400);
  }
  if (/[\/\\]/.test(name)) {
    throw new AppError(label + ' no puede contener / ni \\', 400);
  }
  if (name === '.' || name === '..') {
    throw new AppError(label + ' no es valido', 400);
  }
  return name;
}

module.exports = { cleanName };
