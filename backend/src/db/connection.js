'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', 'schema.sql');

function resolverCaminhoDb() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.NODE_ENV === 'test') return ':memory:';
  return path.join(__dirname, '..', '..', 'data', 'dieta.db');
}

function schemaJaAplicado(db) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'receitas'")
    .get();
  return Boolean(row);
}

function criarConexao() {
  const caminho = resolverCaminhoDb();

  if (caminho !== ':memory:') {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new Database(caminho);
  db.pragma('foreign_keys = ON');

  if (!schemaJaAplicado(db)) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
  }

  return db;
}

module.exports = { criarConexao };
