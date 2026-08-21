'use strict';

const {
  gerarCardapio,
  receitaCompativel,
  filtrarCandidatas,
  selecionarSemMeta,
  selecionarComMeta,
  resolverCategoriasAtivas,
  embaralharAleatorio,
} = require('../../src/services/geradorCardapio');

function receita(overrides = {}) {
  // Aceita `categoria` (atalho de 1 categoria) ou `categorias` (lista) nos
  // overrides e sempre expõe `categorias` (o formato que o gerador usa).
  const { categoria, categorias, ...resto } = overrides;
  return {
    id: 1,
    nome: 'Receita',
    categorias: categorias || [categoria || 'cafe'],
    calorias: 300,
    tags_restricao: [],
    permite_repeticao: false,
    ...resto,
  };
}

describe('receitaCompativel (RN3)', () => {
  test('é compatível quando o usuário não tem nenhuma restrição', () => {
    const r = receita({ tags_restricao: ['gluten'] });
    expect(receitaCompativel(r, [])).toBe(true);
  });

  test('é incompatível quando alguma tag da receita colide com a restrição do usuário', () => {
    const r = receita({ tags_restricao: ['gluten', 'lactose'] });
    expect(receitaCompativel(r, ['lactose'])).toBe(false);
  });

  test('é compatível quando a receita tem tags mas nenhuma colide com as restrições', () => {
    const r = receita({ tags_restricao: ['acucar_refinado'] });
    expect(receitaCompativel(r, ['gluten', 'lactose'])).toBe(true);
  });

  test('trata restricoesUsuario ausente (undefined) como nenhuma restrição', () => {
    const r = receita({ tags_restricao: ['gluten'] });
    expect(receitaCompativel(r, undefined)).toBe(true);
  });

  test('trata receita sem o campo tags_restricao como sem nenhuma tag', () => {
    const r = { id: 1, categoria: 'cafe', calorias: 300, permite_repeticao: false };
    expect(receitaCompativel(r, ['gluten'])).toBe(true);
  });
});

describe('filtrarCandidatas', () => {
  const receitas = [
    receita({ id: 1, categoria: 'cafe', tags_restricao: [] }),
    receita({ id: 2, categoria: 'almoco', tags_restricao: [] }),
    receita({ id: 3, categoria: 'cafe', tags_restricao: ['gluten'] }),
    receita({ id: 4, categoria: 'cafe', tags_restricao: [], permite_repeticao: true }),
  ];

  test('exclui receitas de categoria diferente da solicitada', () => {
    const candidatas = filtrarCandidatas(receitas, 'almoco', [], null);
    expect(candidatas.map((r) => r.id)).toEqual([2]);
  });

  test('exclui receitas com tag de restrição ativa do usuário (RN3)', () => {
    const candidatas = filtrarCandidatas(receitas, 'cafe', ['gluten'], null);
    expect(candidatas.map((r) => r.id).sort()).toEqual([1, 4]);
  });

  test('exclui a receita usada ontem quando ela não permite repetição (RN1)', () => {
    const candidatas = filtrarCandidatas(receitas, 'cafe', [], 1);
    expect(candidatas.map((r) => r.id)).not.toContain(1);
  });

  test('inclui a receita usada ontem quando ela permite repetição (RN1, exceção)', () => {
    const candidatas = filtrarCandidatas(receitas, 'cafe', [], 4);
    expect(candidatas.map((r) => r.id)).toContain(4);
  });

  test('receita com múltiplas categorias é candidata em qualquer uma delas', () => {
    const multi = [receita({ id: 9, categorias: ['cafe', 'lanche'] })];
    expect(filtrarCandidatas(multi, 'cafe', [], null).map((r) => r.id)).toEqual([9]);
    expect(filtrarCandidatas(multi, 'lanche', [], null).map((r) => r.id)).toEqual([9]);
    expect(filtrarCandidatas(multi, 'almoco', [], null)).toEqual([]);
  });
});

describe('selecionarSemMeta (variedade/LRU)', () => {
  test('prioriza a receita nunca usada sobre a já usada', () => {
    const candidatas = [receita({ id: 1 }), receita({ id: 2 })];
    const ultimoUso = new Map([[1, 0]]); // id 1 já foi usada no dia 0
    const contagemUso = new Map([[1, 1]]);
    expect(selecionarSemMeta(candidatas, ultimoUso, contagemUso).id).toBe(2);
  });

  test('em empate de último uso, desempata pela menor contagem de uso', () => {
    const candidatas = [receita({ id: 1 }), receita({ id: 2 })];
    const ultimoUso = new Map(); // nenhuma foi usada ainda (empate)
    const contagemUso = new Map([
      [1, 3],
      [2, 1],
    ]);
    expect(selecionarSemMeta(candidatas, ultimoUso, contagemUso).id).toBe(2);
  });

  test('em empate total, desempata pelo menor id (determinismo)', () => {
    const candidatas = [receita({ id: 5 }), receita({ id: 2 }), receita({ id: 9 })];
    expect(selecionarSemMeta(candidatas, new Map(), new Map()).id).toBe(2);
  });

  test('entre empatadas no topo, o embaralhador injetado decide qual sai (variedade)', () => {
    const candidatas = [receita({ id: 5 }), receita({ id: 2 }), receita({ id: 9 })];
    // Todas empatam (nunca usadas); um embaralhador que inverte a ordem faz a
    // seleção cair na última em vez do menor id — prova que o hook de variedade
    // atua exatamente sobre o grupo empatado no topo.
    const inverter = (arr) => [...arr].reverse();
    expect(selecionarSemMeta(candidatas, new Map(), new Map(), inverter).id).toBe(9);
  });

  test('o embaralhador só reordena empatadas: a prioridade LRU continua respeitada', () => {
    const candidatas = [receita({ id: 1 }), receita({ id: 2 })];
    const ultimoUso = new Map([[1, 0]]); // id 1 usada recentemente; id 2 nunca
    // Mesmo invertendo, id 2 (nunca usada) tem prioridade — não empata com id 1.
    const inverter = (arr) => [...arr].reverse();
    expect(selecionarSemMeta(candidatas, ultimoUso, new Map(), inverter).id).toBe(2);
  });
});

describe('selecionarComMeta (RN4)', () => {
  test('escolhe a combinação cuja soma bate exatamente na meta', () => {
    const slots = [
      { categoria: 'cafe', candidatas: [receita({ id: 1, calorias: 300 })] },
      { categoria: 'almoco', candidatas: [receita({ id: 2, calorias: 600 })] },
      { categoria: 'jantar', candidatas: [receita({ id: 3, calorias: 300 })] },
    ];
    const escolhidas = selecionarComMeta(slots, 1200);
    const total = escolhidas.reduce((soma, r) => soma + r.calorias, 0);
    expect(total).toBe(1200);
  });

  test('prefere o maior total que não ultrapassa a meta, não o mais distante por baixo', () => {
    const slots = [
      {
        categoria: 'cafe',
        candidatas: [receita({ id: 1, calorias: 200 }), receita({ id: 2, calorias: 400 })],
      },
    ];
    // meta 500: 400 cabe e é mais próximo que 200 — deve escolher a de 400.
    const escolhidas = selecionarComMeta(slots, 500);
    expect(escolhidas[0].id).toBe(2);
  });

  test('quando toda combinação ultrapassa a meta, cai no fallback de menor total (melhor esforço)', () => {
    const slots = [
      { categoria: 'cafe', candidatas: [receita({ id: 1, calorias: 300 })] },
      { categoria: 'almoco', candidatas: [receita({ id: 2, calorias: 600 })] },
    ];
    // menor combinação possível é 900, meta impossível de 500.
    const escolhidas = selecionarComMeta(slots, 500);
    const total = escolhidas.reduce((soma, r) => soma + r.calorias, 0);
    expect(total).toBe(900);
  });

  test('acha o maior total <= meta mesmo quando as somas aparecem fora de ordem crescente', () => {
    // id1 (500 cal) é processado antes de id2 (100 cal) — a soma maior aparece
    // primeiro no Map de estados, cobrindo o caminho em que uma soma posterior
    // e menor não deve substituir o melhor resultado já encontrado.
    const slots = [
      {
        categoria: 'cafe',
        candidatas: [receita({ id: 1, calorias: 500 }), receita({ id: 2, calorias: 100 })],
      },
    ];
    const escolhidas = selecionarComMeta(slots, 600);
    expect(escolhidas[0].id).toBe(1);
  });

  test('mantém a primeira combinação encontrada quando duas combinações somam o mesmo total', () => {
    const slots = [
      {
        categoria: 'cafe',
        candidatas: [receita({ id: 1, calorias: 300 }), receita({ id: 2, calorias: 300 })],
      },
    ];
    const escolhidas = selecionarComMeta(slots, 300);
    expect(escolhidas[0].id).toBe(1);
  });
});

describe('embaralharAleatorio (variedade na regeneração)', () => {
  test('devolve uma permutação determinística para um RNG injetado, sem mutar a entrada', () => {
    const entrada = [receita({ id: 1 }), receita({ id: 2 }), receita({ id: 3 })];
    const resultado = embaralharAleatorio(entrada, () => 0);
    expect(resultado.map((r) => r.id)).toEqual([2, 3, 1]);
    // A entrada original permanece intacta (função pura, sem efeito colateral).
    expect(entrada.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test('preserva todos os itens (é permutação, não perde nem duplica candidatas)', () => {
    const entrada = [receita({ id: 7 }), receita({ id: 4 }), receita({ id: 9 }), receita({ id: 1 })];
    const ids = embaralharAleatorio(entrada, Math.random)
      .map((r) => r.id)
      .sort((a, b) => a - b);
    expect(ids).toEqual([1, 4, 7, 9]);
  });
});

describe('resolverCategoriasAtivas (RN2)', () => {
  test('sem preferência explícita, usa o padrão café/almoço/jantar', () => {
    expect(resolverCategoriasAtivas(undefined)).toEqual(['cafe', 'almoco', 'jantar']);
  });

  test('usa o array customizado quando informado', () => {
    expect(resolverCategoriasAtivas(['cafe', 'lanche'])).toEqual(['cafe', 'lanche']);
  });

  test('lança erro quando o array contém categoria inválida', () => {
    expect(() => resolverCategoriasAtivas(['cafe', 'brunch'])).toThrow(/Categorias inválidas/);
  });
});

describe('gerarCardapio — integração das regras de negócio (RN1–RN5)', () => {
  const receitasCafe = [
    receita({ id: 1, categoria: 'cafe', calorias: 300 }),
    receita({ id: 2, categoria: 'cafe', calorias: 250 }),
  ];
  const receitasAlmoco = [receita({ id: 3, categoria: 'almoco', calorias: 600 })];
  const receitasJantar = [receita({ id: 4, categoria: 'jantar', calorias: 350 })];
  const receitas = [...receitasCafe, ...receitasAlmoco, ...receitasJantar];

  test('RN1: não repete a mesma receita de café em dois dias consecutivos', () => {
    const { cardapio } = gerarCardapio({
      receitas,
      preferencias: {},
      dias: ['2026-08-10', '2026-08-11', '2026-08-12'],
    });
    const cafes = cardapio.filter((c) => c.categoria === 'cafe').map((c) => c.receita.id);
    for (let i = 1; i < cafes.length; i++) {
      expect(cafes[i]).not.toBe(cafes[i - 1]);
    }
  });

  test('RN1: respeita historicoAnterior na fronteira do período gerado', () => {
    // única receita de jantar, sem permite_repeticao -> se "ontem" (fora do período) já
    // usou o id 4, hoje deveria falhar em achar candidata (RN5), não repetir silenciosamente.
    const { cardapio, erros } = gerarCardapio({
      receitas,
      preferencias: {},
      dias: ['2026-08-10'],
      historicoAnterior: { jantar: 4 },
    });
    expect(cardapio.some((c) => c.categoria === 'jantar')).toBe(false);
    expect(erros).toContainEqual({
      dia: '2026-08-10',
      categoria: 'jantar',
      motivo: 'Nenhuma receita compatível disponível para esta categoria/dia',
    });
  });

  test('RN2: sem customização, gera cafe/almoco/jantar e nunca lanche', () => {
    const { cardapio } = gerarCardapio({ receitas, preferencias: {}, dias: ['2026-08-10'] });
    const categoriasGeradas = cardapio.map((c) => c.categoria).sort();
    expect(categoriasGeradas).toEqual(['almoco', 'cafe', 'jantar']);
  });

  test('RN4: com meta calórica definida, o total diário não ultrapassa a meta', () => {
    const { cardapio } = gerarCardapio({
      receitas,
      preferencias: { meta_calorica: 1200 },
      dias: ['2026-08-10'],
    });
    const total = cardapio.reduce((soma, c) => soma + c.receita.calorias, 0);
    expect(total).toBeLessThanOrEqual(1200);
    expect(cardapio).toHaveLength(3);
  });

  test('RN5: categoria sem receita compatível gera erro claro e não interrompe as demais', () => {
    const { cardapio, erros } = gerarCardapio({
      receitas,
      preferencias: { categorias_ativas: ['cafe', 'lanche'] },
      dias: ['2026-08-10'],
    });
    expect(cardapio.map((c) => c.categoria)).toEqual(['cafe']);
    expect(erros).toEqual([
      { dia: '2026-08-10', categoria: 'lanche', motivo: 'Nenhuma receita compatível disponível para esta categoria/dia' },
    ]);
  });

  test('lança erro quando "receitas" não é um array', () => {
    expect(() => gerarCardapio({ receitas: null, preferencias: {}, dias: ['2026-08-10'] })).toThrow(
      'receitas deve ser um array'
    );
  });

  test('lança erro quando "dias" não é um array', () => {
    expect(() => gerarCardapio({ receitas, preferencias: {}, dias: null })).toThrow(
      'dias deve ser um array'
    );
  });

  test('lança erro quando chamado sem nenhum argumento', () => {
    expect(() => gerarCardapio()).toThrow('receitas deve ser um array');
  });

  test('funciona com "preferencias" omitida, usando os padrões (RN2)', () => {
    const { cardapio } = gerarCardapio({ receitas, dias: ['2026-08-10'] });
    expect(cardapio.map((c) => c.categoria).sort()).toEqual(['almoco', 'cafe', 'jantar']);
  });

  test('regenerar com outro embaralhador troca as receitas escolhidas, respeitando as regras', () => {
    // Duas opções de café empatadas no mesmo dia: a escolha muda conforme o
    // embaralhador — é o que faz o botão "Gerar" render um cardápio novo.
    const base = { receitas, preferencias: {}, dias: ['2026-08-10'] };
    const cafePadrao = gerarCardapio(base).cardapio.find((c) => c.categoria === 'cafe').receita.id;
    const cafeInvertido = gerarCardapio({ ...base, embaralhar: (arr) => [...arr].reverse() }).cardapio.find(
      (c) => c.categoria === 'cafe'
    ).receita.id;

    expect(cafePadrao).toBe(1); // determinístico por id sem embaralhador
    expect(cafeInvertido).toBe(2); // outra opção válida quando embaralhado
  });
});
