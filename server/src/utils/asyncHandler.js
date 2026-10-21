// Envuelve un controlador async para que cualquier error llegue al manejador de errores
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
