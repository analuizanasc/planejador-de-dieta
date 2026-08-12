'use strict';

const PREFERENCIA_ID = 1;

function buscarPreferencias(db) {
  const row = db
    .prepare('SELECT meta_calorica FROM preferencia_usuario WHERE id = ?')
    .get(PREFERENCIA_ID);

  const categorias_ativas = db
    .prepare('SELECT categoria FROM preferencia_categorias_ativas WHERE preferencia_id = ? ORDER BY categoria')
    .all(PREFERENCIA_ID)
    .map((r) => r.categoria);

  const restricoes = db
    .prepare('SELECT restricao FROM preferencia_restricoes WHERE preferencia_id = ? ORDER BY restricao')
    .all(PREFERENCIA_ID)
    .map((r) => r.restricao);

  return {
    categorias_ativas,
    restricoes,
    meta_calorica: row.meta_calorica,
  };
}

function atualizarPreferencias(db, dados) {
  const tx = db.transaction((d) => {
    if (d.meta_calorica !== undefined) {
      db.prepare('UPDATE preferencia_usuario SET meta_calorica = ? WHERE id = ?').run(
        d.meta_calorica,
        PREFERENCIA_ID
      );
    }

    if (d.categorias_ativas !== undefined) {
      db.prepare('DELETE FROM preferencia_categorias_ativas WHERE preferencia_id = ?').run(
        PREFERENCIA_ID
      );
      const inserir = db.prepare(
        'INSERT INTO preferencia_categorias_ativas (preferencia_id, categoria) VALUES (?, ?)'
      );
      d.categorias_ativas.forEach((categoria) => inserir.run(PREFERENCIA_ID, categoria));
    }

    if (d.restricoes !== undefined) {
      db.prepare('DELETE FROM preferencia_restricoes WHERE preferencia_id = ?').run(PREFERENCIA_ID);
      const inserir = db.prepare(
        'INSERT INTO preferencia_restricoes (preferencia_id, restricao) VALUES (?, ?)'
      );
      d.restricoes.forEach((restricao) => inserir.run(PREFERENCIA_ID, restricao));
    }
  });

  tx(dados);
  return buscarPreferencias(db);
}

module.exports = { buscarPreferencias, atualizarPreferencias };
