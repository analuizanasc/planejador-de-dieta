'use strict';

const { test, expect } = require('@playwright/test');
const { criarCatalogo } = require('./helpers/api');
const { lerTokenDaSessao } = require('./helpers/auth');
const { preencherIngredientes } = require('./helpers/formularioReceita');

// Fluxo completo de uma usuária NOVA, pela UI real do começo ao fim: registro
// (sem injeção de sessão via localStorage, ao contrário dos outros 3 specs),
// cadastro de receita e preferências pelos formulários reais — fecha a
// lacuna registrada em docs/documentacao-de-testes.md §7.1 ("Fluxos de
// usuário não cobertos por E2E").
//
// O catálogo tem 30+ opções por refeição de propósito: com só 2 opções
// (como nos outros specs, que forçam alternância) não dá pra distinguir
// "o algoritmo respeita a regra de não-repetir" de "o algoritmo varia de
// verdade quando tem para onde variar". Com oferta abundante, as 7 receitas
// de café da semana devem ser todas distintas — sinal que nenhum outro E2E
// verifica hoje. (Meta calórica fica de fora deste cenário de propósito:
// quando há meta, a seleção usa `selecionarComMeta` — programação dinâmica
// pelo total calórico, sem rotação por LRU — então "várias opções" e "meta
// calórica" não podem ser verificadas juntas na mesma asserção de
// variedade; ver backend/src/services/geradorCardapio.js.)
test('registra, cadastra receita e restrição pela UI, gera cardápio com catálogo amplo e a visão mensal reflete a semana', async ({ page }) => {
  // Cria ~90 receitas via API e navega por 5 telas — bem mais setup que os
  // outros specs, que usam só 4 receitas; o timeout padrão de 30s fica
  // apertado.
  test.setTimeout(60_000);

  const email = `e2e${Date.now()}@teste.com`;
  const senha = 'senha12345';

  await page.goto('/registrar');
  await page.locator('#nome').fill('Usuária E2E Fluxo Completo');
  await page.locator('#email').fill(email);
  await page.locator('#senha').fill(senha);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page).toHaveURL(/\/receitas$/);

  // Cadastra 1 receita de jantar pelo formulário real: nome, seletor de
  // categoria custom (troca do default "Café" para "Jantar"), calorias,
  // ingredientes e o checkbox de repetição.
  await page.getByRole('button', { name: 'Nova receita' }).click();
  await page.locator('#receita-nome').fill('Arroz, feijão e frango (cadastrada na UI)');
  await page.getByRole('checkbox', { name: 'Jantar' }).check();
  await page.locator('#receita-calorias').fill('550');
  await preencherIngredientes(page, ['arroz', 'feijão', 'frango']);
  await page.getByRole('checkbox', { name: 'Pode repetir em dias consecutivos' }).check();
  await page.getByRole('button', { name: 'Salvar receita' }).click();

  await expect(page.getByText('Arroz, feijão e frango (cadastrada na UI)')).toBeVisible();

  const token = await lerTokenDaSessao(page);

  // 3 opções de café com lactose, para provar que a restrição ativada na UI
  // (abaixo) realmente as exclui da geração — captura os nomes para a
  // asserção negativa.
  const receitasComLactose = await criarCatalogo(token, [
    { categoria: 'cafe', quantidade: 3, tagsRestricao: ['lactose'] },
  ]);
  const nomesComLactose = receitasComLactose.map((r) => r.nome);

  // Completa o catálogo via API (setup de estado via API, não pela UI): 30
  // opções compatíveis de café e almoço, e mais 29 de jantar — a 30ª já foi
  // cadastrada acima pelo formulário.
  await criarCatalogo(token, [
    { categoria: 'cafe', quantidade: 30 },
    { categoria: 'almoco', quantidade: 30 },
    { categoria: 'jantar', quantidade: 29 },
  ]);

  // Ativa a restrição a lactose pela tela de preferências real (os outros
  // specs sempre setam preferências via API, nunca pela UI).
  await page.goto('/preferencias');
  await page.getByRole('button', { name: 'Lactose' }).click();
  await page.getByRole('button', { name: 'Salvar preferências' }).click();
  await expect(page.getByText('Preferências salvas.')).toBeVisible();

  await page.goto('/cardapio/semana');
  await page.getByRole('button', { name: 'Gerar cardápio automático' }).click();

  const celulasCafe = page.locator('[data-testid^="celula-cafe-"]');
  await expect(celulasCafe.first().getByTestId('nome-receita')).toBeVisible();

  const celulas = await celulasCafe.all();
  const dias = await Promise.all(
    celulas.map(async (celula) => (await celula.getAttribute('data-testid')).replace('celula-cafe-', ''))
  );
  expect(dias).toHaveLength(7);

  const nomesCafe = await page.locator('[data-testid^="celula-cafe-"] [data-testid="nome-receita"]').allTextContents();

  // Com 30 opções compatíveis de café disponíveis e nenhuma permitindo
  // repetição, as 7 receitas da semana devem ser todas distintas.
  expect(new Set(nomesCafe).size).toBe(7);

  // Nenhuma das 3 opções com lactose aparece — a restrição ativada pela UI
  // chegou até a geração.
  for (const nome of nomesCafe) {
    expect(nomesComLactose).not.toContain(nome);
  }

  // Guarda o que a grade semanal mostrou, dia a dia, por categoria — para
  // comparar com a visão mensal a seguir.
  const nomesPorCategoria = { cafe: nomesCafe };
  for (const categoria of ['almoco', 'jantar']) {
    nomesPorCategoria[categoria] = await page
      .locator(`[data-testid^="celula-${categoria}-"] [data-testid="nome-receita"]`)
      .allTextContents();
  }

  // Teste decisivo de consistência entre telas: a visão mensal precisa
  // mostrar exatamente as mesmas receitas que a grade semanal, dia a dia,
  // já que as duas consomem o mesmo GET /cardapio.
  await page.goto('/cardapio/mes');
  for (let i = 0; i < dias.length; i++) {
    const dia = dias[i];
    for (const categoria of ['cafe', 'almoco', 'jantar']) {
      await expect(
        page.locator(`[data-testid="item-mes-${categoria}-${dia}"] [data-testid="nome-receita"]`)
      ).toHaveText(nomesPorCategoria[categoria][i]);
    }
  }
});
