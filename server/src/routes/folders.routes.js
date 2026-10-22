const express = require('express');
const {
  createFolder,
  listFolders,
  getFolder,
  renameFolder,
  moveFolder,
} = require('../controllers/folders.controller');
const { trashFolder } = require('../controllers/trash.controller');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listFolders);
router.post('/', createFolder);
router.get('/:id', getFolder);
router.patch('/:id/rename', renameFolder);
router.patch('/:id/move', moveFolder);
router.delete('/:id', trashFolder);

module.exports = router;
