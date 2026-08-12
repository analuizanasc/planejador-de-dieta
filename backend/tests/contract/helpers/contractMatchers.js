'use strict';

// Matchers de contrato hand-rolled (sem dependência de schema validator) —
// checam chaves exatas + tipo de cada campo, consistentes com o estilo
// simples já usado no restante do projeto.

function assertShapeExata(obj, chavesEsperadas) {
  expect(Object.keys(obj).sort()).toEqual([...chavesEsperadas].sort());
}

function assertReceitaShape(receita) {
  assertShapeExata(receita, ['id', 'nome', 'categoria', 'calorias', 'ingredientes', 'tags_restricao', 'permite_repeticao']);
  expect(typeof receita.id).toBe('number');
  expect(typeof receita.nome).toBe('string');
  expect(typeof receita.categoria).toBe('string');
  expect(typeof receita.calorias).toBe('number');
  expect(Array.isArray(receita.ingredientes)).toBe(true);
  receita.ingredientes.forEach((i) => expect(typeof i).toBe('string'));
  expect(Array.isArray(receita.tags_restricao)).toBe(true);
  receita.tags_restricao.forEach((t) => expect(typeof t).toBe('string'));
  expect(typeof receita.permite_repeticao).toBe('boolean');
}

function assertPreferenciasShape(preferencias) {
  assertShapeExata(preferencias, ['categorias_ativas', 'restricoes', 'meta_calorica']);
  expect(Array.isArray(preferencias.categorias_ativas)).toBe(true);
  expect(Array.isArray(preferencias.restricoes)).toBe(true);
  expect(
    preferencias.meta_calorica === null || typeof preferencias.meta_calorica === 'number'
  ).toBe(true);
}

function assertCardapioEntradaShape(entrada) {
  assertShapeExata(entrada, ['dia', 'categoria', 'receita']);
  expect(typeof entrada.dia).toBe('string');
  expect(typeof entrada.categoria).toBe('string');
  assertReceitaShape(entrada.receita);
}

function assertUsuarioPublicoShape(usuario) {
  assertShapeExata(usuario, ['id', 'email', 'nome']);
  expect(typeof usuario.id).toBe('number');
  expect(typeof usuario.email).toBe('string');
  expect(typeof usuario.nome).toBe('string');
  expect(usuario.senha_hash).toBeUndefined();
}

function assertErroShape(corpo) {
  expect(typeof corpo.erro).toBe('string');
}

module.exports = {
  assertShapeExata,
  assertReceitaShape,
  assertPreferenciasShape,
  assertCardapioEntradaShape,
  assertUsuarioPublicoShape,
  assertErroShape,
};
