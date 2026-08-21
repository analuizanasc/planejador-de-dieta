'use strict';

// Setup de estado via API — mesma prática já usada nos testes de integração
// do backend (tests/integration/helpers/usuarios.js). Evita depender da UI
// para preparar pré-condição, que é lento e frágil para isso.

const { construirOpcoesDeReceita } = require('./receitasBuilder');

const BASE_URL = 'http://localhost:3000';
let contador = 0;

function emailUnico() {
  contador += 1;
  return `e2e${Date.now()}${contador}@teste.com`;
}

async function requisitar(caminho, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const corpo = resposta.status === 204 ? null : await resposta.json();
  if (!resposta.ok) {
    throw new Error(`${method} ${caminho} -> ${resposta.status}: ${corpo?.erro}`);
  }
  return corpo;
}

// Registra e loga uma usuária nova, retornando o token para uso direto na UI
// (via localStorage) e para chamadas de setup subsequentes.
async function criarUsuariaAutenticada({ nome = 'Usuária E2E', senha = 'senha12345' } = {}) {
  const email = emailUnico();
  await requisitar('/auth/registrar', { method: 'POST', body: { email, senha, nome } });
  const { token, usuario } = await requisitar('/auth/login', { method: 'POST', body: { email, senha } });
  return { token, usuario, email, senha };
}

function criarReceita(token, dados) {
  // Normaliza o atalho `categoria` (string) para o formato atual `categorias` (array).
  const corpo = { ...dados };
  if (corpo.categoria && !corpo.categorias) corpo.categorias = [corpo.categoria];
  delete corpo.categoria;
  return requisitar('/receitas', { method: 'POST', body: corpo, token });
}

function criarCaderno(token, nome) {
  return requisitar('/cadernos', { method: 'POST', body: { nome }, token });
}

function atualizarPreferencias(token, dados) {
  return requisitar('/preferencias', { method: 'PUT', body: dados, token });
}

function gerarCardapio(token, payload) {
  return requisitar('/cardapio/gerar', { method: 'POST', body: payload, token });
}

// Popula um catálogo com várias opções por categoria de uma vez (ver Builder
// em ./receitasBuilder). `definicoes` é uma lista de
// { categoria, quantidade, caloriasBase?, tagsRestricao? }.
function criarCatalogo(token, definicoes) {
  const receitas = definicoes.flatMap(({ categoria, quantidade, caloriasBase, tagsRestricao }) =>
    construirOpcoesDeReceita(categoria, quantidade, { caloriasBase, tagsRestricao })
  );
  return Promise.all(receitas.map((receita) => criarReceita(token, receita)));
}

module.exports = {
  criarUsuariaAutenticada,
  criarReceita,
  criarCaderno,
  atualizarPreferencias,
  gerarCardapio,
  criarCatalogo,
};
