const express = require('express');
const {
  uploadFile,
  listFiles,
  getFile,
  getContent,
  downloadFile,
  updateContent,
  renameFile,
  moveFile,
} = require('../controllers/files.controller');
const { authenticate } = require('../middlewares/auth');
const { upload } = require('../utils/upload');

const router = express.Router();

router.use(authenticate);

router.get('/', listFiles);
router.post('/', upload.single('file'), uploadFile);
router.get('/:id', getFile);
router.get('/:id/content', getContent);
router.get('/:id/download', downloadFile);
router.put('/:id/content', updateContent);
router.patch('/:id/rename', renameFile);
router.patch('/:id/move', moveFile);

module.exports = router;
