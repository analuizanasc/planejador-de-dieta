'use strict';

const {
  criarYoutubeFetcher,
  extrairVideoId,
  melhorThumbnail,
} = require('../../src/services/youtubeFetcher');

function ok(json) {
  return { ok: true, json: async () => json };
}

describe('extrairVideoId', () => {
  test('extrai de watch?v=, youtu.be, shorts e live', () => {
    expect(extrairVideoId('https://www.youtube.com/watch?v=abc123XY')).toBe('abc123XY');
    expect(extrairVideoId('https://youtu.be/abc123XY')).toBe('abc123XY');
    expect(extrairVideoId('https://youtube.com/shorts/abc123XY')).toBe('abc123XY');
    expect(extrairVideoId('https://www.youtube.com/live/abc123XY')).toBe('abc123XY');
  });
  test('retorna null quando não há id', () => {
    expect(extrairVideoId('https://youtube.com/')).toBeNull();
    expect(extrairVideoId(null)).toBeNull();
  });
});

describe('criarYoutubeFetcher.buscar', () => {
  const URL = 'https://www.youtube.com/watch?v=abc123XY';

  test('sem apiKey retorna null sem chamar a rede', async () => {
    const fetchFn = jest.fn();
    const r = await criarYoutubeFetcher({ apiKey: '', fetchFn }).buscar(URL);
    expect(r).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('id inválido retorna null sem chamar a rede', async () => {
    const fetchFn = jest.fn();
    const r = await criarYoutubeFetcher({ apiKey: 'k', fetchFn }).buscar('https://youtube.com/');
    expect(r).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('falha de rede retorna null (fallback silencioso)', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('x'));
    const r = await criarYoutubeFetcher({ apiKey: 'k', fetchFn }).buscar(URL);
    expect(r).toBeNull();
  });

  test('resposta sem items retorna null', async () => {
    const fetchFn = jest.fn().mockResolvedValue(ok({ items: [] }));
    const r = await criarYoutubeFetcher({ apiKey: 'k', fetchFn }).buscar(URL);
    expect(r).toBeNull();
  });

  test('retorna título, descrição e a maior thumbnail do snippet', async () => {
    const snippet = {
      title: 'Bolo',
      description: '2 ovos\n1 xícara',
      thumbnails: {
        default: { url: 'http://i/d.jpg' },
        high: { url: 'http://i/h.jpg' },
      },
    };
    const fetchFn = jest.fn().mockResolvedValue(ok({ items: [{ snippet }] }));
    const r = await criarYoutubeFetcher({ apiKey: 'k', fetchFn }).buscar(URL);
    expect(r).toEqual({ titulo: 'Bolo', descricao: '2 ovos\n1 xícara', imagem: 'http://i/h.jpg' });
    expect(fetchFn.mock.calls[0][0]).toContain('id=abc123XY');
  });

  test('sem thumbnails no snippet, imagem vem null', async () => {
    const fetchFn = jest.fn().mockResolvedValue(ok({ items: [{ snippet: { title: 'X' } }] }));
    const r = await criarYoutubeFetcher({ apiKey: 'k', fetchFn }).buscar(URL);
    expect(r.imagem).toBeNull();
  });
});

describe('melhorThumbnail', () => {
  test('prefere a maior resolução disponível', () => {
    expect(
      melhorThumbnail({ default: { url: 'd' }, medium: { url: 'm' }, maxres: { url: 'X' } })
    ).toBe('X');
  });

  test('cai para a próxima resolução quando a maior não existe', () => {
    expect(melhorThumbnail({ default: { url: 'd' }, medium: { url: 'm' } })).toBe('m');
  });

  test('retorna null quando não há thumbnails', () => {
    expect(melhorThumbnail(undefined)).toBeNull();
    expect(melhorThumbnail({})).toBeNull();
  });
});
