PRAGMA foreign_keys = ON;

-- ============================================================
-- Usuarios
-- ============================================================

CREATE TABLE usuarios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  nome       TEXT NOT NULL,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Tabelas de domínio (enums normalizados, globais — não pertencem
-- a um usuário específico)
-- ============================================================

CREATE TABLE categorias (
  codigo TEXT PRIMARY KEY CHECK (codigo IN ('cafe', 'almoco', 'jantar', 'lanche')),
  nome   TEXT NOT NULL
);

INSERT INTO categorias (codigo, nome) VALUES
  ('cafe',    'Café da manhã'),
  ('almoco',  'Almoço'),
  ('jantar',  'Jantar'),
  ('lanche',  'Lanche');

CREATE TABLE restricoes (
  codigo TEXT PRIMARY KEY CHECK (codigo IN ('gluten', 'lactose', 'acucar_refinado')),
  nome   TEXT NOT NULL
);

INSERT INTO restricoes (codigo, nome) VALUES
  ('gluten',          'Glúten'),
  ('lactose',         'Lactose'),
  ('acucar_refinado', 'Açúcar refinado');

-- ============================================================
-- Caderno de receitas (pasta, escopada por usuário)
-- ============================================================

CREATE TABLE cadernos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  UNIQUE (usuario_id, nome)
);

CREATE INDEX idx_cadernos_usuario ON cadernos(usuario_id);

-- ============================================================
-- Receita (escopada por usuário)
-- ============================================================

CREATE TABLE receitas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  caderno_id        INTEGER REFERENCES cadernos(id) ON DELETE SET NULL,
  nome              TEXT NOT NULL,
  calorias          INTEGER CHECK (calorias IS NULL OR calorias >= 0),
  modo_preparo      TEXT,
  imagem_url        TEXT,
  permite_repeticao INTEGER NOT NULL DEFAULT 0 CHECK (permite_repeticao IN (0, 1))
);

CREATE INDEX idx_receitas_usuario ON receitas(usuario_id);
CREATE INDEX idx_receitas_caderno ON receitas(caderno_id);

-- categorias: uma receita pode pertencer a várias -> tabela associativa N:N
CREATE TABLE receita_categorias (
  receita_id INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  categoria  TEXT NOT NULL REFERENCES categorias(codigo),
  PRIMARY KEY (receita_id, categoria)
);

CREATE INDEX idx_receita_categorias_categoria ON receita_categorias(categoria);

-- ingredientes: array -> tabela filha (ordem preserva a sequência original)
CREATE TABLE receita_ingredientes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  receita_id  INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  ingrediente TEXT NOT NULL,
  ordem       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_receita_ingredientes_receita ON receita_ingredientes(receita_id);

-- tags_restricao: array -> tabela associativa N:N com restricoes
CREATE TABLE receita_restricoes (
  receita_id INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  restricao  TEXT NOT NULL REFERENCES restricoes(codigo),
  PRIMARY KEY (receita_id, restricao)
);

CREATE INDEX idx_receita_restricoes_restricao ON receita_restricoes(restricao);

-- ============================================================
-- PreferenciaUsuario (uma linha por usuário)
-- ============================================================

CREATE TABLE preferencia_usuario (
  usuario_id    INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  meta_calorica INTEGER CHECK (meta_calorica IS NULL OR meta_calorica > 0)
);

-- categorias_ativas: array -> tabela associativa N:N com categorias
CREATE TABLE preferencia_categorias_ativas (
  usuario_id INTEGER NOT NULL REFERENCES preferencia_usuario(usuario_id) ON DELETE CASCADE,
  categoria  TEXT NOT NULL REFERENCES categorias(codigo),
  PRIMARY KEY (usuario_id, categoria)
);

-- restricoes: array -> tabela associativa N:N com restricoes
CREATE TABLE preferencia_restricoes (
  usuario_id INTEGER NOT NULL REFERENCES preferencia_usuario(usuario_id) ON DELETE CASCADE,
  restricao  TEXT NOT NULL REFERENCES restricoes(codigo),
  PRIMARY KEY (usuario_id, restricao)
);

-- ============================================================
-- Cardapio (escopado por usuário)
-- ============================================================

CREATE TABLE cardapio (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia        DATE NOT NULL,
  categoria  TEXT NOT NULL REFERENCES categorias(codigo),
  receita_id INTEGER NOT NULL REFERENCES receitas(id),
  origem     TEXT NOT NULL DEFAULT 'gerado' CHECK (origem IN ('gerado', 'manual')),
  UNIQUE (usuario_id, dia, categoria)
);

CREATE INDEX idx_cardapio_usuario_dia ON cardapio(usuario_id, dia);
CREATE INDEX idx_cardapio_receita ON cardapio(receita_id);
