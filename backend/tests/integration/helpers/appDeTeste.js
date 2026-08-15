'use strict';

const { criarConexao } = require('../../../src/db/connection');
const criarApp = require('../../../src/app');

// Cada chamada abre um banco SQLite em memória isolado (NODE_ENV=test, ver
// src/db/connection.js) e monta uma instância de app nova — testes não
// compartilham estado entre si.
// `opcoes` é repassado a criarApp (ex.: { importadorDeps: { importador } }
// para injetar um importador fake na rota de importação do Instagram).
function criarAppDeTeste(opcoes = {}) {
  const db = criarConexao();
  const app = criarApp(db, opcoes);
  return { app, db };
}

module.exports = { criarAppDeTeste };
