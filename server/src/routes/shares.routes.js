const express = require('express');
const {
  createShare,
  listResourceShares,
  sharedByMe,
  sharedWithMe,
  updateShare,
  removeShare,
} = require('../controllers/shares.controller');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listResourceShares);
router.get('/by-me', sharedByMe);
router.get('/with-me', sharedWithMe);
router.post('/', createShare);
router.patch('/:id', updateShare);
router.delete('/:id', removeShare);

module.exports = router;
