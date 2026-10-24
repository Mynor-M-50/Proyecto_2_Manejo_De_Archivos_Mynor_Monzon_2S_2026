const AppError = require('./AppError');

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD = 6;
// bcrypt solo usa los primeros 72 bytes de la contrasena
const MAX_PASSWORD_BYTES = 72;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Caracteres de control (saltos de linea, tabuladores, nulos, etc.)
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

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
  if (CONTROL_CHARS.test(name)) {
    throw new AppError(label + ' contiene caracteres no permitidos', 400);
  }
  if (name === '.' || name === '..') {
    throw new AppError(label + ' no es valido', 400);
  }
  return name;
}

// Nombre de una persona: texto, sin caracteres de control y de largo acotado
function cleanPersonName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) {
    throw new AppError('El nombre es obligatorio', 400);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new AppError('El nombre no puede superar ' + MAX_NAME_LENGTH + ' caracteres', 400);
  }
  if (CONTROL_CHARS.test(name)) {
    throw new AppError('El nombre contiene caracteres no permitidos', 400);
  }
  return name;
}

// Correo en minusculas y con formato valido (usuario@dominio.ext)
function cleanEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    throw new AppError('El correo no es valido', 400);
  }
  return email;
}

// Contrasena entre 6 caracteres y 72 bytes (limite de bcrypt)
function cleanPassword(value) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD) {
    throw new AppError('La contrasena debe tener al menos ' + MIN_PASSWORD + ' caracteres', 400);
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new AppError('La contrasena es demasiado larga (maximo ' + MAX_PASSWORD_BYTES + ' bytes)', 400);
  }
  return value;
}

module.exports = { cleanName, cleanPersonName, cleanEmail, cleanPassword };
