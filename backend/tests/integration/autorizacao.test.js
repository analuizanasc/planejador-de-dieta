'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { criarAppDeTeste } = require('./helpers/appDeTeste');
const { criarUsuarioAutenticado } = require('./helpers/usuarios');
const { umaReceita } = require('./helpers/receitaBuilder');

describe('Autorização — acesso sem credenciais válidas (VADER: Authorization)', () => {
  let app;
  beforeEach(() => {
    ({ app } = criarAppDeTeste());
  });

  test.each([
    ['GET', '/receitas'],
    ['GET', '/preferencias'],
    ['GET', '/cardapio?semana=2026-08-10'],
  ])('%s %s sem header Authorization retorna 401', async (metodo, rota) => {
    const resposta = await request(app)[metodo.toLowerCase()](rota);
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'Token de autenticação ausente' });
  });

  test('POST /cardapio/gerar sem header Authorization retorna 401', async () => {
    const resposta = await request(app).post('/cardapio/gerar').send({ dias: ['2026-08-10'] });
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'Token de autenticação ausente' });
  });

  test('header Authorization sem o prefixo "Bearer " retorna 401', async () => {
    const resposta = await request(app).get('/receitas').set('Authorization', 'token-sem-prefixo');
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'Token de autenticação ausente' });
  });

  test('token malformado/assinatura inválida retorna 401 "Token inválido"', async () => {
    const resposta = await request(app)
      .get('/receitas')
      .set('Authorization', 'Bearer isso-nao-e-um-jwt-valido');
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'Token inválido' });
  });

  test('token expirado retorna 401 "Token expirado"', async () => {
    const tokenExpirado = jwt.sign({ usuarioId: 1 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const resposta = await request(app)
      .get('/receitas')
      .set('Authorization', `Bearer ${tokenExpirado}`);
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'Token expirado' });
  });
});

describe('Isolamento de dados entre usuários (multiusuário)', () => {
  let app;
  let usuarioA;
  let usuarioB;

  beforeEach(async () => {
    ({ app } = criarAppDeTeste());
    usuarioA = await criarUsuarioAutenticado(app);
    usuarioB = await criarUsuarioAutenticado(app);
  });

  test('receita criada por A não aparece na listagem de B', async () => {
    await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${usuarioA.token}`)
      .send(umaReceita().comNome('Receita da Ana').build());

    const resposta = await request(app).get('/receitas').set('Authorization', `Bearer ${usuarioB.token}`);
    expect(resposta.body).toEqual([]);
  });

  test('GET /receitas/:id de uma receita de A retorna 404 para B (não vaza existência)', async () => {
    const criada = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${usuarioA.token}`)
      .send(umaReceita().build());

    const resposta = await request(app)
      .get(`/receitas/${criada.body.id}`)
      .set('Authorization', `Bearer ${usuarioB.token}`);

    expect(resposta.status).toBe(404);
  });

  test('PUT em receita de A como B retorna 404', async () => {
    const criada = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${usuarioA.token}`)
      .send(umaReceita().build());

    const resposta = await request(app)
      .put(`/receitas/${criada.body.id}`)
      .set('Authorization', `Bearer ${usuarioB.token}`)
      .send(umaReceita().comNome('Tentativa de B').build());

    expect(resposta.status).toBe(404);
  });

  test('DELETE em receita de A como B retorna 404 e a receita de A continua existindo', async () => {
    const criada = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${usuarioA.token}`)
      .send(umaReceita().build());

    const respostaDelete = await request(app)
      .delete(`/receitas/${criada.body.id}`)
      .set('Authorization', `Bearer ${usuarioB.token}`);
    expect(respostaDelete.status).toBe(404);

    const aindaExiste = await request(app)
      .get(`/receitas/${criada.body.id}`)
      .set('Authorization', `Bearer ${usuarioA.token}`);
    expect(aindaExiste.status).toBe(200);
  });

  test('cardápio gerado por A não aparece na consulta semanal de B', async () => {
    await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${usuarioA.token}`)
      .send(umaReceita().comCategoria('cafe').build());

    await request(app)
      .post('/cardapio/gerar')
      .set('Authorization', `Bearer ${usuarioA.token}`)
      .send({ dias: ['2026-08-10'] });

    const resposta = await request(app)
      .get('/cardapio?semana=2026-08-10')
      .set('Authorization', `Bearer ${usuarioB.token}`);

    expect(resposta.body.cardapio).toEqual([]);
  });

  test('B não consegue editar manualmente o cardápio referenciando uma receita de A (404)', async () => {
    const receitaDeA = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${usuarioA.token}`)
      .send(umaReceita().comCategoria('cafe').build());

    const resposta = await request(app)
      .put('/cardapio/2026-08-10/cafe')
      .set('Authorization', `Bearer ${usuarioB.token}`)
      .send({ receita_id: receitaDeA.body.id });

    expect(resposta.status).toBe(404);
  });
});
