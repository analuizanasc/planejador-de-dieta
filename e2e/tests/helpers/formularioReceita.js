'use strict';

// Preenche os ingredientes no formulário de receita, que agora usa um campo
// por ingrediente (Enter cria o próximo). Substitui o antigo textarea único.
async function preencherIngredientes(page, ingredientes) {
  for (let i = 0; i < ingredientes.length; i += 1) {
    const campo = page.getByRole('textbox', { name: `Ingrediente ${i + 1}`, exact: true });
    await campo.fill(ingredientes[i]);
    if (i < ingredientes.length - 1) await campo.press('Enter');
  }
}

module.exports = { preencherIngredientes };
