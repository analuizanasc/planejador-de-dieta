'use strict';

const {
  criarExtratorReceitaGemini,
  montarPrompt,
} = require('../../src/services/extratorReceitaGemini');
const { CATEGORIAS_VALIDAS } = require('../../src/services/geradorCardapio');
const { RESTRICOES_VALIDAS } = require('../../src/utils/validators');

const RECEITA_JSON = {
  nome: 'Panqueca',
  categoria: 'cafe',
  calorias: 250,
  ingredientes: ['banana', 'ovo'],
  tags_restricao: [],
};

describe('montarPrompt', () => {
  test('inclui o vocabulário válido de categorias e restrições', () => {
    const prompt = montarPrompt('legenda qualquer');
    CATEGORIAS_VALIDAS.forEach((c) => expect(prompt).toContain(c));
    RESTRICOES_VALIDAS.forEach((r) => expect(prompt).toContain(r));
    expect(prompt).toContain('legenda qualquer');
  });

  test('tolera legenda vazia', () => {
    expect(montarPrompt('')).toContain('baseie-se no vídeo');
  });
});

describe('criarExtratorReceitaGemini.extrairReceita', () => {
  test('sem apiKey lança AppError 503 sem chamar o Gemini', async () => {
    const chamarGemini = jest.fn();
    const extrator = criarExtratorReceitaGemini({ apiKey: '', chamarGemini });
    await expect(extrator.extrairReceita({ legenda: 'x' })).rejects.toMatchObject({ statusCode: 503 });
    expect(chamarGemini).not.toHaveBeenCalled();
  });

  test('erro do Gemini vira AppError 502 após esgotar retries', async () => {
    const chamarGemini = jest.fn().mockRejectedValue(new Error('rate limit'));
    const extrator = criarExtratorReceitaGemini({ apiKey: 'k', chamarGemini, dormir: () => Promise.resolve() });
    await expect(extrator.extrairReceita({ legenda: 'x' })).rejects.toMatchObject({ statusCode: 502 });
    expect(chamarGemini).toHaveBeenCalledTimes(3);
  });

  test('retry se recupera após uma falha transitória do Gemini', async () => {
    const chamarGemini = jest
      .fn()
      .mockRejectedValueOnce(new Error('transitório'))
      .mockResolvedValueOnce(RECEITA_JSON);
    const extrator = criarExtratorReceitaGemini({ apiKey: 'k', chamarGemini, dormir: () => Promise.resolve() });
    await expect(extrator.extrairReceita({ legenda: 'x' })).resolves.toEqual(RECEITA_JSON);
    expect(chamarGemini).toHaveBeenCalledTimes(2);
  });

  test('resposta não interpretável vira AppError 502', async () => {
    const chamarGemini = jest.fn().mockResolvedValue('isto não é json');
    const extrator = criarExtratorReceitaGemini({ apiKey: 'k', chamarGemini });
    await expect(extrator.extrairReceita({ legenda: 'x' })).rejects.toMatchObject({ statusCode: 502 });
  });

  test('resposta em texto JSON é parseada', async () => {
    const chamarGemini = jest.fn().mockResolvedValue(JSON.stringify(RECEITA_JSON));
    const extrator = criarExtratorReceitaGemini({ apiKey: 'k', chamarGemini });
    await expect(extrator.extrairReceita({ legenda: 'x' })).resolves.toEqual(RECEITA_JSON);
  });

  test('resposta em texto JSON cercado por ```json é parseada', async () => {
    const chamarGemini = jest.fn().mockResolvedValue('```json\n' + JSON.stringify(RECEITA_JSON) + '\n```');
    const extrator = criarExtratorReceitaGemini({ apiKey: 'k', chamarGemini });
    await expect(extrator.extrairReceita({ legenda: 'x' })).resolves.toEqual(RECEITA_JSON);
  });

  test('repassa o vídeo para o chamarGemini', async () => {
    const chamarGemini = jest.fn().mockResolvedValue(RECEITA_JSON);
    const extrator = criarExtratorReceitaGemini({ apiKey: 'k', chamarGemini });
    const video = { buffer: Buffer.from([1]), mimeType: 'video/mp4' };
    await extrator.extrairReceita({ legenda: 'x', video });
    expect(chamarGemini).toHaveBeenCalledWith(expect.objectContaining({ video, apiKey: 'k' }));
  });

  test('repassa a URL do YouTube para o chamarGemini', async () => {
    const chamarGemini = jest.fn().mockResolvedValue(RECEITA_JSON);
    const extrator = criarExtratorReceitaGemini({ apiKey: 'k', chamarGemini });
    await extrator.extrairReceita({ youtubeUrl: 'https://youtu.be/abc123' });
    expect(chamarGemini).toHaveBeenCalledWith(
      expect.objectContaining({ youtubeUrl: 'https://youtu.be/abc123' })
    );
  });
});
