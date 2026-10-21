const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// El archivo se recibe en memoria y luego se guarda en GridFS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

module.exports = { upload, MAX_FILE_SIZE };
