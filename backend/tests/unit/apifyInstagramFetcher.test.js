'use strict';

const { criarApifyFetcher } = require('../../src/services/apifyInstagramFetcher');

// dormir instantâneo para não atrasar os testes (backoff/poll reais são longos).
const semEspera = () => Promise.resolve();

function ok(json) {
  return { ok: true, status: 200, json: async () => json };
}

const POST_APIFY = {
  caption: 'Panqueca de banana: 1 banana, 2 ovos, aveia.',
  ownerUsername: 'chef.ana',
  videoUrl: 'https://cdn.instagram.com/v.mp4',
  latestComments: [
    { text: 'Receita completa: bata tudo e frite em fogo baixo.' },
    { text: 'que delícia!' },
    { ownerUsername: 'sem_texto' },
  ],
};

// fetchFn que responde por padrão do endpoint (runs / actor-runs / datasets).
function fetchFake({ items = [POST_APIFY], statusRun = 'SUCCEEDED', runData } = {}) {
  return jest.fn(async (url) => {
    if (url.includes('/runs?')) {
      return ok({ data: runData || { id: 'run1', defaultDatasetId: 'ds1', status: statusRun } });
    }
    if (url.includes('/actor-runs/')) {
      return ok({ data: { status: statusRun } });
    }
    if (url.includes('/datasets/')) {
      return ok(items);
    }
    throw new Error('URL inesperada: ' + url);
  });
}

const URL = 'https://www.instagram.com/p/ABC123/';

describe('criarApifyFetcher.buscarPost', () => {
  test('URL inválida lança 400 sem chamar a rede', async () => {
    const fetchFn = jest.fn();
    const fetcher = criarApifyFetcher({ token: 't', fetchFn, dormir: semEspera });
    await expect(fetcher.buscarPost('https://exemplo.com')).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('sem token lança 503 sem chamar a rede', async () => {
    const fetchFn = jest.fn();
    const fetcher = criarApifyFetcher({ token: '', fetchFn, dormir: semEspera });
    await expect(fetcher.buscarPost(URL)).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('falha de rede persistente lança 502 após esgotar retries', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('Failed to parse URL'));
    const fetcher = criarApifyFetcher({ token: 't', fetchFn, dormir: semEspera });
    await expect(fetcher.buscarPost(URL)).rejects.toMatchObject({ statusCode: 502 });
    expect(fetchFn).toHaveBeenCalledTimes(3); // 3 tentativas na 1ª chamada (start run)
  });

  test('retry se recupera após uma falha transitória', async () => {
    const base = fetchFake();
    let chamadas = 0;
    const fetchFn = jest.fn(async (...args) => {
      chamadas += 1;
      if (chamadas === 1) throw new Error('Failed to parse URL');
      return base(...args);
    });
    const fetcher = criarApifyFetcher({ token: 't', fetchFn, dormir: semEspera });
    const r = await fetcher.buscarPost(URL);
    expect(r.legenda).toContain('Panqueca de banana');
  });

  test('run que não conclui (FAILED) lança 502', async () => {
    const fetchFn = fetchFake({ statusRun: 'FAILED' });
    const fetcher = criarApifyFetcher({ token: 't', fetchFn, dormir: semEspera });
    await expect(fetcher.buscarPost(URL)).rejects.toMatchObject({ statusCode: 502 });
  });

  test('resposta de início sem id/dataset lança 502', async () => {
    const fetchFn = fetchFake({ runData: { status: 'SUCCEEDED' } }); // sem id
    const fetcher = criarApifyFetcher({ token: 't', fetchFn, dormir: semEspera });
    await expect(fetcher.buscarPost(URL)).rejects.toMatchObject({ statusCode: 502 });
  });

  test('dataset vazio lança 422', async () => {
    const fetchFn = fetchFake({ items: [] });
    const fetcher = criarApifyFetcher({ token: 't', fetchFn, dormir: semEspera });
    await expect(fetcher.buscarPost(URL)).rejects.toMatchObject({ statusCode: 422 });
  });

  test('poll: aguarda enquanto RUNNING e conclui em SUCCEEDED', async () => {
    let estado = 'RUNNING';
    const fetchFn = jest.fn(async (url) => {
      if (url.includes('/runs?')) return ok({ data: { id: 'r', defaultDatasetId: 'd', status: 'RUNNING' } });
      if (url.includes('/actor-runs/')) {
        const atual = estado;
        estado = 'SUCCEEDED';
        return ok({ data: { status: atual } });
      }
      return ok([POST_APIFY]);
    });
    const fetcher = criarApifyFetcher({ token: 't', fetchFn, dormir: semEspera });
    const r = await fetcher.buscarPost(URL);
    expect(r.titulo).toBe('@chef.ana');
  });

  test('normaliza legenda, título, vídeo e comentários (só os com texto)', async () => {
    const fetcher = criarApifyFetcher({ token: 't', fetchFn: fetchFake(), dormir: semEspera });
    const r = await fetcher.buscarPost(URL);
    expect(r.legenda).toContain('Panqueca de banana');
    expect(r.titulo).toBe('@chef.ana');
    expect(r.urlVideo).toBe('https://cdn.instagram.com/v.mp4');
    expect(r.comentarios).toEqual([
      'Receita completa: bata tudo e frite em fogo baixo.',
      'que delícia!',
    ]);
  });

  test('envia directUrls e token no POST de início do run', async () => {
    const fetchFn = fetchFake();
    const fetcher = criarApifyFetcher({ token: 'meu-token', fetchFn, dormir: semEspera });
    await fetcher.buscarPost(URL);

    const chamadaRun = fetchFn.mock.calls.find(([u]) => u.includes('/runs?'));
    expect(chamadaRun[0]).toContain('token=meu-token');
    expect(JSON.parse(chamadaRun[1].body).directUrls).toEqual([URL]);
  });
});
