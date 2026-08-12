import { IconeCafe, IconeAlmoco, IconeJantar, IconeLanche } from '../components/Icones';

// Fonte única de verdade para a identidade de cada categoria de refeição —
// como rótulos de potes de tempero, reaproveitados em toda a UI (lista de
// receitas, grade semanal, visão mensal). As cores seguem o ritmo do dia:
// café (claro, manhã) → almoço (verde, meio-dia) → jantar (pinho, fim de
// dia) → lanche (terracota, a qualquer hora).
export const CATEGORIA_META = {
  cafe: {
    rotulo: 'Café',
    Icone: IconeCafe,
    cor: 'var(--tostado)',
    fundo: 'var(--tostado-fundo)',
  },
  almoco: {
    rotulo: 'Almoço',
    Icone: IconeAlmoco,
    cor: 'var(--erva)',
    fundo: 'var(--erva-fundo)',
  },
  jantar: {
    rotulo: 'Jantar',
    Icone: IconeJantar,
    cor: 'var(--tinta-sobre-escuro)',
    fundo: 'var(--pinho)',
  },
  lanche: {
    rotulo: 'Lanche',
    Icone: IconeLanche,
    cor: 'var(--terracota)',
    fundo: 'var(--terracota-fundo)',
  },
};

export const CATEGORIAS_ORDEM = ['cafe', 'almoco', 'jantar', 'lanche'];

export const RESTRICAO_META = {
  gluten: { rotulo: 'Glúten' },
  lactose: { rotulo: 'Lactose' },
  acucar_refinado: { rotulo: 'Açúcar refinado' },
};
