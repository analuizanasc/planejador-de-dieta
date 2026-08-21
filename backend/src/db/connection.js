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

function temColuna(db, tabela, coluna) {
  return db
    .prepare(`PRAGMA table_info(${tabela})`)
    .all()
    .some((c) => c.name === coluna);
}

// Migração idempotente para bancos criados antes das melhorias de fase 2
// (cadernos, calorias opcional, modo_preparo, imagem_url). Preserva as
// receitas já cadastradas: reconstrói a tabela `receitas` uma única vez,
// só quando o schema antigo é detectado (ausência da coluna modo_preparo).
function migrar(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cadernos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nome       TEXT NOT NULL,
      UNIQUE (usuario_id, nome)
    );
    CREATE INDEX IF NOT EXISTS idx_cadernos_usuario ON cadernos(usuario_id);
  `);

  if (!temColuna(db, 'receitas', 'modo_preparo')) {
    // SQLite não remove NOT NULL nem adiciona FK via ALTER: reconstrói a tabela.
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE receitas_nova (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          caderno_id        INTEGER REFERENCES cadernos(id) ON DELETE SET NULL,
          nome              TEXT NOT NULL,
          categoria         TEXT NOT NULL REFERENCES categorias(codigo),
          calorias          INTEGER CHECK (calorias IS NULL OR calorias >= 0),
          modo_preparo      TEXT,
          imagem_url        TEXT,
          permite_repeticao INTEGER NOT NULL DEFAULT 0 CHECK (permite_repeticao IN (0, 1))
        );
        INSERT INTO receitas_nova (id, usuario_id, nome, categoria, calorias, permite_repeticao)
          SELECT id, usuario_id, nome, categoria, calorias, permite_repeticao FROM receitas;
        DROP TABLE receitas;
        ALTER TABLE receitas_nova RENAME TO receitas;
        CREATE INDEX idx_receitas_usuario ON receitas(usuario_id);
        CREATE INDEX idx_receitas_categoria ON receitas(categoria);
        CREATE INDEX idx_receitas_caderno ON receitas(caderno_id);
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  migrarCategoriasParaNzN(db);
}

// Migra a coluna única receitas.categoria para a tabela N:N receita_categorias
// (uma receita pode ter várias categorias) e remove a coluna antiga.
// Idempotente: só age enquanto a coluna categoria ainda existir.
function migrarCategoriasParaNzN(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS receita_categorias (
      receita_id INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
      categoria  TEXT NOT NULL REFERENCES categorias(codigo),
      PRIMARY KEY (receita_id, categoria)
    );
    CREATE INDEX IF NOT EXISTS idx_receita_categorias_categoria ON receita_categorias(categoria);
  `);

  if (!temColuna(db, 'receitas', 'categoria')) return;

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      INSERT OR IGNORE INTO receita_categorias (receita_id, categoria)
        SELECT id, categoria FROM receitas;

      CREATE TABLE receitas_nova (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        caderno_id        INTEGER REFERENCES cadernos(id) ON DELETE SET NULL,
        nome              TEXT NOT NULL,
        calorias          INTEGER CHECK (calorias IS NULL OR calorias >= 0),
        modo_preparo      TEXT,
        imagem_url        TEXT,
        permite_repeticao INTEGER NOT NULL DEFAULT 0 CHECK (permite_repeticao IN (0, 1))
      );
      INSERT INTO receitas_nova (id, usuario_id, caderno_id, nome, calorias, modo_preparo, imagem_url, permite_repeticao)
        SELECT id, usuario_id, caderno_id, nome, calorias, modo_preparo, imagem_url, permite_repeticao FROM receitas;
      DROP TABLE receitas;
      ALTER TABLE receitas_nova RENAME TO receitas;
      CREATE INDEX idx_receitas_usuario ON receitas(usuario_id);
      CREATE INDEX idx_receitas_caderno ON receitas(caderno_id);
    `);
  })();
  db.pragma('foreign_keys = ON');
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
  } else {
    migrar(db);
  }

  return db;
}

module.exports = { criarConexao };
