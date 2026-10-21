const ActivityLog = require('../models/ActivityLog');

// Registra una accion en el historial. Si falla, no se interrumpe la operacion principal
async function logActivity({ userId, action, resourceType, resourceId, resourceName, details }) {
  try {
    await ActivityLog.create({
      userId,
      action,
      resourceType,
      resourceId,
      resourceName: resourceName || '',
      details: details || {},
    });
  } catch (err) {
    console.error('No se pudo registrar la actividad:', err.message);
  }
}

module.exports = { logActivity };
