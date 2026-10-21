// Escapa los caracteres especiales para usar texto del usuario dentro de una expresion regular
module.exports = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
