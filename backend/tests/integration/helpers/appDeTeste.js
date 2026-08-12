'use strict';

const { criarConexao } = require('../../../src/db/connection');
const criarApp = require('../../../src/app');

// Cada chamada abre um banco SQLite em memória isolado (NODE_ENV=test, ver
// src/db/connection.js) e monta uma instância de app nova — testes não
// compartilham estado entre si.
function criarAppDeTeste() {
  const db = criarConexao();
  const app = criarApp(db);
  return { app, db };
}

module.exports = { criarAppDeTeste };
