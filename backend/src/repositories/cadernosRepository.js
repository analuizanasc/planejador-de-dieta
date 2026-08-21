'use strict';

function montar(row) {
  if (!row) return null;
  return { id: row.id, nome: row.nome };
}

function listarCadernos(db, usuarioId) {
  return db
    .prepare('SELECT id, nome FROM cadernos WHERE usuario_id = ? ORDER BY nome COLLATE NOCASE')
    .all(usuarioId)
    .map(montar);
}

function buscarCadernoPorId(db, usuarioId, id) {
  return montar(
    db.prepare('SELECT id, nome FROM cadernos WHERE id = ? AND usuario_id = ?').get(id, usuarioId)
  );
}

function criarCaderno(db, usuarioId, dados) {
  const info = db
    .prepare('INSERT INTO cadernos (usuario_id, nome) VALUES (?, ?)')
    .run(usuarioId, dados.nome);
  return buscarCadernoPorId(db, usuarioId, info.lastInsertRowid);
}

function deletarCaderno(db, usuarioId, id) {
  // ON DELETE SET NULL desvincula as receitas; o caderno some, as receitas ficam.
  const info = db.prepare('DELETE FROM cadernos WHERE id = ? AND usuario_id = ?').run(id, usuarioId);
  return info.changes > 0;
}

module.exports = {
  listarCadernos,
  buscarCadernoPorId,
  criarCaderno,
  deletarCaderno,
};
