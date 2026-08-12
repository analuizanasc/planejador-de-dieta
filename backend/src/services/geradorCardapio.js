'use strict';

/**
 * Gerador automático de cardápio.
 *
 * Módulo PURO: não conhece banco de dados nem HTTP. Recebe receitas,
 * preferências e a lista de dias, e devolve o cardápio + eventuais erros.
 * Esse isolamento é o que permite cobertura de sentença/decisão no Jest
 * sem precisar subir Express ou SQLite.
 *
 * Regras de negócio cobertas (ver plano de execução):
 *   RN1. Receita não repete em 2 dias consecutivos, exceto permite_repeticao.
 *   RN2. Café/almoço/jantar obrigatórios por padrão; lanche opcional;
 *        usuário customiza via categorias_ativas.
 *   RN3. Só sugere receitas compatíveis com as restrições do usuário.
 *   RN4. Havendo meta calórica, aproxima o total diário da meta sem ultrapassar.
 *   RN5. Sem receita compatível para uma categoria/dia: erro claro, sem quebrar.
 */

const CATEGORIAS_VALIDAS = ['cafe', 'almoco', 'jantar', 'lanche'];
const CATEGORIAS_PADRAO = ['cafe', 'almoco', 'jantar'];

/**
 * RN3: uma receita é compatível quando NÃO contém nenhuma das restrições
 * do usuário. `tags_restricao` da receita lista o que ela CONTÉM
 * (ex.: 'gluten'); `restricoes` do usuário lista o que ele NÃO pode ter.
 */
function receitaCompativel(receita, restricoesUsuario) {
  const restricoes = restricoesUsuario || [];
  const tags = receita.tags_restricao || [];
  return !tags.some((tag) => restricoes.includes(tag));
}

/**
 * Candidatas para uma categoria em um dia:
 *   - pertencem à categoria;
 *   - são compatíveis com as restrições (RN3);
 *   - não foram usadas no dia anterior, salvo permite_repeticao (RN1).
 */
function filtrarCandidatas(receitas, categoria, restricoesUsuario, receitaIdOntem) {
  return receitas.filter((r) => {
    if (r.categoria !== categoria) return false;
    if (!receitaCompativel(r, restricoesUsuario)) return false;
    if (r.id === receitaIdOntem && !r.permite_repeticao) return false;
    return true;
  });
}

/**
 * Seleção SEM meta calórica: escolhe uma candidata por categoria buscando
 * variedade — menos usada recentemente primeiro (LRU), desempate por menor
 * contagem de uso e por menor id (determinístico e testável).
 */
function selecionarSemMeta(candidata, ultimoUso, contagemUso) {
  return [...candidata].sort((a, b) => {
    const ua = ultimoUso.has(a.id) ? ultimoUso.get(a.id) : -1;
    const ub = ultimoUso.has(b.id) ? ultimoUso.get(b.id) : -1;
    if (ua !== ub) return ua - ub; // usada há mais tempo (ou nunca) vem antes
    const ca = contagemUso.get(a.id) || 0;
    const cb = contagemUso.get(b.id) || 0;
    if (ca !== cb) return ca - cb;
    return a.id - b.id;
  })[0];
}

/**
 * Seleção COM meta calórica (RN4). Cada categoria ativa contribui com
 * exatamente uma receita; queremos o total diário mais próximo da meta
 * SEM ultrapassá-la. Programação dinâmica sobre as categorias (subset-sum):
 * mantém, para cada soma parcial alcançável, uma combinação de receitas.
 *
 * Se nenhuma combinação ficar <= meta (o prato mais leve já estoura a meta),
 * escolhe a de MENOR total — melhor esforço, minimizando o excesso.
 *
 * `slots` = [{ categoria, candidatas: [...] }], todas com pelo menos 1 candidata.
 */
function selecionarComMeta(slots, meta) {
  // Estado: soma parcial -> lista de receitas escolhidas (uma por categoria).
  let estados = new Map([[0, []]]);

  for (const slot of slots) {
    const proximos = new Map();
    // Ordena candidatas por id para tornar a combinação determinística em empates.
    const candidatas = [...slot.candidatas].sort((a, b) => a.id - b.id);

    for (const [soma, escolhidas] of estados) {
      for (const receita of candidatas) {
        const novaSoma = soma + receita.calorias;
        if (!proximos.has(novaSoma)) {
          proximos.set(novaSoma, [...escolhidas, receita]);
        }
      }
    }
    estados = proximos;
  }

  // Preferimos o maior total que não ultrapasse a meta.
  let melhorSemUltrapassar = null; // { soma, escolhidas }
  let menorTotal = null; // fallback quando tudo ultrapassa

  for (const [soma, escolhidas] of estados) {
    if (menorTotal === null || soma < menorTotal.soma) {
      menorTotal = { soma, escolhidas };
    }
    if (soma <= meta) {
      if (melhorSemUltrapassar === null || soma > melhorSemUltrapassar.soma) {
        melhorSemUltrapassar = { soma, escolhidas };
      }
    }
  }

  const vencedor = melhorSemUltrapassar || menorTotal;
  return vencedor.escolhidas;
}

/**
 * Resolve e valida quais categorias estão ativas (RN2).
 * Sem preferência explícita, usa o padrão café/almoço/jantar.
 */
function resolverCategoriasAtivas(categoriasAtivas) {
  const ativas =
    Array.isArray(categoriasAtivas) && categoriasAtivas.length > 0
      ? categoriasAtivas
      : CATEGORIAS_PADRAO;

  const invalidas = ativas.filter((c) => !CATEGORIAS_VALIDAS.includes(c));
  if (invalidas.length > 0) {
    throw new Error(`Categorias inválidas: ${invalidas.join(', ')}`);
  }
  return ativas;
}

/**
 * Gera o cardápio para uma sequência de dias.
 *
 * @param {Object}   params
 * @param {Array}    params.receitas      Receitas disponíveis.
 * @param {Object}   params.preferencias  { categorias_ativas, restricoes, meta_calorica }.
 * @param {string[]} params.dias          Datas 'YYYY-MM-DD' a gerar, em ordem.
 * @param {Object}   [params.historicoAnterior]  Mapa categoria->receita_id usado no
 *                                                dia imediatamente ANTES do primeiro
 *                                                dia (para RN1 na fronteira).
 * @returns {{ cardapio: Array, erros: Array }}
 */
function gerarCardapio({ receitas, preferencias, dias, historicoAnterior } = {}) {
  if (!Array.isArray(receitas)) {
    throw new Error('receitas deve ser um array');
  }
  if (!Array.isArray(dias)) {
    throw new Error('dias deve ser um array');
  }

  const prefs = preferencias || {};
  const categoriasAtivas = resolverCategoriasAtivas(prefs.categorias_ativas);
  const restricoesUsuario = prefs.restricoes || [];
  const meta =
    typeof prefs.meta_calorica === 'number' && prefs.meta_calorica > 0
      ? prefs.meta_calorica
      : null;

  const cardapio = [];
  const erros = [];

  // Rastreamento entre dias.
  const ultimoUso = new Map(); // receitaId -> índice do dia
  const contagemUso = new Map(); // receitaId -> nº de usos
  // O que foi usado "ontem" por categoria (semente = historicoAnterior).
  let usadoOntem = new Map(Object.entries(historicoAnterior || {}));

  dias.forEach((dia, indiceDia) => {
    const usadoHoje = new Map();

    // 1. Monta os slots (categorias com candidatas) e registra erros (RN5).
    const slots = [];
    for (const categoria of categoriasAtivas) {
      const receitaIdOntem = usadoOntem.get(categoria);
      const candidatas = filtrarCandidatas(
        receitas,
        categoria,
        restricoesUsuario,
        receitaIdOntem
      );

      if (candidatas.length === 0) {
        erros.push({
          dia,
          categoria,
          motivo: 'Nenhuma receita compatível disponível para esta categoria/dia',
        });
        continue;
      }
      slots.push({ categoria, candidatas });
    }

    // 2. Seleção do dia.
    let escolhidasPorCategoria;
    if (meta !== null) {
      const escolhidas = selecionarComMeta(slots, meta);
      escolhidasPorCategoria = slots.map((slot, i) => ({
        categoria: slot.categoria,
        receita: escolhidas[i],
      }));
    } else {
      escolhidasPorCategoria = slots.map((slot) => ({
        categoria: slot.categoria,
        receita: selecionarSemMeta(slot.candidatas, ultimoUso, contagemUso),
      }));
    }

    // 3. Registra escolhas e atualiza rastreamento.
    for (const { categoria, receita } of escolhidasPorCategoria) {
      cardapio.push({ dia, categoria, receita });
      ultimoUso.set(receita.id, indiceDia);
      contagemUso.set(receita.id, (contagemUso.get(receita.id) || 0) + 1);
      usadoHoje.set(categoria, receita.id);
    }

    usadoOntem = usadoHoje;
  });

  return { cardapio, erros };
}

module.exports = {
  gerarCardapio,
  receitaCompativel,
  filtrarCandidatas,
  selecionarSemMeta,
  selecionarComMeta,
  resolverCategoriasAtivas,
  CATEGORIAS_VALIDAS,
  CATEGORIAS_PADRAO,
};
