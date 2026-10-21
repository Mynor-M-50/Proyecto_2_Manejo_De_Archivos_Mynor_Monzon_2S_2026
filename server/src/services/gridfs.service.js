const { once } = require('events');
const db = require('../config/db');

// Guarda un Buffer en GridFS y devuelve el id del archivo guardado
async function saveBuffer(filename, buffer, metadata) {
  const stream = db.getBucket().openUploadStream(filename, { metadata });
  stream.end(buffer);
  await once(stream, 'finish');
  return stream.id;
}

// Flujo de lectura del contenido (para descargas)
function openDownload(gridfsId) {
  return db.getBucket().openDownloadStream(gridfsId);
}

// Lee todo el contenido en memoria (archivos de texto de hasta 5 MB)
async function readBuffer(gridfsId) {
  const chunks = [];
  for await (const chunk of openDownload(gridfsId)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Borra el contenido. Si falla solo queda un fragmento sin dueno, no un archivo roto
async function removeContent(gridfsId) {
  try {
    await db.getBucket().delete(gridfsId);
  } catch (err) {
    console.error('No se pudo borrar el contenido en GridFS:', err.message);
  }
}

module.exports = { saveBuffer, openDownload, readBuffer, removeContent };
