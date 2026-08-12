'use strict';

const request = require('supertest');
const { criarAppDeTeste } = require('./helpers/appDeTeste');
const { emailUnico, criarUsuarioAutenticado } = require('./helpers/usuarios');

describe('POST /auth/registrar', () => {
  let app;
  beforeEach(() => {
    ({ app } = criarAppDeTeste());
  });

  test('registra um usuário novo e retorna 201 sem expor senha_hash', async () => {
    const email = emailUnico();
    const resposta = await request(app)
      .post('/auth/registrar')
      .send({ email, senha: 'senha12345', nome: 'Ana' });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({ id: expect.any(Number), email, nome: 'Ana' });
    expect(resposta.body.senha_hash).toBeUndefined();
  });

  test('rejeita email já cadastrado com 409', async () => {
    const email = emailUnico();
    await request(app).post('/auth/registrar').send({ email, senha: 'senha12345', nome: 'Ana' });

    const resposta = await request(app)
      .post('/auth/registrar')
      .send({ email, senha: 'outraSenha1', nome: 'Ana 2' });

    expect(resposta.status).toBe(409);
    expect(resposta.body).toEqual({ erro: 'Email já cadastrado' });
  });

  test('rejeita payload sem nome com 400', async () => {
    const resposta = await request(app)
      .post('/auth/registrar')
      .send({ email: emailUnico(), senha: 'senha12345' });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toMatch(/nome/);
  });

  test('rejeita métodos HTTP não suportados em /auth/registrar com 404', async () => {
    const resposta = await request(app).get('/auth/registrar');
    expect(resposta.status).toBe(404);
  });
});

describe('POST /auth/login', () => {
  let app;
  beforeEach(() => {
    ({ app } = criarAppDeTeste());
  });

  test('loga com credenciais válidas e retorna token + dados públicos do usuário', async () => {
    const email = emailUnico();
    await request(app).post('/auth/registrar').send({ email, senha: 'senha12345', nome: 'Ana' });

    const resposta = await request(app).post('/auth/login').send({ email, senha: 'senha12345' });

    expect(resposta.status).toBe(200);
    expect(typeof resposta.body.token).toBe('string');
    expect(resposta.body.usuario).toEqual({ id: expect.any(Number), email, nome: 'Ana' });
  });

  test('rejeita senha errada com 401 e mensagem genérica', async () => {
    const email = emailUnico();
    await request(app).post('/auth/registrar').send({ email, senha: 'senha12345', nome: 'Ana' });

    const resposta = await request(app).post('/auth/login').send({ email, senha: 'senhaErrada' });

    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'Email ou senha inválidos' });
  });

  test('rejeita email inexistente com a mesma mensagem genérica usada para senha errada', async () => {
    const resposta = await request(app)
      .post('/auth/login')
      .send({ email: 'naoexiste@teste.com', senha: 'qualquer123' });

    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'Email ou senha inválidos' });
  });
});

describe('criarUsuarioAutenticado (smoke do próprio helper de setup)', () => {
  test('retorna um token utilizável em uma rota protegida', async () => {
    const { app } = criarAppDeTeste();
    const { token } = await criarUsuarioAutenticado(app);

    const resposta = await request(app).get('/receitas').set('Authorization', `Bearer ${token}`);
    expect(resposta.status).toBe(200);
  });
});
