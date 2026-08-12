'use strict';

const { buscarReceitaPorId } = require('./receitasRepository');
const { diaAnterior } = require('../utils/datas');

const ORDEM_CATEGORIA = "CASE categoria WHEN 'cafe' THEN 1 WHEN 'almoco' THEN 2 WHEN 'jantar' THEN 3 WHEN 'lanche' THEN 4 END";

function montarEntrada(db, row) {
  return {
    dia: row.dia,
    categoria: row.categoria,
    receita: buscarReceitaPorId(db, row.receita_id),
  };
}

// Mapa categoria -> receita_id usado no dia imediatamente anterior a `primeiroDia`,
// necessário para o algoritmo respeitar RN1 na fronteira do período gerado.
function obterHistoricoAnterior(db, primeiroDia) {
  const dataAnterior = diaAnterior(primeiroDia);
  const rows = db.prepare('SELECT categoria, receita_id FROM cardapio WHERE dia = ?').all(dataAnterior);
  return Object.fromEntries(rows.map((r) => [r.categoria, r.receita_id]));
}

function persistirCardapio(db, entradas) {
  const upsert = db.prepare(`
    INSERT INTO cardapio (dia, categoria, receita_id) VALUES (?, ?, ?)
    ON CONFLICT(dia, categoria) DO UPDATE SET receita_id = excluded.receita_id
  `);
  const tx = db.transaction((itens) => {
    for (const item of itens) {
      upsert.run(item.dia, item.categoria, item.receita.id);
    }
  });
  tx(entradas);
}

function upsertManual(db, dia, categoria, receitaId) {
  db.prepare(
    `INSERT INTO cardapio (dia, categoria, receita_id) VALUES (?, ?, ?)
     ON CONFLICT(dia, categoria) DO UPDATE SET receita_id = excluded.receita_id`
  ).run(dia, categoria, receitaId);

  const row = db.prepare('SELECT * FROM cardapio WHERE dia = ? AND categoria = ?').get(dia, categoria);
  return montarEntrada(db, row);
}

function buscarPorIntervalo(db, dataInicio, dataFim) {
  const rows = db
    .prepare(`SELECT * FROM cardapio WHERE dia BETWEEN ? AND ? ORDER BY dia, ${ORDEM_CATEGORIA}`)
    .all(dataInicio, dataFim);
  return rows.map((row) => montarEntrada(db, row));
}

module.exports = {
  obterHistoricoAnterior,
  persistirCardapio,
  upsertManual,
  buscarPorIntervalo,
};
