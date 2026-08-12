'use strict';

const { test } = require('@playwright/test');

// Cenário de maior risco/valor (definido no Prompt 4): não repetição de
// receita em dias consecutivos, visível na grade semanal da UI.
// Pendente até o frontend (Prompt 5) existir — hoje só a API está pronta.
test.skip(
  'usuária gera cardápio para vários dias e vê, na grade semanal, que nenhuma receita se repete em dias consecutivos',
  async () => {
    // TODO(Prompt 5): logar na UI, gerar cardápio para uma semana e verificar
    // visualmente, categoria a categoria, que a receita do dia N é diferente
    // da receita do dia N-1 (exceto quando marcada como "permite repetição").
  }
);
