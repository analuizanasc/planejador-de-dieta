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

module.exports = { entrarComSessao };
