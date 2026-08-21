'use strict';

const request = require('supertest');
const { criarAppDeTeste } = require('./helpers/appDeTeste');
const { criarUsuarioAutenticado } = require('./helpers/usuarios');
const { umaReceita } = require('./helpers/receitaBuilder');

// Cobertura VADER (Verbs, Authorization, Data, Errors, Responsiveness) do
// recurso de cadernos (pastas de receita).
describe('/cadernos', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = criarAppDeTeste());
    ({ token } = await criarUsuarioAutenticado(app));
  });

  function auth(req) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  test('POST cria um caderno e retorna 201 com id e nome', async () => {
    const resposta = await auth(request(app).post('/cadernos')).send({ nome: 'Doces' });
    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({ id: expect.any(Number), nome: 'Doces' });
  });

  test('GET lista os cadernos do usuário em ordem alfabética', async () => {
    await auth(request(app).post('/cadernos')).send({ nome: 'Salgados' });
    await auth(request(app).post('/cadernos')).send({ nome: 'Doces' });

    const resposta = await auth(request(app).get('/cadernos'));
    expect(resposta.status).toBe(200);
    expect(resposta.body.map((c) => c.nome)).toEqual(['Doces', 'Salgados']);
  });

  test('POST com nome vazio retorna 400 (wiring do validator)', async () => {
    const resposta = await auth(request(app).post('/cadernos')).send({ nome: '   ' });
    expect(resposta.status).toBe(400);
  });

  test('POST com nome duplicado retorna 409', async () => {
    await auth(request(app).post('/cadernos')).send({ nome: 'Doces' });
    const resposta = await auth(request(app).post('/cadernos')).send({ nome: 'Doces' });
    expect(resposta.status).toBe(409);
  });

  test('DELETE remove o caderno e desvincula as receitas (não as apaga)', async () => {
    const caderno = await auth(request(app).post('/cadernos')).send({ nome: 'Temp' });
    const receita = await auth(request(app).post('/receitas')).send(
      umaReceita().comNome('Órfã').noCaderno(caderno.body.id).build()
    );

    const del = await auth(request(app).delete(`/cadernos/${caderno.body.id}`));
    expect(del.status).toBe(204);

    const get = await auth(request(app).get(`/receitas/${receita.body.id}`));
    expect(get.status).toBe(200);
    expect(get.body.caderno_id).toBeNull();
  });

  test('DELETE de caderno inexistente retorna 404', async () => {
    const resposta = await auth(request(app).delete('/cadernos/99999'));
    expect(resposta.status).toBe(404);
  });

  test('sem token retorna 401 (autorização)', async () => {
    const resposta = await request(app).get('/cadernos');
    expect(resposta.status).toBe(401);
  });

  test('isolamento: caderno de um usuário não aparece nem pode ser apagado por outro', async () => {
    const caderno = await auth(request(app).post('/cadernos')).send({ nome: 'Privado' });
    const { token: tokenB } = await criarUsuarioAutenticado(app);

    const listaB = await request(app).get('/cadernos').set('Authorization', `Bearer ${tokenB}`);
    expect(listaB.body).toEqual([]);

    const delB = await request(app)
      .delete(`/cadernos/${caderno.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(delB.status).toBe(404);
  });

  test('não vincula receita a caderno de outro usuário (RN7): 400', async () => {
    const caderno = await auth(request(app).post('/cadernos')).send({ nome: 'De A' });
    const { token: tokenB } = await criarUsuarioAutenticado(app);

    const resposta = await request(app)
      .post('/receitas')
      .set('Authorization', `Bearer ${tokenB}`)
      .send(umaReceita().noCaderno(caderno.body.id).build());
    expect(resposta.status).toBe(400);
  });
});
