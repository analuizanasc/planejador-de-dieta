'use strict';

const request = require('supertest');
const { criarAppDeTeste } = require('./helpers/appDeTeste');
const { criarUsuarioAutenticado } = require('./helpers/usuarios');
const AppError = require('../../src/utils/AppError');

const DRAFT = {
  nome: 'Panqueca de banana',
  categoria: 'cafe',
  calorias: 250,
  ingredientes: ['1 banana', '2 ovos'],
  tags_restricao: [],
  permite_repeticao: false,
};

// Monta o app com um importador fake, evitando qualquer rede/IA real.
function appComImportador(importarImpl) {
  const importador = { importar: jest.fn(importarImpl) };
  return { ...criarAppDeTeste({ importadorDeps: { importador } }), importador };
}

describe('POST /receitas/importar-instagram', () => {
  test('sem token retorna 401', async () => {
    const { app } = appComImportador(async () => ({ draft: DRAFT, avisos: [], fonte: 'legenda' }));
    const resposta = await request(app)
      .post('/receitas/importar-instagram')
      .send({ url: 'https://www.instagram.com/p/ABC/' });
    expect(resposta.status).toBe(401);
  });

  test('url ausente retorna 400 sem chamar o importador', async () => {
    const { app, importador } = appComImportador(async () => ({ draft: DRAFT, avisos: [], fonte: 'legenda' }));
    const { token } = await criarUsuarioAutenticado(app);

    const resposta = await request(app)
      .post('/receitas/importar-instagram')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(resposta.status).toBe(400);
    expect(importador.importar).not.toHaveBeenCalled();
  });

  test('happy path retorna 200 com draft, avisos e fonte', async () => {
    const { app } = appComImportador(async () => ({ draft: DRAFT, avisos: [], fonte: 'legenda' }));
    const { token } = await criarUsuarioAutenticado(app);

    const resposta = await request(app)
      .post('/receitas/importar-instagram')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.instagram.com/reel/ABC/' });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ draft: DRAFT, avisos: [], fonte: 'legenda' });
  });

  test('propaga avisos do importador no corpo (soft-fail)', async () => {
    const { app } = appComImportador(async () => ({
      draft: { ...DRAFT, categoria: null },
      avisos: ['Categoria não reconhecida; selecione uma categoria válida.'],
      fonte: 'legenda+video',
    }));
    const { token } = await criarUsuarioAutenticado(app);

    const resposta = await request(app)
      .post('/receitas/importar-instagram')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.instagram.com/reel/ABC/' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.avisos).toHaveLength(1);
    expect(resposta.body.fonte).toBe('legenda+video');
  });

  test('erro de scraping (AppError 422) do importador vira resposta 422', async () => {
    const { app } = appComImportador(async () => {
      throw new AppError(422, 'Post privado ou bloqueado.');
    });
    const { token } = await criarUsuarioAutenticado(app);

    const resposta = await request(app)
      .post('/receitas/importar-instagram')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.instagram.com/p/ABC/' });

    expect(resposta.status).toBe(422);
    expect(resposta.body.erro).toMatch(/privado|bloqueado/i);
  });

  test('IA não configurada (AppError 503) vira resposta 503', async () => {
    const { app } = appComImportador(async () => {
      throw new AppError(503, 'Extração por IA não configurada: defina GEMINI_API_KEY.');
    });
    const { token } = await criarUsuarioAutenticado(app);

    const resposta = await request(app)
      .post('/receitas/importar-instagram')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.instagram.com/p/ABC/' });

    expect(resposta.status).toBe(503);
  });

  test('falha da IA (AppError 502) vira resposta 502', async () => {
    const { app } = appComImportador(async () => {
      throw new AppError(502, 'O serviço de IA não conseguiu processar o post agora.');
    });
    const { token } = await criarUsuarioAutenticado(app);

    const resposta = await request(app)
      .post('/receitas/importar-instagram')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.instagram.com/p/ABC/' });

    expect(resposta.status).toBe(502);
  });
});
