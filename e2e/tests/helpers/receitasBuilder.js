'use strict';

// Builder de massa de dados — gera N variações de receita para uma categoria
// com nome/calorias únicos. Usado para simular um catálogo real com dezenas
// de opções por refeição (os outros specs usam só 2, o mínimo para forçar
// alternância); com um catálogo abundante dá pra provar que o gerador varia
// de verdade, não só que ele "não quebra a regra de não-repetição".
const ROTULO_CATEGORIA = { cafe: 'Café', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche' };

function construirOpcoesDeReceita(categoria, quantidade, { caloriasBase = 300, tagsRestricao = [] } = {}) {
  const rotulo = ROTULO_CATEGORIA[categoria];
  const semente = Date.now();
  return Array.from({ length: quantidade }, (_, indice) => ({
    nome: `${rotulo} opção ${indice + 1} #${semente}-${indice}`,
    categoria,
    calorias: caloriasBase + indice * 5,
    ingredientes: [`ingrediente ${indice + 1}`],
    tags_restricao: tagsRestricao,
    permite_repeticao: false,
  }));
}

module.exports = { construirOpcoesDeReceita };
