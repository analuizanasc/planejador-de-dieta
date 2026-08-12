'use strict';

const { test } = require('@playwright/test');

// Cenário de maior risco/valor (definido no Prompt 4): geração automática de
// cardápio deve respeitar restrições alimentares e meta calórica ao vivo, na UI.
// Pendente até o frontend (Prompt 5) existir — hoje só a API está pronta.
test.skip(
  'usuária com restrição a glúten e meta calórica gera cardápio e vê apenas receitas compatíveis, dentro da meta',
  async () => {
    // TODO(Prompt 5): logar na UI, configurar restrição "gluten" e meta calórica
    // nas preferências, clicar em "gerar cardápio" e verificar visualmente que
    // nenhuma receita exibida tem a tag glúten e que o total do dia não ultrapassa a meta.
  }
);
