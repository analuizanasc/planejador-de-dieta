'use strict';

function montarCompleta(db, row) {
  if (!row) return null;
  const categorias = db
    .prepare('SELECT categoria FROM receita_categorias WHERE receita_id = ? ORDER BY categoria')
    .all(row.id)
    .map((r) => r.categoria);
  const ingredientes = db
    .prepare('SELECT ingrediente FROM receita_ingredientes WHERE receita_id = ? ORDER BY ordem')
    .all(row.id)
    .map((r) => r.ingrediente);
  const tags_restricao = db
    .prepare('SELECT restricao FROM receita_restricoes WHERE receita_id = ? ORDER BY restricao')
    .all(row.id)
    .map((r) => r.restricao);

  return {
    id: row.id,
    caderno_id: row.caderno_id ?? null,
    nome: row.nome,
    categorias,
    calorias: row.calorias ?? null,
    modo_preparo: row.modo_preparo ?? null,
    imagem_url: row.imagem_url ?? null,
    ingredientes,
    tags_restricao,
    permite_repeticao: Boolean(row.permite_repeticao),
  };
}

function listarReceitas(db, usuarioId, { categoria, caderno_id } = {}) {
  let sql = 'SELECT * FROM receitas WHERE usuario_id = ?';
  const params = [usuarioId];
  if (categoria) {
    sql +=
      ' AND EXISTS (SELECT 1 FROM receita_categorias rc WHERE rc.receita_id = receitas.id AND rc.categoria = ?)';
    params.push(categoria);
  }
  if (caderno_id !== undefined) {
    // caderno_id === null → receitas sem caderno (avulsas).
    sql += caderno_id === null ? ' AND caderno_id IS NULL' : ' AND caderno_id = ?';
    if (caderno_id !== null) params.push(caderno_id);
  }
  sql += ' ORDER BY id';
  return db
    .prepare(sql)
    .all(...params)
    .map((row) => montarCompleta(db, row));
}

function buscarReceitaPorId(db, usuarioId, id) {
  const row = db.prepare('SELECT * FROM receitas WHERE id = ? AND usuario_id = ?').get(id, usuarioId);
  return montarCompleta(db, row);
}

function criarReceita(db, usuarioId, dados) {
  const tx = db.transaction((d) => {
    const info = db
      .prepare(
        `INSERT INTO receitas
           (usuario_id, caderno_id, nome, calorias, modo_preparo, imagem_url, permite_repeticao)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        usuarioId,
        d.caderno_id ?? null,
        d.nome,
        d.calorias ?? null,
        d.modo_preparo ?? null,
        d.imagem_url ?? null,
        d.permite_repeticao ? 1 : 0
      );
    const id = info.lastInsertRowid;

    const inserirCategoria = db.prepare(
      'INSERT INTO receita_categorias (receita_id, categoria) VALUES (?, ?)'
    );
    d.categorias.forEach((categoria) => inserirCategoria.run(id, categoria));

    const inserirIngrediente = db.prepare(
      'INSERT INTO receita_ingredientes (receita_id, ingrediente, ordem) VALUES (?, ?, ?)'
    );
    d.ingredientes.forEach((ingrediente, ordem) => inserirIngrediente.run(id, ingrediente, ordem));

    const inserirRestricao = db.prepare(
      'INSERT INTO receita_restricoes (receita_id, restricao) VALUES (?, ?)'
    );
    (d.tags_restricao || []).forEach((tag) => inserirRestricao.run(id, tag));

    return id;
  });

  const id = tx(dados);
  return buscarReceitaPorId(db, usuarioId, id);
}

function atualizarReceita(db, usuarioId, id, dados) {
  const existente = db.prepare('SELECT id FROM receitas WHERE id = ? AND usuario_id = ?').get(id, usuarioId);
  if (!existente) return null;

  const tx = db.transaction((d) => {
    db.prepare(
      `UPDATE receitas
         SET caderno_id = ?, nome = ?, calorias = ?,
             modo_preparo = ?, imagem_url = ?, permite_repeticao = ?
       WHERE id = ?`
    ).run(
      d.caderno_id ?? null,
      d.nome,
      d.calorias ?? null,
      d.modo_preparo ?? null,
      d.imagem_url ?? null,
      d.permite_repeticao ? 1 : 0,
      id
    );

    db.prepare('DELETE FROM receita_categorias WHERE receita_id = ?').run(id);
    db.prepare('DELETE FROM receita_ingredientes WHERE receita_id = ?').run(id);
    db.prepare('DELETE FROM receita_restricoes WHERE receita_id = ?').run(id);

    const inserirCategoria = db.prepare(
      'INSERT INTO receita_categorias (receita_id, categoria) VALUES (?, ?)'
    );
    d.categorias.forEach((categoria) => inserirCategoria.run(id, categoria));

    const inserirIngrediente = db.prepare(
      'INSERT INTO receita_ingredientes (receita_id, ingrediente, ordem) VALUES (?, ?, ?)'
    );
    d.ingredientes.forEach((ingrediente, ordem) => inserirIngrediente.run(id, ingrediente, ordem));

    const inserirRestricao = db.prepare(
      'INSERT INTO receita_restricoes (receita_id, restricao) VALUES (?, ?)'
    );
    (d.tags_restricao || []).forEach((tag) => inserirRestricao.run(id, tag));
  });

  tx(dados);
  return buscarReceitaPorId(db, usuarioId, id);
}

function deletarReceita(db, usuarioId, id) {
  const info = db.prepare('DELETE FROM receitas WHERE id = ? AND usuario_id = ?').run(id, usuarioId);
  return info.changes > 0;
}

module.exports = {
  listarReceitas,
  buscarReceitaPorId,
  criarReceita,
  atualizarReceita,
  deletarReceita,
};
