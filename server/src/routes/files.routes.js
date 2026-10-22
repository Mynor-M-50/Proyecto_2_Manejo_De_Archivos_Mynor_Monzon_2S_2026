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
const { listComments, createComment, deleteComment } = require('../controllers/comments.controller');
const { trashFile } = require('../controllers/trash.controller');
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
router.delete('/:id', trashFile);

router.get('/:id/comments', listComments);
router.post('/:id/comments', createComment);
router.delete('/:id/comments/:commentId', deleteComment);

module.exports = router;
