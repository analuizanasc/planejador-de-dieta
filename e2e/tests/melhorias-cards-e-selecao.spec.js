'use strict';

const { test, expect } = require('@playwright/test');
const { criarUsuariaAutenticada, criarReceita, criarCaderno } = require('./helpers/api');
const { entrarComSessao } = require('./helpers/auth');

const SEM_RESTRICAO = { tags_restricao: [], permite_repeticao: false };

// Melhoria: card de receita com tamanho FIXO — a altura precisa ser a mesma
// tenha ou não imagem, senão a grade "pula" e fica desalinhada. É o tipo de
// regressão que passa despercebida no code review e só a medição real pega.
test('cards de receita têm a mesma altura fixa com e sem imagem', async ({ page }) => {
  const { token } = await criarUsuariaAutenticada();
  await criarReceita(token, {
    nome: 'Tapioca com foto',
    categoria: 'cafe',
    calorias: 300,
    ingredientes: ['tapioca'],
    imagem_url: 'https://exemplo.test/tapioca.jpg',
    ...SEM_RESTRICAO,
  });
  await criarReceita(token, {
    nome: 'Cuscuz sem foto',
    categoria: 'cafe',
    calorias: 250,
    ingredientes: ['cuscuz'],
    ...SEM_RESTRICAO,
  });

  await entrarComSessao(page, { token, usuario: { nome: 'Usuária E2E' } });
  await page.goto('/receitas');

  const cards = page.getByTestId('receita-card');
  await expect(cards).toHaveCount(2);

  const alturas = await cards.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().height))
  );
  expect(alturas[0]).toBe(344); // altura fixa da spec
  expect(alturas[0]).toBe(alturas[1]); // mesma altura, independente da imagem
});

// Spec §6 (critério de aceite): uma receita com mais de 2 restrições mostra só
// 2 tags + um chip "+N", sem crescer o card. É a regra mais fácil de regredir
// ao mexer no layout das tags, então merece verificação direta.
test('card com mais de 2 restrições mostra 2 tags + "+N" e mantém a altura fixa', async ({ page }) => {
  const { token } = await criarUsuariaAutenticada();
  await criarReceita(token, {
    nome: 'Receita muito restrita',
    categoria: 'almoco',
    calorias: 400,
    ingredientes: ['x'],
    tags_restricao: ['gluten', 'lactose', 'acucar_refinado'], // 3 → 2 visíveis + "+1"
    permite_repeticao: false,
  });

  await entrarComSessao(page, { token, usuario: { nome: 'Usuária E2E' } });
  await page.goto('/receitas');

  const card = page.getByTestId('receita-card');
  await expect(card).toHaveCount(1);
  // Exatamente 2 tags de restrição renderizadas na faixa, mais o chip "+1".
  await expect(card.locator('span', { hasText: /^Glúten$|^Lactose$|^Açúcar refinado$/ })).toHaveCount(2);
  await expect(card.getByText('+1', { exact: true })).toBeVisible();

  const altura = await card.evaluate((el) => Math.round(el.getBoundingClientRect().height));
  expect(altura).toBe(344);
});

// Melhoria: na edição manual dá pra achar a receita pelo caderno — as opções
// vêm agrupadas por caderno e digitar o nome do caderno filtra as receitas
// dele. Vale o E2E porque junta backend (caderno + receita), agrupamento na UI
// e a busca por digitação num só fluxo real.
test('a edição manual agrupa por caderno e filtra ao digitar o nome do caderno', async ({ page }) => {
  const { token } = await criarUsuariaAutenticada();
  const caderno = await criarCaderno(token, 'Minhas Nordestinas');
  await criarReceita(token, {
    nome: 'Cuscuz nordestino',
    categoria: 'cafe',
    calorias: 300,
    ingredientes: ['cuscuz'],
    caderno_id: caderno.id,
    ...SEM_RESTRICAO,
  });
  await criarReceita(token, {
    nome: 'Pão na chapa',
    categoria: 'cafe',
    calorias: 250,
    ingredientes: ['pao'],
    permite_repeticao: true,
    tags_restricao: [],
  });

  await entrarComSessao(page, { token, usuario: { nome: 'Usuária E2E' } });
  await page.goto('/cardapio/semana');
  await page.getByRole('button', { name: 'Gerar cardápio automático' }).click();

  const celula = page.locator('[data-testid^="celula-cafe-"]').first();
  await expect(celula).toBeVisible();
  await celula.click();

  const campoBusca = page.locator('[data-testid^="celula-cafe-"] input[role="combobox"]').first();
  await campoBusca.click();

  // Cabeçalho do caderno aparece agrupando as opções.
  await expect(page.getByText('Minhas Nordestinas')).toBeVisible();

  // Digitar o nome do caderno filtra só as receitas dele.
  await campoBusca.fill('nordestinas');
  await expect(page.getByRole('option', { name: 'Cuscuz nordestino' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Pão na chapa' })).toHaveCount(0);
});
