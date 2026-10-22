const express = require('express');
const {
  listTrash,
  restoreFile,
  restoreFolder,
  deleteFilePermanently,
  deleteFolderPermanently,
  emptyTrash,
} = require('../controllers/trash.controller');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listTrash);
router.delete('/', emptyTrash);
router.post('/files/:id/restore', restoreFile);
router.post('/folders/:id/restore', restoreFolder);
router.delete('/files/:id', deleteFilePermanently);
router.delete('/folders/:id', deleteFolderPermanently);

module.exports = router;
