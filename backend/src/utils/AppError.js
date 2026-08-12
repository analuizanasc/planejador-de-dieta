'use strict';

class AppError extends Error {
  constructor(statusCode, message, detalhes) {
    super(message);
    this.statusCode = statusCode;
    this.detalhes = detalhes;
  }
}

module.exports = AppError;
