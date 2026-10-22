const express = require('express');
const c = require('../controllers/reports.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', c.catalog);

// Reportes globales: solo administrador
router.get('/files-by-type', requireRole('admin'), c.filesByType);
router.get('/files-by-date', requireRole('admin'), c.filesByDate);
router.get('/files-most-operations', requireRole('admin'), c.filesMostOperations);
router.get('/top-users-by-files', requireRole('admin'), c.topUsersByFiles);
router.get('/top-users-by-shares', requireRole('admin'), c.topUsersByShares);
router.get('/most-shared-files', requireRole('admin'), c.mostSharedFiles);

// Reportes por usuario: el administrador consulta a cualquiera, un usuario solo lo suyo
router.get('/shared-by-user', c.sharedByUser);
router.get('/shared-with-user', c.sharedWithUser);
router.get('/user-activity', c.userActivity);
router.get('/operations-by-type', c.operationsByType);
router.get('/operations-by-period', c.operationsByPeriod);
router.get('/top-actions', c.topActions);

module.exports = router;
