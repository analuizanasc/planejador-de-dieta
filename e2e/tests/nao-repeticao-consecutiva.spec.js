'use strict';

const { test, expect } = require('@playwright/test');
const { criarUsuariaAutenticada, criarReceita } = require('./helpers/api');
const { entrarComSessao } = require('./helpers/auth');

// Cenário de maior risco/valor: RN1 (não repetir receita em dias
// consecutivos, salvo permite_repeticao) precisa se refletir na grade
// semanal real, dia a dia, coluna a coluna — não só no array retornado
// pela API.
test('gera cardápio para a semana e nenhuma receita de café se repete em dois dias seguidos', async ({ page }) => {
  const { token } = await criarUsuariaAutenticada();

  // Duas opções de café sem permite_repeticao: com 2 opções, o algoritmo
  // sempre consegue alternar (nunca as duas ficam indisponíveis ao mesmo
  // tempo), então a grade fica cheia nos 7 dias — bom caso para verificar
  // adjacência sem ruído de células vazias (RN5).
  await criarReceita(token, {
    nome: 'Tapioca com ovo',
    categoria: 'cafe',
    calorias: 300,
    ingredientes: ['tapioca', 'ovo'],
    tags_restricao: [],
    permite_repeticao: false,
  });
  await criarReceita(token, {
    nome: 'Cuscuz',
    categoria: 'cafe',
    calorias: 250,
    ingredientes: ['cuscuz'],
    tags_restricao: [],
    permite_repeticao: false,
  });
  await criarReceita(token, {
    nome: 'Arroz, feijão e frango',
    categoria: 'almoco',
    calorias: 550,
    ingredientes: ['arroz', 'feijão', 'frango'],
    tags_restricao: [],
    permite_repeticao: true,
  });
  await criarReceita(token, {
    nome: 'Sopa de legumes',
    categoria: 'jantar',
    calorias: 300,
    ingredientes: ['legumes'],
    tags_restricao: [],
    permite_repeticao: true,
  });

  await entrarComSessao(page, { token, usuario: { nome: 'Usuária E2E' } });
  await page.goto('/cardapio/semana');

  await page.getByRole('button', { name: 'Gerar cardápio automático' }).click();

  const celulasCafe = page.locator('[data-testid^="celula-cafe-"] [data-testid="nome-receita"]');
  await expect(celulasCafe.first()).toBeVisible();
  const nomesPorDia = await celulasCafe.allTextContents();

  expect(nomesPorDia).toHaveLength(7);
  for (let i = 1; i < nomesPorDia.length; i++) {
    expect(nomesPorDia[i], `dia ${i} não deveria repetir a receita do dia ${i - 1}`).not.toBe(nomesPorDia[i - 1]);
  }
});
