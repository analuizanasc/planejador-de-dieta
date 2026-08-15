'use strict';

const {
  criarImportadorReceita,
  legendaInsuficiente,
} = require('../../src/services/importadorReceitaInstagram');
const AppError = require('../../src/utils/AppError');

const LEGENDA_LONGA =
  'Panqueca de banana bem fofinha: 1 banana madura, 2 ovos, 3 colheres de aveia. Bata tudo e frite.';
const DRAFT_OK = {
  nome: 'Panqueca',
  categoria: 'cafe',
  calorias: 250,
  ingredientes: ['banana', 'ovo'],
  tags_restricao: [],
  permite_repeticao: false,
};

// Colaboradores fake configuráveis por teste.
function montar({ post, downloadThrows = false, extrairImpl } = {}) {
  const scraper = { buscarPost: jest.fn().mockResolvedValue(post) };
  const downloader = {
    baixarVideo: downloadThrows
      ? jest.fn().mockRejectedValue(new AppError(422, 'falhou'))
      : jest.fn().mockResolvedValue({ buffer: Buffer.from([1]), mimeType: 'video/mp4' }),
  };
  const extrator = {
    extrairReceita: extrairImpl || jest.fn().mockResolvedValue({ ...DRAFT_OK }),
  };
  const validarComAvisos = jest.fn((bruto) => ({ dados: bruto, avisos: [] }));
  const importador = criarImportadorReceita({ scraper, downloader, extrator, validarComAvisos });
  return { importador, scraper, downloader, extrator, validarComAvisos };
}

describe('legendaInsuficiente', () => {
  test('considera curta/vazia como insuficiente', () => {
    expect(legendaInsuficiente('')).toBe(true);
    expect(legendaInsuficiente('bolo top')).toBe(true);
  });
  test('considera legenda descritiva como suficiente', () => {
    expect(legendaInsuficiente(LEGENDA_LONGA)).toBe(false);
  });
});

describe('criarImportadorReceita.importar', () => {
  test('legenda suficiente: NÃO baixa vídeo, fonte=legenda, extrator recebe video null', async () => {
    const { importador, downloader, extrator } = montar({
      post: { legenda: LEGENDA_LONGA, titulo: 'T', urlVideo: 'https://cdn/v.mp4' },
    });

    const r = await importador.importar('https://www.instagram.com/reel/ABC/');

    expect(downloader.baixarVideo).not.toHaveBeenCalled();
    expect(extrator.extrairReceita).toHaveBeenCalledWith(
      expect.objectContaining({ video: null })
    );
    expect(r.fonte).toBe('legenda');
    expect(r.draft).toEqual(DRAFT_OK);
    expect(r.avisos).toEqual([]);
  });

  test('legenda curta + vídeo: baixa e envia o vídeo, fonte=legenda+video', async () => {
    const { importador, downloader, extrator } = montar({
      post: { legenda: 'curta', titulo: '', urlVideo: 'https://cdn/v.mp4' },
    });

    const r = await importador.importar('https://www.instagram.com/reel/ABC/');

    expect(downloader.baixarVideo).toHaveBeenCalledWith('https://cdn/v.mp4');
    expect(extrator.extrairReceita).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ mimeType: 'video/mp4' }) })
    );
    expect(r.fonte).toBe('legenda+video');
  });

  test('legenda curta + falha ao baixar vídeo: soft-fail com aviso, fonte=legenda', async () => {
    const { importador, extrator } = montar({
      post: { legenda: 'curta', titulo: '', urlVideo: 'https://cdn/v.mp4' },
      downloadThrows: true,
    });

    const r = await importador.importar('https://www.instagram.com/reel/ABC/');

    expect(extrator.extrairReceita).toHaveBeenCalledWith(expect.objectContaining({ video: null }));
    expect(r.fonte).toBe('legenda');
    expect(r.avisos.some((a) => a.toLowerCase().includes('baixar o vídeo'))).toBe(true);
  });

  test('legenda curta + sem vídeo: aviso de conteúdo incompleto', async () => {
    const { importador, downloader } = montar({
      post: { legenda: 'curta', titulo: '', urlVideo: null },
    });

    const r = await importador.importar('https://www.instagram.com/p/ABC/');

    expect(downloader.baixarVideo).not.toHaveBeenCalled();
    expect(r.avisos.some((a) => a.toLowerCase().includes('curta'))).toBe(true);
  });

  test('mescla os avisos de validação vindos de validarComAvisos', async () => {
    const scraper = { buscarPost: jest.fn().mockResolvedValue({ legenda: LEGENDA_LONGA, titulo: '', urlVideo: null }) };
    const extrator = { extrairReceita: jest.fn().mockResolvedValue({ categoria: 'brunch' }) };
    const validarComAvisos = jest.fn(() => ({ dados: DRAFT_OK, avisos: ['Categoria não reconhecida.'] }));
    const importador = criarImportadorReceita({ scraper, extrator, validarComAvisos });

    const r = await importador.importar('https://www.instagram.com/p/ABC/');
    expect(r.avisos).toContain('Categoria não reconhecida.');
  });

  test('comentários vindos do buscador entram no texto enviado ao extrator', async () => {
    const scraper = {
      buscarPost: jest.fn().mockResolvedValue({
        legenda: 'curta',
        titulo: '@chef',
        urlVideo: null,
        comentarios: ['Receita: 1 banana, 2 ovos, 3 colheres de aveia. Bata e frite.'],
      }),
    };
    const extrator = { extrairReceita: jest.fn().mockResolvedValue({ ...DRAFT_OK }) };
    const importador = criarImportadorReceita({
      scraper,
      extrator,
      validarComAvisos: (b) => ({ dados: b, avisos: [] }),
    });

    await importador.importar('https://www.instagram.com/p/ABC/');

    const textoEnviado = extrator.extrairReceita.mock.calls[0][0].legenda;
    expect(textoEnviado).toContain('1 banana, 2 ovos');
  });

  test('erro do scraper propaga (hard-fail)', async () => {
    const scraper = { buscarPost: jest.fn().mockRejectedValue(new AppError(422, 'bloqueado')) };
    const importador = criarImportadorReceita({ scraper });
    await expect(importador.importar('https://www.instagram.com/p/ABC/')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('YouTube sem descrição disponível: manda a URL do vídeo ao extrator', async () => {
    const scraper = { buscarPost: jest.fn() };
    const downloader = { baixarVideo: jest.fn() };
    const extrator = { extrairReceita: jest.fn().mockResolvedValue({ ...DRAFT_OK }) };
    const youtubeFetcher = { buscar: jest.fn().mockResolvedValue(null) }; // sem API key / não achou
    const importador = criarImportadorReceita({
      scraper,
      downloader,
      extrator,
      youtubeFetcher,
      validarComAvisos: (b) => ({ dados: b, avisos: [] }),
    });

    const r = await importador.importar('https://youtu.be/abc123');

    expect(scraper.buscarPost).not.toHaveBeenCalled();
    expect(downloader.baixarVideo).not.toHaveBeenCalled();
    expect(extrator.extrairReceita).toHaveBeenCalledWith({ youtubeUrl: 'https://youtu.be/abc123' });
    expect(r.fonte).toBe('youtube');
    expect(r.draft).toEqual(DRAFT_OK);
  });

  test('YouTube com receita na descrição: usa o texto e NÃO assiste ao vídeo', async () => {
    const extrator = { extrairReceita: jest.fn().mockResolvedValue({ ...DRAFT_OK }) };
    const youtubeFetcher = {
      buscar: jest.fn().mockResolvedValue({ titulo: 'Bolo', descricao: 'Ingredientes: 2 ovos, farinha' }),
    };
    const importador = criarImportadorReceita({
      extrator,
      youtubeFetcher,
      validarComAvisos: (b) => ({ dados: b, avisos: [] }),
    });

    const r = await importador.importar('https://youtu.be/abc123');

    expect(extrator.extrairReceita).toHaveBeenCalledTimes(1);
    const arg = extrator.extrairReceita.mock.calls[0][0];
    expect(arg.legenda).toContain('2 ovos');
    expect(arg.youtubeUrl).toBeUndefined();
    expect(r.fonte).toBe('descricao');
  });

  test('YouTube com descrição sem receita: cai para o vídeo (fallback)', async () => {
    const semIngredientes = { ...DRAFT_OK, ingredientes: [] };
    const extrator = {
      extrairReceita: jest
        .fn()
        .mockResolvedValueOnce(semIngredientes) // 1ª chamada: texto da descrição, sem ingredientes
        .mockResolvedValueOnce({ ...DRAFT_OK }), // 2ª chamada: vídeo, com ingredientes
    };
    const youtubeFetcher = {
      buscar: jest.fn().mockResolvedValue({ titulo: 'Vlog', descricao: 'link na bio, curtam!' }),
    };
    const importador = criarImportadorReceita({
      extrator,
      youtubeFetcher,
      validarComAvisos: (b) => ({ dados: b, avisos: [] }),
    });

    const r = await importador.importar('https://youtu.be/abc123');

    expect(extrator.extrairReceita).toHaveBeenCalledTimes(2);
    expect(extrator.extrairReceita.mock.calls[1][0]).toEqual({ youtubeUrl: 'https://youtu.be/abc123' });
    expect(r.fonte).toBe('youtube');
  });

  test('link não suportado (nem IG nem YouTube) lança 400', async () => {
    const importador = criarImportadorReceita({ scraper: { buscarPost: jest.fn() } });
    await expect(importador.importar('https://tiktok.com/@x/video/1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('erro do extrator propaga (hard-fail)', async () => {
    const { importador } = montar({
      post: { legenda: LEGENDA_LONGA, titulo: '', urlVideo: null },
      extrairImpl: jest.fn().mockRejectedValue(new AppError(502, 'IA fora')),
    });
    await expect(importador.importar('https://www.instagram.com/p/ABC/')).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});
