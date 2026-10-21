// Error con codigo HTTP para responder al cliente con un mensaje claro
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

module.exports = AppError;
