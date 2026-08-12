'use strict';

const { test, expect } = require('@playwright/test');
const { criarUsuariaAutenticada, criarReceita, atualizarPreferencias } = require('./helpers/api');
const { entrarComSessao } = require('./helpers/auth');

// Cenário de maior risco/valor: geração automática de cardápio precisa
// respeitar restrição alimentar (RN3) e meta calórica (RN4) ao mesmo tempo,
// de ponta a ponta pela UI real — não só pelo módulo puro ou pela API.
test('gera cardápio respeitando restrição a glúten e meta calórica, visível na grade', async ({ page }) => {
  const { token } = await criarUsuariaAutenticada();

  // Duas opções de café: uma com glúten (nunca deve aparecer), uma sem.
  await criarReceita(token, {
    nome: 'Pão francês com manteiga',
    categoria: 'cafe',
    calorias: 350,
    ingredientes: ['pão', 'manteiga'],
    tags_restricao: ['gluten'],
    permite_repeticao: true,
  });
  await criarReceita(token, {
    nome: 'Tapioca com queijo',
    categoria: 'cafe',
    calorias: 300,
    ingredientes: ['tapioca', 'queijo'],
    tags_restricao: [],
    permite_repeticao: true,
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

  await atualizarPreferencias(token, { restricoes: ['gluten'], meta_calorica: 1200 });

  await entrarComSessao(page, { token, usuario: { nome: 'Usuária E2E' } });
  await page.goto('/cardapio/semana');

  await page.getByRole('button', { name: 'Gerar cardápio automático' }).click();

  // A receita com glúten nunca deve aparecer em nenhuma célula de café da semana.
  await expect(page.locator('[data-testid^="celula-cafe-"] [data-testid="nome-receita"]').first()).toBeVisible();
  const nomesDeCafe = await page.locator('[data-testid^="celula-cafe-"] [data-testid="nome-receita"]').allTextContents();
  expect(nomesDeCafe.every((nome) => nome === 'Tapioca com queijo')).toBe(true);

  // O total diário (soma dos medidores de meta) nunca ultrapassa a meta configurada.
  const legendas = await page.getByTestId('medidor-meta-legenda').all();
  expect(legendas.length).toBeGreaterThan(0);
  for (const legenda of legendas) {
    const total = Number(await legenda.getAttribute('data-total'));
    const meta = Number(await legenda.getAttribute('data-meta'));
    expect(total).toBeLessThanOrEqual(meta);
  }
});
