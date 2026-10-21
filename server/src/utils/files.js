const AppError = require('./AppError');
const { cleanName } = require('./validators');

const ALLOWED_EXTENSIONS = ['txt', 'md'];
const MIME_BY_EXT = { txt: 'text/plain', md: 'text/markdown' };

// Valida el nombre de un archivo y devuelve su extension y tipo MIME
function parseFileName(value) {
  const name = cleanName(value, 'El nombre del archivo');
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) {
    throw new AppError('El nombre debe incluir una extension .txt o .md', 400);
  }
  const ext = name.slice(dot + 1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new AppError('Solo se permiten archivos .txt y .md', 400);
  }
  return { name, ext, mimeType: MIME_BY_EXT[ext] };
}

// multer lee el nombre como latin1; si en realidad venia en UTF-8 (tildes, enie) lo corrige
function fixFilename(originalname) {
  if (/[^\u0000-\u00ff]/.test(originalname)) {
    return originalname;
  }
  const fixed = Buffer.from(originalname, 'latin1').toString('utf8');
  return fixed.includes('\uFFFD') ? originalname : fixed;
}

// Rechaza contenido binario: los archivos permitidos son de texto
function assertTextBuffer(buffer) {
  if (buffer.includes(0)) {
    throw new AppError('El archivo no parece ser de texto', 400);
  }
}

module.exports = { ALLOWED_EXTENSIONS, parseFileName, fixFilename, assertTextBuffer };
