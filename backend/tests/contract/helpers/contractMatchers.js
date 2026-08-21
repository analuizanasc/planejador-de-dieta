'use strict';

// Matchers de contrato hand-rolled (sem dependência de schema validator) —
// checam chaves exatas + tipo de cada campo, consistentes com o estilo
// simples já usado no restante do projeto.

function assertShapeExata(obj, chavesEsperadas) {
  expect(Object.keys(obj).sort()).toEqual([...chavesEsperadas].sort());
}

function assertReceitaShape(receita) {
  assertShapeExata(receita, [
    'id',
    'caderno_id',
    'nome',
    'categorias',
    'calorias',
    'modo_preparo',
    'imagem_url',
    'ingredientes',
    'tags_restricao',
    'permite_repeticao',
  ]);
  expect(typeof receita.id).toBe('number');
  expect(receita.caderno_id === null || typeof receita.caderno_id === 'number').toBe(true);
  expect(typeof receita.nome).toBe('string');
  expect(Array.isArray(receita.categorias)).toBe(true);
  expect(receita.categorias.length).toBeGreaterThan(0);
  receita.categorias.forEach((c) => expect(typeof c).toBe('string'));
  // calorias é opcional: número >= 0 ou null quando não informado.
  expect(receita.calorias === null || typeof receita.calorias === 'number').toBe(true);
  expect(receita.modo_preparo === null || typeof receita.modo_preparo === 'string').toBe(true);
  expect(receita.imagem_url === null || typeof receita.imagem_url === 'string').toBe(true);
  expect(Array.isArray(receita.ingredientes)).toBe(true);
  receita.ingredientes.forEach((i) => expect(typeof i).toBe('string'));
  expect(Array.isArray(receita.tags_restricao)).toBe(true);
  receita.tags_restricao.forEach((t) => expect(typeof t).toBe('string'));
  expect(typeof receita.permite_repeticao).toBe('boolean');
}

function assertCadernoShape(caderno) {
  assertShapeExata(caderno, ['id', 'nome']);
  expect(typeof caderno.id).toBe('number');
  expect(typeof caderno.nome).toBe('string');
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
  assertShapeExata(entrada, ['dia', 'categoria', 'receita', 'origem']);
  expect(typeof entrada.dia).toBe('string');
  expect(typeof entrada.categoria).toBe('string');
  assertReceitaShape(entrada.receita);
  expect(['gerado', 'manual']).toContain(entrada.origem);
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
  assertCadernoShape,
  assertPreferenciasShape,
  assertCardapioEntradaShape,
  assertUsuarioPublicoShape,
  assertErroShape,
};
