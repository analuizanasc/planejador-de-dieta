'use strict';

const { test, expect } = require('@playwright/test');
const { criarUsuariaAutenticada, criarReceita } = require('./helpers/api');
const { entrarComSessao } = require('./helpers/auth');

// Cenário de maior risco/valor: edição manual do cardápio precisa persistir
// de verdade no servidor — não só no estado do React. O teste decisivo é um
// reload de página REAL (page.reload(), não navegação client-side), que foi
// exatamente o tipo de bug que apareceu durante o desenvolvimento (rotas do
// SPA colidindo com o proxy da API). A assinatura visual (sublinhado
// ondulado) também precisa sobreviver ao reload, porque ela reflete o campo
// `origem` vindo do backend, não estado local perdido no refresh.
test('troca manualmente a receita de um dia e a troca sobrevive a um reload real da página', async ({ page }) => {
  const { token } = await criarUsuariaAutenticada();

  await criarReceita(token, {
    nome: 'Tapioca com ovo',
    categoria: 'cafe',
    calorias: 300,
    ingredientes: ['tapioca', 'ovo'],
    tags_restricao: [],
    permite_repeticao: true,
  });
  await criarReceita(token, {
    nome: 'Cuscuz',
    categoria: 'cafe',
    calorias: 250,
    ingredientes: ['cuscuz'],
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

  await entrarComSessao(page, { token, usuario: { nome: 'Usuária E2E' } });
  await page.goto('/cardapio/semana');
  await page.getByRole('button', { name: 'Gerar cardápio automático' }).click();

  const celula = page.locator('[data-testid^="celula-cafe-"]').first();
  await expect(celula).toBeVisible();
  const testId = await celula.getAttribute('data-testid');

  const nomeAntes = await celula.getByTestId('nome-receita').textContent();
  const outraOpcao = nomeAntes === 'Tapioca com ovo' ? 'Cuscuz' : 'Tapioca com ovo';

  // Nenhuma célula deve exibir o sublinhado da assinatura antes da edição manual.
  await expect(celula.getByTestId('nome-receita')).not.toHaveCSS('text-decoration-style', 'wavy');

  await celula.click();
  await page.locator(`[data-testid="${testId}"] button[aria-haspopup="listbox"]`).click();
  await page.getByRole('option', { name: outraOpcao }).click();

  const celulaAtualizada = page.getByTestId(testId);
  await expect(celulaAtualizada.getByTestId('nome-receita')).toHaveText(outraOpcao);
  await expect(celulaAtualizada.getByTestId('nome-receita')).toHaveCSS('text-decoration-style', 'wavy');

  // O teste decisivo: reload real da página (não navegação client-side).
  await page.reload();

  const celulaAposReload = page.getByTestId(testId);
  await expect(celulaAposReload.getByTestId('nome-receita')).toHaveText(outraOpcao);
  await expect(celulaAposReload.getByTestId('nome-receita')).toHaveAttribute('data-origem', 'manual');
  await expect(celulaAposReload.getByTestId('nome-receita')).toHaveCSS('text-decoration-style', 'wavy');
});
