const express = require('express');
const { listUsers, createUser, updateUser, setActive } = require('../controllers/users.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();

// Todo el modulo es solo para administradores
router.use(authenticate, requireRole('admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/active', setActive);

module.exports = router;
