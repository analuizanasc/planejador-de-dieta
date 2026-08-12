'use strict';

const { scryptSync, randomBytes, timingSafeEqual } = require('node:crypto');

const KEYLEN = 64;

function hashSenha(senhaPlana) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senhaPlana, salt, KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verificarSenha(senhaPlana, senhaHash) {
  const [salt, hashArmazenado] = senhaHash.split(':');
  const hashCalculado = scryptSync(senhaPlana, salt, KEYLEN);
  const bufArmazenado = Buffer.from(hashArmazenado, 'hex');
  if (bufArmazenado.length !== hashCalculado.length) return false;
  return timingSafeEqual(bufArmazenado, hashCalculado);
}

module.exports = { hashSenha, verificarSenha };
