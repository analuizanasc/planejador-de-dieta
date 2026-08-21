'use strict';

const request = require('supertest');
const { criarAppDeTeste } = require('../integration/helpers/appDeTeste');
const { emailUnico, criarUsuarioAutenticado } = require('../integration/helpers/usuarios');
const { umaReceita } = require('../integration/helpers/receitaBuilder');
const {
  assertReceitaShape,
  assertCadernoShape,
  assertPreferenciasShape,
  assertCardapioEntradaShape,
  assertUsuarioPublicoShape,
  assertErroShape,
} = require('./helpers/contractMatchers');

describe('Contrato — POST /auth/registrar', () => {
  test('resposta 201 tem exatamente as chaves id/email/nome, tipos corretos, sem senha_hash', async () => {
    const { app } = criarAppDeTeste();
    const resposta = await request(app)
      .post('/auth/registrar')
      .send({ email: emailUnico(), senha: 'senha12345', nome: 'Ana' });

    assertUsuarioPublicoShape(resposta.body);
  });
});

describe('Contrato — POST /auth/login', () => {
  test('resposta 200 tem token (string) e usuario com shape público', async () => {
    const { app } = criarAppDeTeste();
    const email = emailUnico();
    await request(app).post('/auth/registrar').send({ email, senha: 'senha12345', nome: 'Ana' });

    const resposta = await request(app).post('/auth/login').send({ email, senha: 'senha12345' });

    expect(Object.keys(resposta.body).sort()).toEqual(['token', 'usuario']);
    expect(typeof resposta.body.token).toBe('string');
    assertUsuarioPublicoShape(resposta.body.usuario);
  });
});

describe('Contrato — /receitas', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = criarAppDeTeste());
    ({ token } = await criarUsuarioAutenticado(app));
  });

  test('POST retorna uma receita com o shape completo', async () => {
    const resposta = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${token}`)
      .send(umaReceita().build());
    assertReceitaShape(resposta.body);
  });

  test('GET (lista) retorna um array onde cada item respeita o shape de receita', async () => {
    await request(app).post('/receitas').set('Authorization', `Bearer ${token}`).send(umaReceita().build());
    const resposta = await request(app).get('/receitas').set('Authorization', `Bearer ${token}`);
    expect(Array.isArray(resposta.body)).toBe(true);
    resposta.body.forEach(assertReceitaShape);
  });
});

describe('Contrato — /cadernos', () => {
  test('POST e GET retornam cadernos com exatamente id/nome e tipos corretos', async () => {
    const { app } = criarAppDeTeste();
    const { token } = await criarUsuarioAutenticado(app);

    const criado = await request(app)
      .post('/cadernos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Doces' });
    assertCadernoShape(criado.body);

    const lista = await request(app).get('/cadernos').set('Authorization', `Bearer ${token}`);
    expect(Array.isArray(lista.body)).toBe(true);
    lista.body.forEach(assertCadernoShape);
  });
});

describe('Contrato — /preferencias', () => {
  test('GET retorna exatamente categorias_ativas/restricoes/meta_calorica com os tipos corretos', async () => {
    const { app } = criarAppDeTeste();
    const { token } = await criarUsuarioAutenticado(app);
    const resposta = await request(app).get('/preferencias').set('Authorization', `Bearer ${token}`);
    assertPreferenciasShape(resposta.body);
  });
});

describe('Contrato — /cardapio', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = criarAppDeTeste());
    ({ token } = await criarUsuarioAutenticado(app));
    await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${token}`)
      .send(umaReceita().comCategoria('cafe').build());
  });

  test('POST /cardapio/gerar retorna { cardapio: [entradas...], erros: [...] } com shape correto', async () => {
    const resposta = await request(app)
      .post('/cardapio/gerar')
      .set('Authorization', `Bearer ${token}`)
      .send({ dias: ['2026-08-10'] });

    expect(Object.keys(resposta.body).sort()).toEqual(['cardapio', 'erros']);
    expect(Array.isArray(resposta.body.cardapio)).toBe(true);
    expect(Array.isArray(resposta.body.erros)).toBe(true);
    resposta.body.cardapio.forEach(assertCardapioEntradaShape);
    resposta.body.erros.forEach((erro) => {
      expect(Object.keys(erro).sort()).toEqual(['categoria', 'dia', 'motivo']);
    });
  });

  test('GET /cardapio retorna { periodo: {...}, cardapio: [...] } com shape correto', async () => {
    await request(app)
      .post('/cardapio/gerar')
      .set('Authorization', `Bearer ${token}`)
      .send({ dias: ['2026-08-10'] });

    const resposta = await request(app)
      .get('/cardapio?semana=2026-08-10')
      .set('Authorization', `Bearer ${token}`);

    expect(Object.keys(resposta.body).sort()).toEqual(['cardapio', 'periodo']);
    expect(Object.keys(resposta.body.periodo).sort()).toEqual(['fim', 'inicio', 'tipo']);
    resposta.body.cardapio.forEach(assertCardapioEntradaShape);
  });

  test('PUT /cardapio/:dia/:categoria retorna uma entrada de cardápio com shape correto', async () => {
    const receita = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${token}`)
      .send(umaReceita().comCategoria('almoco').build());

    const resposta = await request(app)
      .put('/cardapio/2026-08-11/almoco')
      .set('Authorization', `Bearer ${token}`)
      .send({ receita_id: receita.body.id });

    assertCardapioEntradaShape(resposta.body);
  });
});

describe('Contrato — respostas de erro', () => {
  test('400/401/404/409 sempre respondem { erro: string }', async () => {
    const { app } = criarAppDeTeste();

    const semToken = await request(app).get('/receitas');
    assertErroShape(semToken.body);
    expect(semToken.status).toBe(401);

    const { token } = await criarUsuarioAutenticado(app);
    const naoEncontrada = await request(app).get('/receitas/99999').set('Authorization', `Bearer ${token}`);
    assertErroShape(naoEncontrada.body);
    expect(naoEncontrada.status).toBe(404);

    const payloadInvalido = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assertErroShape(payloadInvalido.body);
    expect(payloadInvalido.status).toBe(400);
  });
});
