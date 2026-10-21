const express = require('express');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const foldersRoutes = require('./folders.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/folders', foldersRoutes);

module.exports = router;
