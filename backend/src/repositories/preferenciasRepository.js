'use strict';

function buscarPreferencias(db, usuarioId) {
  const row = db
    .prepare('SELECT meta_calorica FROM preferencia_usuario WHERE usuario_id = ?')
    .get(usuarioId);

  const categorias_ativas = db
    .prepare('SELECT categoria FROM preferencia_categorias_ativas WHERE usuario_id = ? ORDER BY categoria')
    .all(usuarioId)
    .map((r) => r.categoria);

  const restricoes = db
    .prepare('SELECT restricao FROM preferencia_restricoes WHERE usuario_id = ? ORDER BY restricao')
    .all(usuarioId)
    .map((r) => r.restricao);

  return {
    categorias_ativas,
    restricoes,
    meta_calorica: row.meta_calorica,
  };
}

function atualizarPreferencias(db, usuarioId, dados) {
  const tx = db.transaction((d) => {
    if (d.meta_calorica !== undefined) {
      db.prepare('UPDATE preferencia_usuario SET meta_calorica = ? WHERE usuario_id = ?').run(
        d.meta_calorica,
        usuarioId
      );
    }

    if (d.categorias_ativas !== undefined) {
      db.prepare('DELETE FROM preferencia_categorias_ativas WHERE usuario_id = ?').run(usuarioId);
      const inserir = db.prepare(
        'INSERT INTO preferencia_categorias_ativas (usuario_id, categoria) VALUES (?, ?)'
      );
      d.categorias_ativas.forEach((categoria) => inserir.run(usuarioId, categoria));
    }

    if (d.restricoes !== undefined) {
      db.prepare('DELETE FROM preferencia_restricoes WHERE usuario_id = ?').run(usuarioId);
      const inserir = db.prepare(
        'INSERT INTO preferencia_restricoes (usuario_id, restricao) VALUES (?, ?)'
      );
      d.restricoes.forEach((restricao) => inserir.run(usuarioId, restricao));
    }
  });

  tx(dados);
  return buscarPreferencias(db, usuarioId);
}

module.exports = { buscarPreferencias, atualizarPreferencias };
