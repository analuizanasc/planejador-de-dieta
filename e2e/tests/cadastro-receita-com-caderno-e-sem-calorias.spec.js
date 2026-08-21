'use strict';

const { test, expect } = require('@playwright/test');
const { criarUsuariaAutenticada } = require('./helpers/api');
const { entrarComSessao } = require('./helpers/auth');

// Cobre, de ponta a ponta pela UI real, três melhorias da fase 2 que só
// existem no formulário (não há como exercê-las pela API):
//   - calorias deixou de ser obrigatória (campo em branco → "sem calorias");
//   - ingredientes viram campos individuais, e Enter cria o próximo campo;
//   - receitas podem ser organizadas em cadernos (pastas) e filtradas por eles.
test('cadastra receita sem calorias, com ingredientes via Enter, dentro de um caderno', async ({ page }) => {
  const { token, usuario } = await criarUsuariaAutenticada();
  await entrarComSessao(page, { token, usuario });
  await page.goto('/receitas');

  // 1. Cria um caderno (o nome vem por window.prompt).
  page.once('dialog', (dialogo) => dialogo.accept('Doces'));
  await page.getByRole('button', { name: '+ Caderno' }).click();
  const chipDoces = page.getByRole('button', { name: 'Doces', exact: true });
  await expect(chipDoces).toBeVisible();

  // 2. Abre o formulário de nova receita.
  await page.getByRole('button', { name: 'Nova receita' }).click();
  await page.locator('#receita-nome').fill('Brigadeiro de colher');

  // 2b. Seleciona MAIS DE UMA categoria (checkboxes).
  await page.getByRole('checkbox', { name: 'Café' }).check();
  await page.getByRole('checkbox', { name: 'Lanche' }).check();

  // 3. Ingredientes em campos separados: Enter cria o próximo campo.
  const primeiro = page.getByRole('textbox', { name: 'Ingrediente 1', exact: true });
  await primeiro.fill('leite condensado');
  await primeiro.press('Enter');
  const segundo = page.getByRole('textbox', { name: 'Ingrediente 2', exact: true });
  await expect(segundo).toBeFocused();
  await segundo.fill('cacau');

  // 4. Modo de preparo (novo campo).
  await page.locator('#receita-modo-preparo').fill('1. Misture tudo\n2. Cozinhe até desgrudar');

  // 5. Vincula a receita ao caderno "Doces".
  const campoCaderno = page.locator('label', { hasText: 'Caderno' });
  await campoCaderno.getByRole('button').click();
  await page.getByRole('option', { name: 'Doces' }).click();

  // 6. Calorias deixadas em branco de propósito.
  await page.getByRole('button', { name: 'Salvar receita' }).click();

  // 7. A receita aparece, sem calorias, com os dois selos de categoria (e sem
  //    a lista de ingredientes no card).
  const card = page.locator('article', { hasText: 'Brigadeiro de colher' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('sem calorias');
  await expect(card).toContainText('Café');
  await expect(card).toContainText('Lanche');
  await expect(card).not.toContainText('leite condensado');

  // 8. Filtrar por "Sem caderno" esconde a receita; por "Doces" mostra.
  await page.getByRole('button', { name: 'Sem caderno', exact: true }).click();
  await expect(page.locator('article', { hasText: 'Brigadeiro de colher' })).toHaveCount(0);

  await chipDoces.click();
  await expect(page.locator('article', { hasText: 'Brigadeiro de colher' })).toBeVisible();
});
