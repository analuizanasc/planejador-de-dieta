'use strict';

const CATEGORIAS_PADRAO = ['cafe', 'almoco', 'jantar'];

function buscarPorEmail(db, email) {
  return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email) || null;
}

function buscarPorId(db, id) {
  const row = db.prepare('SELECT id, email, nome, criado_em FROM usuarios WHERE id = ?').get(id);
  return row || null;
}

function criarUsuario(db, { email, senhaHash, nome }) {
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO usuarios (email, senha_hash, nome) VALUES (?, ?, ?)')
      .run(email, senhaHash, nome);
    const usuarioId = info.lastInsertRowid;

    db.prepare('INSERT INTO preferencia_usuario (usuario_id, meta_calorica) VALUES (?, NULL)').run(
      usuarioId
    );

    const inserirCategoria = db.prepare(
      'INSERT INTO preferencia_categorias_ativas (usuario_id, categoria) VALUES (?, ?)'
    );
    CATEGORIAS_PADRAO.forEach((categoria) => inserirCategoria.run(usuarioId, categoria));

    return usuarioId;
  });

  const usuarioId = tx();
  return buscarPorId(db, usuarioId);
}

module.exports = { buscarPorEmail, buscarPorId, criarUsuario };
