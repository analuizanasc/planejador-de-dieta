'use strict';

const request = require('supertest');

let contador = 0;

// Email único por chamada (contador de execução) evita colisão entre
// registros dentro do mesmo arquivo de teste.
function emailUnico(prefixo = 'usuario') {
  contador += 1;
  return `${prefixo}${contador}@teste.com`;
}

// Setup de estado via API: registra e loga um usuário real através dos
// próprios endpoints /auth, em vez de inserir direto no banco.
async function criarUsuarioAutenticado(app, overrides = {}) {
  const dados = {
    email: overrides.email || emailUnico(),
    senha: overrides.senha || 'senha12345',
    nome: overrides.nome || 'Usuária de Teste',
  };

  await request(app).post('/auth/registrar').send(dados).expect(201);
  const respostaLogin = await request(app).post('/auth/login').send({
    email: dados.email,
    senha: dados.senha,
  });

  return { token: respostaLogin.body.token, usuario: respostaLogin.body.usuario, dados };
}

module.exports = { emailUnico, criarUsuarioAutenticado };
