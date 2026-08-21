'use strict';

const { test, expect } = require('@playwright/test');
const { criarUsuariaAutenticada, criarCatalogo } = require('./helpers/api');
const { preencherIngredientes } = require('./helpers/formularioReceita');

// Fluxo completo de uma usuária JÁ CADASTRADA: login pela UI real (nunca
// exercitado pelos outros 3 specs, que sempre injetam sessão via
// localStorage) + ativação da categoria opcional "lanche" pela tela de
// preferências (RN2) — os outros specs sempre setam preferências via API,
// nunca pela UI. Fecha mais uma lacuna do §7.1 da documentação de testes.
//
// O catálogo de lanche tem 30+ opções de propósito: com só 2 opções (padrão
// dos outros specs, que forçam alternância) não dá pra provar variedade
// real ao longo da semana — só que a regra de não-repetir não foi violada.
test('usuária existente loga pela UI, ativa lanche nas preferências e o cardápio gerado varia entre as opções de lanche disponíveis', async ({ page }) => {
  // Cria ~121 receitas via API — bem mais setup que os outros specs, que
  // usam só 4 receitas; o timeout padrão de 30s fica apertado.
  test.setTimeout(60_000);

  const { token, email, senha } = await criarUsuariaAutenticada();

  // Café/almoço/jantar têm o mínimo de opções pra geração não falhar (RN2
  // os exige por padrão) — o foco deste cenário é a categoria opcional.
  await criarCatalogo(token, [
    { categoria: 'cafe', quantidade: 30 },
    { categoria: 'almoco', quantidade: 30 },
    { categoria: 'jantar', quantidade: 30 },
    { categoria: 'lanche', quantidade: 31 },
  ]);

  await page.goto('/entrar');
  await page.locator('#email').fill(email);
  await page.locator('#senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/receitas$/);

  // Cadastra a 32ª opção de lanche pelo formulário real, marcando a categoria
  // (checkbox) — inclusive a opcional "Lanche".
  await page.getByRole('button', { name: 'Nova receita' }).click();
  await page.locator('#receita-nome').fill('Vitamina de frutas (cadastrada na UI)');
  await page.getByRole('checkbox', { name: 'Lanche' }).check();
  await page.locator('#receita-calorias').fill('180');
  await preencherIngredientes(page, ['banana', 'leite', 'aveia']);
  await page.getByRole('button', { name: 'Salvar receita' }).click();

  await expect(page.getByText('Vitamina de frutas (cadastrada na UI)')).toBeVisible();

  // Ativa a categoria opcional "Lanche" pela tela de preferências.
  await page.goto('/preferencias');
  await page.getByRole('button', { name: 'Lanche' }).click();
  await page.getByRole('button', { name: 'Salvar preferências' }).click();
  await expect(page.getByText('Preferências salvas.')).toBeVisible();

  await page.goto('/cardapio/semana');
  await page.getByRole('button', { name: 'Gerar cardápio automático' }).click();

  const celulasLanche = page.locator('[data-testid^="celula-lanche-"] [data-testid="nome-receita"]');
  await expect(celulasLanche.first()).toBeVisible();
  const nomesLanche = await celulasLanche.allTextContents();

  expect(nomesLanche).toHaveLength(7);
  // Com 32 opções disponíveis e nenhuma permitindo repetição, as 7 células
  // de lanche da semana devem mostrar receitas todas distintas.
  expect(new Set(nomesLanche).size).toBe(7);
});
