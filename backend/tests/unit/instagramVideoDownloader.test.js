'use strict';

const {
  criarVideoDownloader,
  TAMANHO_MAXIMO_BYTES,
} = require('../../src/services/instagramVideoDownloader');

function respostaFake({ ok = true, bytes = new Uint8Array([1, 2, 3]), contentType = 'video/mp4' } = {}) {
  return {
    ok,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? contentType : null) },
  };
}

describe('criarVideoDownloader.baixarVideo', () => {
  test('url ausente lança AppError 422 sem chamar a rede', async () => {
    const fetchFn = jest.fn();
    const downloader = criarVideoDownloader({ fetchFn });
    await expect(downloader.baixarVideo(null)).rejects.toMatchObject({ statusCode: 422 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('falha de rede vira AppError 422', async () => {
    const downloader = criarVideoDownloader({ fetchFn: jest.fn().mockRejectedValue(new Error('x')) });
    await expect(downloader.baixarVideo('https://cdn/v.mp4')).rejects.toMatchObject({ statusCode: 422 });
  });

  test('resposta não-ok vira AppError 422', async () => {
    const downloader = criarVideoDownloader({
      fetchFn: jest.fn().mockResolvedValue(respostaFake({ ok: false })),
    });
    await expect(downloader.baixarVideo('https://cdn/v.mp4')).rejects.toMatchObject({ statusCode: 422 });
  });

  test('vídeo vazio vira AppError 422', async () => {
    const downloader = criarVideoDownloader({
      fetchFn: jest.fn().mockResolvedValue(respostaFake({ bytes: new Uint8Array([]) })),
    });
    await expect(downloader.baixarVideo('https://cdn/v.mp4')).rejects.toMatchObject({ statusCode: 422 });
  });

  test('vídeo acima do limite vira AppError 422', async () => {
    const enorme = { ...respostaFake(), arrayBuffer: async () => new ArrayBuffer(TAMANHO_MAXIMO_BYTES + 1) };
    const downloader = criarVideoDownloader({ fetchFn: jest.fn().mockResolvedValue(enorme) });
    await expect(downloader.baixarVideo('https://cdn/v.mp4')).rejects.toMatchObject({ statusCode: 422 });
  });

  test('sucesso retorna buffer e mimeType normalizado (sem parâmetros)', async () => {
    const downloader = criarVideoDownloader({
      fetchFn: jest.fn().mockResolvedValue(
        respostaFake({ bytes: new Uint8Array([10, 20, 30]), contentType: 'video/mp4; codecs=avc1' })
      ),
    });
    const { buffer, mimeType } = await downloader.baixarVideo('https://cdn/v.mp4');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer).toHaveLength(3);
    expect(mimeType).toBe('video/mp4');
  });

  test('mimeType cai para video/mp4 quando o header está ausente', async () => {
    const semTipo = { ...respostaFake(), headers: { get: () => null } };
    const downloader = criarVideoDownloader({ fetchFn: jest.fn().mockResolvedValue(semTipo) });
    const { mimeType } = await downloader.baixarVideo('https://cdn/v.mp4');
    expect(mimeType).toBe('video/mp4');
  });
});
