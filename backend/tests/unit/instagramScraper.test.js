'use strict';

const { criarInstagramScraper, ehUrlInstagramValida } = require('../../src/services/instagramScraper');

// Resposta fake no formato mínimo que o scraper consome (padrão fetch).
function respostaFake({ ok = true, html = '' } = {}) {
  return { ok, text: async () => html };
}

const HTML_COMPLETO = `
<!doctype html><html><head>
<meta property="og:title" content="Chef Ana on Instagram" />
<meta property="og:description" content="Panqueca de banana: 1 banana, 2 ovos, aveia. Misture e frite." />
<meta property="og:video" content="https://cdn.instagram.com/video123.mp4" />
</head><body>${'x'.repeat(300)}</body></html>`;

describe('ehUrlInstagramValida', () => {
  test('aceita URLs de post, reel e reels', () => {
    expect(ehUrlInstagramValida('https://www.instagram.com/p/ABC123/')).toBe(true);
    expect(ehUrlInstagramValida('https://instagram.com/reel/ABC-1_2/')).toBe(true);
    expect(ehUrlInstagramValida('https://www.instagram.com/reels/XYZ/')).toBe(true);
  });

  test('rejeita URLs de outros domínios ou fora de padrão', () => {
    expect(ehUrlInstagramValida('https://tiktok.com/@x/video/1')).toBe(false);
    expect(ehUrlInstagramValida('não é url')).toBe(false);
    expect(ehUrlInstagramValida(null)).toBe(false);
  });
});

describe('criarInstagramScraper.buscarPost', () => {
  test('URL inválida lança AppError 400 sem chamar a rede', async () => {
    const fetchFn = jest.fn();
    const scraper = criarInstagramScraper({ fetchFn });
    await expect(scraper.buscarPost('https://exemplo.com')).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('falha de rede vira AppError 422', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const scraper = criarInstagramScraper({ fetchFn });
    await expect(scraper.buscarPost('https://www.instagram.com/p/ABC/')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('resposta não-ok vira AppError 422', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respostaFake({ ok: false }));
    const scraper = criarInstagramScraper({ fetchFn });
    await expect(scraper.buscarPost('https://www.instagram.com/p/ABC/')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('HTML muito curto (casca de login) vira AppError 422', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respostaFake({ html: '<html></html>' }));
    const scraper = criarInstagramScraper({ fetchFn });
    await expect(scraper.buscarPost('https://www.instagram.com/p/ABC/')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('HTML sem nenhuma meta útil vira AppError 422', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respostaFake({ html: `<html>${'y'.repeat(300)}</html>` }));
    const scraper = criarInstagramScraper({ fetchFn });
    await expect(scraper.buscarPost('https://www.instagram.com/p/ABC/')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('extrai legenda, título e url do vídeo de um HTML completo', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respostaFake({ html: HTML_COMPLETO }));
    const scraper = criarInstagramScraper({ fetchFn });

    const resultado = await scraper.buscarPost('https://www.instagram.com/reel/ABC/');
    expect(resultado.titulo).toContain('Chef Ana');
    expect(resultado.legenda).toContain('Panqueca de banana');
    expect(resultado.urlVideo).toBe('https://cdn.instagram.com/video123.mp4');
  });

  test('decodifica entidades HTML na legenda', async () => {
    const html = `<html><head><meta property="og:description" content="Arroz &amp; feij&#227;o" /></head><body>${'z'.repeat(
      300
    )}</body></html>`;
    const scraper = criarInstagramScraper({ fetchFn: jest.fn().mockResolvedValue(respostaFake({ html })) });
    const { legenda } = await scraper.buscarPost('https://www.instagram.com/p/ABC/');
    expect(legenda).toContain('Arroz &');
  });
});
