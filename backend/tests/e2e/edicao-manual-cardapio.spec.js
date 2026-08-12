'use strict';

const { test } = require('@playwright/test');

// Cenário de maior risco/valor (definido no Prompt 4): edição manual do
// cardápio persistindo corretamente, do ponto de vista da usuária na UI.
// Pendente até o frontend (Prompt 5) existir — hoje só a API está pronta.
test.skip(
  'usuária troca manualmente a receita de um dia na grade e, ao recarregar a página, a troca continua lá',
  async () => {
    // TODO(Prompt 5): logar na UI, gerar um cardápio, trocar manualmente a
    // receita de um dia/categoria específico, recarregar a página e verificar
    // que a receita escolhida manualmente continua sendo exibida (persistência real).
  }
);
