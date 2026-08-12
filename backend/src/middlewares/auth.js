'use strict';

const AppError = require('../utils/AppError');
const { verificarToken } = require('../utils/jwt');

function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'Token de autenticação ausente'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verificarToken(token);
    req.usuarioId = payload.usuarioId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token expirado'));
    }
    return next(new AppError(401, 'Token inválido'));
  }
}

module.exports = autenticar;
