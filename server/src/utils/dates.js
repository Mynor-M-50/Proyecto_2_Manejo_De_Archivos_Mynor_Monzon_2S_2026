const AppError = require('./AppError');

// Guatemala no usa horario de verano: siempre es UTC-6
const GT_OFFSET = '-06:00';
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// JavaScript acepta fechas como 2026-02-30 y las corre al mes siguiente; aqui se rechazan
function isRealCalendarDate(text) {
  const [year, month, day] = text.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

// Convierte un limite del rango. "2026-10-05" se toma como el dia completo en hora de Guatemala;
// un valor con hora (2026-10-05T14:30:00Z) se toma tal cual.
function parseBound(value, label, isEnd) {
  if (value === undefined || value === '') {
    return null;
  }
  const text = String(value);
  const dateOnly = DATE_ONLY.test(text);

  if (dateOnly && !isRealCalendarDate(text)) {
    throw new AppError(label + ' no es una fecha valida (usa AAAA-MM-DD)', 400);
  }

  let date = dateOnly ? new Date(text + 'T00:00:00' + GT_OFFSET) : new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(label + ' no es una fecha valida (usa AAAA-MM-DD)', 400);
  }
  // El dia final se incluye completo: el limite es el inicio del dia siguiente (exclusivo)
  if (dateOnly && isEnd) {
    date = new Date(date.getTime() + DAY_MS);
  }
  return { date, exclusive: dateOnly && isEnd };
}

// Arma el filtro de fechas de MongoDB a partir de ?from=&to=. Devuelve null si no hay rango.
function buildDateFilter(query) {
  const from = parseBound(query.from, 'from', false);
  const to = parseBound(query.to, 'to', true);

  if (from && to && from.date.getTime() >= to.date.getTime()) {
    throw new AppError('La fecha from debe ser anterior a to', 400);
  }

  const filter = {};
  if (from) {
    filter.$gte = from.date;
  }
  if (to) {
    filter[to.exclusive ? '$lt' : '$lte'] = to.date;
  }
  return Object.keys(filter).length > 0 ? filter : null;
}

module.exports = { buildDateFilter };
