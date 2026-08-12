'use strict';

const request = require('supertest');
const { criarAppDeTeste } = require('./helpers/appDeTeste');
const { criarUsuarioAutenticado } = require('./helpers/usuarios');

describe('/preferencias', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = criarAppDeTeste());
    ({ token } = await criarUsuarioAutenticado(app));
  });

  function auth(req) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  test('GET logo após o registro retorna os defaults (cafe/almoco/jantar ativos, sem restrição, sem meta)', async () => {
    const resposta = await auth(request(app).get('/preferencias'));
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({
      categorias_ativas: ['almoco', 'cafe', 'jantar'],
      restricoes: [],
      meta_calorica: null,
    });
  });

  test('PUT atualiza meta_calorica isoladamente, sem alterar os demais campos', async () => {
    const resposta = await auth(request(app).put('/preferencias')).send({ meta_calorica: 1500 });
    expect(resposta.status).toBe(200);
    expect(resposta.body.meta_calorica).toBe(1500);
    expect(resposta.body.categorias_ativas).toEqual(['almoco', 'cafe', 'jantar']);
  });

  test('PUT atualiza categorias_ativas e deduplica valores repetidos', async () => {
    const resposta = await auth(request(app).put('/preferencias')).send({
      categorias_ativas: ['cafe', 'lanche', 'cafe'],
    });
    expect(resposta.body.categorias_ativas).toEqual(['cafe', 'lanche']);
  });

  test('PUT atualiza restricoes', async () => {
    const resposta = await auth(request(app).put('/preferencias')).send({ restricoes: ['gluten'] });
    expect(resposta.body.restricoes).toEqual(['gluten']);
  });

  test('PUT com corpo vazio retorna 400', async () => {
    const resposta = await auth(request(app).put('/preferencias')).send({});
    expect(resposta.status).toBe(400);
  });

  test('PUT meta_calorica null limpa a meta previamente definida', async () => {
    await auth(request(app).put('/preferencias')).send({ meta_calorica: 1200 });
    const resposta = await auth(request(app).put('/preferencias')).send({ meta_calorica: null });
    expect(resposta.body.meta_calorica).toBeNull();
  });
});
