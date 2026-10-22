const express = require('express');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const foldersRoutes = require('./folders.routes');
const filesRoutes = require('./files.routes');
const trashRoutes = require('./trash.routes');
const sharesRoutes = require('./shares.routes');
const reportsRoutes = require('./reports.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/folders', foldersRoutes);
router.use('/files', filesRoutes);
router.use('/trash', trashRoutes);
router.use('/shares', sharesRoutes);
router.use('/reports', reportsRoutes);

module.exports = router;
