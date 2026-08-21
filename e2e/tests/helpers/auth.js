'use strict';

// Injeta a sessão (token + usuário) direto no localStorage, nas mesmas
// chaves que frontend/src/api/client.js e frontend/src/context/AuthContext.jsx
// usam — evita repassar pelo formulário de login em cada teste quando o que
// está sendo testado é outra coisa (login já tem cobertura própria: unit +
// integração no backend, e não é o foco de nenhum destes 3 cenários E2E).
async function entrarComSessao(page, { token, usuario }) {
  await page.goto('/');
  await page.evaluate(
    ({ token, usuario }) => {
      localStorage.setItem('planejador-dieta:token', token);
      localStorage.setItem('planejador-dieta:usuario', JSON.stringify(usuario));
    },
    { token, usuario }
  );
  await page.reload();
}

// Lê o token que a própria UI guardou após um registro/login real pela tela
// (ao contrário de entrarComSessao, que injeta um token obtido via API) —
// usado quando um teste de fluxo completo precisa de um token só para
// setup adicional via API (ex.: popular um catálogo grande de receitas)
// depois que a usuária já entrou pela UI.
function lerTokenDaSessao(page) {
  return page.evaluate(() => localStorage.getItem('planejador-dieta:token'));
}

module.exports = { entrarComSessao, lerTokenDaSessao };
