'use strict';

const AppError = require('../utils/AppError');
const { CATEGORIAS_VALIDAS } = require('./geradorCardapio');
const { RESTRICOES_VALIDAS } = require('../utils/validators');

const MODELO_PADRAO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Schema que o Gemini deve seguir na resposta (responseSchema). Mantém os
// nomes de campo idênticos aos da receita para o rascunho cair direto no
// formulário. Categoria/tags ficam como string livre aqui e são validadas
// depois em validarReceitaComAvisos — assim, se o modelo inventar um valor,
// a request não quebra, só vira aviso.
const SCHEMA_RECEITA = {
  type: 'object',
  properties: {
    nome: { type: 'string' },
    categorias: { type: 'array', items: { type: 'string' } },
    calorias: { type: 'number' },
    ingredientes: { type: 'array', items: { type: 'string' } },
    modo_preparo: { type: 'string' },
    tags_restricao: { type: 'array', items: { type: 'string' } },
  },
  required: ['nome', 'categorias', 'ingredientes'],
};

function montarPrompt(legenda) {
  return [
    'Você é um assistente que extrai receitas de vídeos e posts de redes sociais (Instagram, YouTube).',
    'Analise o conteúdo abaixo (o texto fornecido e, se houver, o vídeo anexado — incluindo a fala e o texto que aparece na tela) e devolva UMA receita estruturada em JSON.',
    '',
    'Regras:',
    `- "categorias" é uma lista com um ou mais destes valores: ${CATEGORIAS_VALIDAS.join(', ')}. Inclua todas as refeições em que o prato se encaixa (ex.: um cuscuz pode ser café e lanche).`,
    `- "tags_restricao" só pode conter valores desta lista (inclua apenas os que a receita CONTÉM): ${RESTRICOES_VALIDAS.join(', ')}. Se a receita não contém nenhum, devolva uma lista vazia.`,
    '- "calorias" é uma estimativa numérica por porção. Se não der para estimar com segurança, use 0.',
    '- "ingredientes" é uma lista de strings, um ingrediente por item, com quantidades quando disponíveis.',
    '- "modo_preparo" é o passo a passo do preparo, com os passos numerados em ordem, separados por quebra de linha. Se o conteúdo não descrever o preparo, devolva uma string vazia.',
    '- Escreva em português do Brasil. Não invente ingredientes que não aparecem no conteúdo.',
    '',
    'Texto fornecido (legenda/descrição/comentários):',
    '"""',
    legenda || '(sem texto; baseie-se no vídeo)',
    '"""',
  ].join('\n');
}

// Adapter real do @google/genai. Isolado e injetável: os testes passam um
// `chamarGemini` fake, então este código (que fala com a rede) nunca roda em CI.
async function chamarGeminiReal({ apiKey, model, prompt, video, youtubeUrl, responseSchema }) {
  const { GoogleGenAI, createUserContent, createPartFromUri } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const partes = [prompt];

  if (youtubeUrl) {
    // O Gemini lê URLs do YouTube nativamente — sem upload, sem Files API.
    partes.unshift({ fileData: { fileUri: youtubeUrl } });
  }

  if (video) {
    // Vídeos vão pela Files API (recomendado p/ > 20MB ou > ~1min).
    const arquivo = await ai.files.upload({
      file: new Blob([video.buffer], { type: video.mimeType }),
      config: { mimeType: video.mimeType },
    });

    // Espera o processamento do arquivo terminar antes de gerar.
    let estado = await ai.files.get({ name: arquivo.name });
    const limite = Date.now() + 2 * 60 * 1000; // teto de 2 min
    while (estado.state === 'PROCESSING' && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 3000));
      estado = await ai.files.get({ name: arquivo.name });
    }
    if (estado.state !== 'ACTIVE') {
      throw new Error(`Arquivo de vídeo não ficou pronto (estado: ${estado.state}).`);
    }

    partes.unshift(createPartFromUri(estado.uri, estado.mimeType));
  }

  const resposta = await ai.models.generateContent({
    model,
    contents: createUserContent(partes),
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      // Resolução baixa de vídeo: ~3x menos tokens (100 vs 300 tokens/seg).
      // Suficiente para ler ingredientes na tela e ouvir a fala da receita.
      mediaResolution: 'MEDIA_RESOLUTION_LOW',
    },
  });

  return resposta.text;
}

/**
 * Factory do extrator. `chamarGemini` injetável para testes.
 * `extrairReceita({ legenda, video })` → objeto de rascunho (não validado).
 */
function criarExtratorReceitaGemini({
  apiKey = process.env.GEMINI_API_KEY,
  model = MODELO_PADRAO,
  chamarGemini = chamarGeminiReal,
  dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  async function extrairReceita({ legenda, video, youtubeUrl } = {}) {
    if (!apiKey) {
      throw new AppError(
        503,
        'Extração por IA não configurada: defina GEMINI_API_KEY no ambiente do backend.'
      );
    }

    // Retry curto: o Gemini/undici às vezes lança erro de rede transitório.
    // Sem isso, um tropeço momentâneo mataria o request inteiro.
    let textoResposta;
    let ultimoErro;
    for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
      try {
        textoResposta = await chamarGemini({
          apiKey,
          model,
          prompt: montarPrompt(legenda),
          video: video || null,
          youtubeUrl: youtubeUrl || null,
          responseSchema: SCHEMA_RECEITA,
        });
        ultimoErro = null;
        break;
      } catch (e) {
        ultimoErro = e;
        if (tentativa < 3) await dormir(tentativa * 800);
      }
    }
    if (ultimoErro) {
      throw new AppError(
        502,
        'O serviço de IA não conseguiu processar o post agora. Tente novamente em instantes.'
      );
    }

    const dados = interpretarResposta(textoResposta);
    if (!dados || typeof dados !== 'object') {
      throw new AppError(502, 'A IA não retornou um resultado utilizável para este post.');
    }
    return dados;
  }

  return { extrairReceita };
}

// Aceita tanto um objeto já parseado quanto texto JSON (com ou sem cercas
// markdown ```json), tolerando pequenas variações da resposta do modelo.
function interpretarResposta(resposta) {
  if (resposta && typeof resposta === 'object') return resposta;
  if (typeof resposta !== 'string') return null;

  const limpo = resposta.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(limpo);
  } catch {
    return null;
  }
}

module.exports = { criarExtratorReceitaGemini, montarPrompt, SCHEMA_RECEITA };
