PRAGMA foreign_keys = ON;

-- ============================================================
-- Tabelas de domínio (enums normalizados, reutilizados entre
-- Receita, Cardapio e PreferenciaUsuario)
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
-- Receita
-- ============================================================

CREATE TABLE receitas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nome              TEXT NOT NULL,
  categoria         TEXT NOT NULL REFERENCES categorias(codigo),
  calorias          INTEGER NOT NULL CHECK (calorias >= 0),
  permite_repeticao INTEGER NOT NULL DEFAULT 0 CHECK (permite_repeticao IN (0, 1))
);

CREATE INDEX idx_receitas_categoria ON receitas(categoria);

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
-- PreferenciaUsuario (singleton — app de usuário único)
-- ============================================================

CREATE TABLE preferencia_usuario (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  meta_calorica INTEGER CHECK (meta_calorica IS NULL OR meta_calorica > 0)
);

INSERT INTO preferencia_usuario (id, meta_calorica) VALUES (1, NULL);

-- categorias_ativas: array -> tabela associativa N:N com categorias
CREATE TABLE preferencia_categorias_ativas (
  preferencia_id INTEGER NOT NULL REFERENCES preferencia_usuario(id) ON DELETE CASCADE,
  categoria      TEXT NOT NULL REFERENCES categorias(codigo),
  PRIMARY KEY (preferencia_id, categoria)
);

-- café, almoço e jantar ativos por padrão (regra de negócio 2); lanche fica de fora até o usuário ativar
INSERT INTO preferencia_categorias_ativas (preferencia_id, categoria) VALUES
  (1, 'cafe'),
  (1, 'almoco'),
  (1, 'jantar');

-- restricoes: array -> tabela associativa N:N com restricoes
CREATE TABLE preferencia_restricoes (
  preferencia_id INTEGER NOT NULL REFERENCES preferencia_usuario(id) ON DELETE CASCADE,
  restricao      TEXT NOT NULL REFERENCES restricoes(codigo),
  PRIMARY KEY (preferencia_id, restricao)
);

-- ============================================================
-- Cardapio
-- ============================================================

CREATE TABLE cardapio (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dia        DATE NOT NULL,
  categoria  TEXT NOT NULL REFERENCES categorias(codigo),
  receita_id INTEGER NOT NULL REFERENCES receitas(id),
  UNIQUE (dia, categoria)
);

CREATE INDEX idx_cardapio_dia ON cardapio(dia);
CREATE INDEX idx_cardapio_receita ON cardapio(receita_id);
