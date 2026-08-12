'use strict';

function montarCompleta(db, row) {
  if (!row) return null;
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
    nome: row.nome,
    categoria: row.categoria,
    calorias: row.calorias,
    ingredientes,
    tags_restricao,
    permite_repeticao: Boolean(row.permite_repeticao),
  };
}

function listarReceitas(db, { categoria } = {}) {
  let sql = 'SELECT * FROM receitas';
  const params = [];
  if (categoria) {
    sql += ' WHERE categoria = ?';
    params.push(categoria);
  }
  sql += ' ORDER BY id';
  return db
    .prepare(sql)
    .all(...params)
    .map((row) => montarCompleta(db, row));
}

function buscarReceitaPorId(db, id) {
  const row = db.prepare('SELECT * FROM receitas WHERE id = ?').get(id);
  return montarCompleta(db, row);
}

function criarReceita(db, dados) {
  const tx = db.transaction((d) => {
    const info = db
      .prepare(
        'INSERT INTO receitas (nome, categoria, calorias, permite_repeticao) VALUES (?, ?, ?, ?)'
      )
      .run(d.nome, d.categoria, d.calorias, d.permite_repeticao ? 1 : 0);
    const id = info.lastInsertRowid;

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
  return buscarReceitaPorId(db, id);
}

function atualizarReceita(db, id, dados) {
  const existente = db.prepare('SELECT id FROM receitas WHERE id = ?').get(id);
  if (!existente) return null;

  const tx = db.transaction((d) => {
    db.prepare(
      'UPDATE receitas SET nome = ?, categoria = ?, calorias = ?, permite_repeticao = ? WHERE id = ?'
    ).run(d.nome, d.categoria, d.calorias, d.permite_repeticao ? 1 : 0, id);

    db.prepare('DELETE FROM receita_ingredientes WHERE receita_id = ?').run(id);
    db.prepare('DELETE FROM receita_restricoes WHERE receita_id = ?').run(id);

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
  return buscarReceitaPorId(db, id);
}

function deletarReceita(db, id) {
  const info = db.prepare('DELETE FROM receitas WHERE id = ?').run(id);
  return info.changes > 0;
}

module.exports = {
  listarReceitas,
  buscarReceitaPorId,
  criarReceita,
  atualizarReceita,
  deletarReceita,
};
