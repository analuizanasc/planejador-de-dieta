'use strict';

const { buscarReceitaPorId } = require('./receitasRepository');
const { diaAnterior } = require('../utils/datas');

const ORDEM_CATEGORIA = "CASE categoria WHEN 'cafe' THEN 1 WHEN 'almoco' THEN 2 WHEN 'jantar' THEN 3 WHEN 'lanche' THEN 4 END";

function montarEntrada(db, usuarioId, row) {
  return {
    dia: row.dia,
    categoria: row.categoria,
    receita: buscarReceitaPorId(db, usuarioId, row.receita_id),
    origem: row.origem,
  };
}

// Mapa categoria -> receita_id usado no dia imediatamente anterior a `primeiroDia`,
// necessário para o algoritmo respeitar RN1 na fronteira do período gerado.
function obterHistoricoAnterior(db, usuarioId, primeiroDia) {
  const dataAnterior = diaAnterior(primeiroDia);
  const rows = db
    .prepare('SELECT categoria, receita_id FROM cardapio WHERE usuario_id = ? AND dia = ?')
    .all(usuarioId, dataAnterior);
  return Object.fromEntries(rows.map((r) => [r.categoria, r.receita_id]));
}

function persistirCardapio(db, usuarioId, entradas) {
  const upsert = db.prepare(`
    INSERT INTO cardapio (usuario_id, dia, categoria, receita_id, origem) VALUES (?, ?, ?, ?, 'gerado')
    ON CONFLICT(usuario_id, dia, categoria) DO UPDATE SET receita_id = excluded.receita_id, origem = excluded.origem
  `);
  const tx = db.transaction((itens) => {
    for (const item of itens) {
      upsert.run(usuarioId, item.dia, item.categoria, item.receita.id);
    }
  });
  tx(entradas);
}

function upsertManual(db, usuarioId, dia, categoria, receitaId) {
  db.prepare(
    `INSERT INTO cardapio (usuario_id, dia, categoria, receita_id, origem) VALUES (?, ?, ?, ?, 'manual')
     ON CONFLICT(usuario_id, dia, categoria) DO UPDATE SET receita_id = excluded.receita_id, origem = excluded.origem`
  ).run(usuarioId, dia, categoria, receitaId);

  const row = db
    .prepare('SELECT * FROM cardapio WHERE usuario_id = ? AND dia = ? AND categoria = ?')
    .get(usuarioId, dia, categoria);
  return montarEntrada(db, usuarioId, row);
}

function buscarPorIntervalo(db, usuarioId, dataInicio, dataFim) {
  const rows = db
    .prepare(
      `SELECT * FROM cardapio WHERE usuario_id = ? AND dia BETWEEN ? AND ? ORDER BY dia, ${ORDEM_CATEGORIA}`
    )
    .all(usuarioId, dataInicio, dataFim);
  return rows.map((row) => montarEntrada(db, usuarioId, row));
}

module.exports = {
  obterHistoricoAnterior,
  persistirCardapio,
  upsertManual,
  buscarPorIntervalo,
};
