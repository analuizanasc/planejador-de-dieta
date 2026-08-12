'use strict';

const jwt = require('jsonwebtoken');

const EXPIRACAO = '7d';

function gerarToken(usuarioId) {
  return jwt.sign({ usuarioId }, process.env.JWT_SECRET, { expiresIn: EXPIRACAO });
}

function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { gerarToken, verificarToken };
