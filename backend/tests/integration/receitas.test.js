'use strict';

const request = require('supertest');
const { criarAppDeTeste } = require('./helpers/appDeTeste');
const { criarUsuarioAutenticado } = require('./helpers/usuarios');
const { umaReceita } = require('./helpers/receitaBuilder');

describe('/receitas', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = criarAppDeTeste());
    ({ token } = await criarUsuarioAutenticado(app));
  });

  function auth(req) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  test('POST cria uma receita e retorna 201 com o payload completo', async () => {
    const payload = umaReceita().comNome('Tapioca').comCategoria('cafe').comCalorias(300).build();
    const resposta = await auth(request(app).post('/receitas')).send(payload);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({ id: expect.any(Number), ...payload });
  });

  test('GET lista as receitas do usuário autenticado', async () => {
    await auth(request(app).post('/receitas')).send(umaReceita().comNome('A').build());
    await auth(request(app).post('/receitas')).send(umaReceita().comNome('B').build());

    const resposta = await auth(request(app).get('/receitas'));
    expect(resposta.status).toBe(200);
    expect(resposta.body.map((r) => r.nome).sort()).toEqual(['A', 'B']);
  });

  test('GET ?categoria filtra pela categoria informada', async () => {
    await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('cafe').build());
    await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('almoco').build());

    const resposta = await auth(request(app).get('/receitas?categoria=almoco'));
    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0].categorias).toContain('almoco');
  });

  test('GET ?categoria inválida retorna 400', async () => {
    const resposta = await auth(request(app).get('/receitas?categoria=brunch'));
    expect(resposta.status).toBe(400);
  });

  test('GET /receitas/:id de id inexistente retorna 404', async () => {
    const resposta = await auth(request(app).get('/receitas/99999'));
    expect(resposta.status).toBe(404);
  });

  test('PUT atualiza uma receita existente e reflete a mudança', async () => {
    const criada = await auth(request(app).post('/receitas')).send(umaReceita().comCalorias(300).build());

    const resposta = await auth(request(app).put(`/receitas/${criada.body.id}`)).send(
      umaReceita().comCalorias(450).build()
    );

    expect(resposta.status).toBe(200);
    expect(resposta.body.calorias).toBe(450);
  });

  test('PUT em id inexistente retorna 404', async () => {
    const resposta = await auth(request(app).put('/receitas/99999')).send(umaReceita().build());
    expect(resposta.status).toBe(404);
  });

  test('DELETE remove a receita e um GET subsequente retorna 404', async () => {
    const criada = await auth(request(app).post('/receitas')).send(umaReceita().build());

    const respostaDelete = await auth(request(app).delete(`/receitas/${criada.body.id}`));
    expect(respostaDelete.status).toBe(204);

    const respostaGet = await auth(request(app).get(`/receitas/${criada.body.id}`));
    expect(respostaGet.status).toBe(404);
  });

  test('DELETE em id inexistente retorna 404', async () => {
    const resposta = await auth(request(app).delete('/receitas/99999'));
    expect(resposta.status).toBe(404);
  });

  test('DELETE de receita referenciada no cardápio retorna 409 (integridade referencial)', async () => {
    const criada = await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('cafe').build());
    await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });

    const resposta = await auth(request(app).delete(`/receitas/${criada.body.id}`));
    expect(resposta.status).toBe(409);
  });

  test('POST com payload sem nome retorna 400 (confirma wiring do validator na rota)', async () => {
    const { nome, ...semNome } = umaReceita().build();
    const resposta = await auth(request(app).post('/receitas')).send(semNome);
    expect(resposta.status).toBe(400);
  });

  test('POST cria receita com múltiplas categorias e o filtro ?categoria acha em cada uma', async () => {
    const payload = umaReceita().comNome('Cuscuz').comCategorias(['cafe', 'lanche']).build();
    const criada = await auth(request(app).post('/receitas')).send(payload);
    expect(criada.status).toBe(201);
    expect(criada.body.categorias.sort()).toEqual(['cafe', 'lanche']);

    const noCafe = await auth(request(app).get('/receitas?categoria=cafe'));
    const noLanche = await auth(request(app).get('/receitas?categoria=lanche'));
    const noAlmoco = await auth(request(app).get('/receitas?categoria=almoco'));
    expect(noCafe.body.map((r) => r.nome)).toContain('Cuscuz');
    expect(noLanche.body.map((r) => r.nome)).toContain('Cuscuz');
    expect(noAlmoco.body.map((r) => r.nome)).not.toContain('Cuscuz');
  });

  test('POST com categorias vazio retorna 400', async () => {
    const resposta = await auth(request(app).post('/receitas')).send(
      umaReceita().comCategorias([]).build()
    );
    expect(resposta.status).toBe(400);
  });

  test('POST cria receita sem calorias (campo opcional) e persiste calorias null', async () => {
    const payload = umaReceita().comNome('Salada').semCalorias().build();
    const resposta = await auth(request(app).post('/receitas')).send(payload);

    expect(resposta.status).toBe(201);
    expect(resposta.body.calorias).toBeNull();

    const get = await auth(request(app).get(`/receitas/${resposta.body.id}`));
    expect(get.body.calorias).toBeNull();
  });

  test('POST persiste modo_preparo e imagem_url e o GET reflete', async () => {
    const payload = umaReceita()
      .comModoPreparo('1. Bata os ovos\n2. Frite')
      .comImagem('https://exemplo/imagem.jpg')
      .build();
    const criada = await auth(request(app).post('/receitas')).send(payload);

    expect(criada.status).toBe(201);
    const get = await auth(request(app).get(`/receitas/${criada.body.id}`));
    expect(get.body.modo_preparo).toBe('1. Bata os ovos\n2. Frite');
    expect(get.body.imagem_url).toBe('https://exemplo/imagem.jpg');
  });

  test('POST com caderno_id de caderno inexistente retorna 400', async () => {
    const payload = umaReceita().noCaderno(99999).build();
    const resposta = await auth(request(app).post('/receitas')).send(payload);
    expect(resposta.status).toBe(400);
  });

  test('POST vincula receita a um caderno do usuário e GET ?caderno filtra', async () => {
    const caderno = await auth(request(app).post('/cadernos')).send({ nome: 'Fitness' });
    const cadernoId = caderno.body.id;

    await auth(request(app).post('/receitas')).send(umaReceita().comNome('Com caderno').noCaderno(cadernoId).build());
    await auth(request(app).post('/receitas')).send(umaReceita().comNome('Sem caderno').build());

    const doCaderno = await auth(request(app).get(`/receitas?caderno=${cadernoId}`));
    expect(doCaderno.body.map((r) => r.nome)).toEqual(['Com caderno']);

    const avulsas = await auth(request(app).get('/receitas?caderno=nenhum'));
    expect(avulsas.body.map((r) => r.nome)).toEqual(['Sem caderno']);
  });
});
