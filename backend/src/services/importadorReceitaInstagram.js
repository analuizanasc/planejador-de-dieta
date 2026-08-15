'use strict';

const AppError = require('../utils/AppError');
const { criarInstagramScraper } = require('./instagramScraper');
const { criarApifyFetcher } = require('./apifyInstagramFetcher');
const { criarVideoDownloader } = require('./instagramVideoDownloader');
const { criarExtratorReceitaGemini } = require('./extratorReceitaGemini');
const { criarYoutubeFetcher } = require('./youtubeFetcher');
const { detectarFonte } = require('./deteccaoFonte');
const { validarReceitaComAvisos } = require('../utils/validators');

// Com APIFY_API_TOKEN definido, usa o Apify (alcança legenda + comentários +
// vídeo mesmo com o Instagram bloqueando requisições anônimas). Sem o token,
// cai no scraper anônimo de meta tags og:* (frágil, mas sem custo).
function escolherBuscador() {
  return process.env.APIFY_API_TOKEN ? criarApifyFetcher() : criarInstagramScraper();
}

// Abaixo desse tamanho, a legenda provavelmente não descreve a receita
// (ex.: só um emoji ou uma frase de efeito) e vale a pena olhar o vídeo.
const TAMANHO_MINIMO_LEGENDA = 40;

function legendaInsuficiente(texto) {
  return !texto || texto.trim().length < TAMANHO_MINIMO_LEGENDA;
}

/**
 * Orquestra o pipeline de importação. Todos os colaboradores são injetáveis
 * (default = implementações reais), o que permite testar cada ramo sem
 * tocar em rede/IA. Único lugar com a lógica de hard-fail vs soft-fail:
 *   - scraper e extrator lançam AppError (hard-fail: sem eles não há rascunho);
 *   - falha ao baixar/analisar o vídeo é soft-fail (vira aviso, segue com legenda).
 */
function criarImportadorReceita({
  scraper = escolherBuscador(),
  downloader = criarVideoDownloader(),
  extrator = criarExtratorReceitaGemini(),
  youtubeFetcher = criarYoutubeFetcher(),
  validarComAvisos = validarReceitaComAvisos,
} = {}) {
  async function importar(url) {
    const fonte = detectarFonte(url);
    if (fonte === 'youtube') return importarYoutube(url);
    if (fonte === 'instagram') return importarInstagram(url);
    throw new AppError(
      400,
      'Informe um link válido de post/reel do Instagram ou de vídeo do YouTube.'
    );
  }

  // YouTube: tenta primeiro extrair a receita da DESCRIÇÃO (texto barato, via
  // YouTube Data API). Só cai para o vídeo no Gemini (mais caro em tokens) se a
  // descrição não render uma receita utilizável ou se a API não estiver configurada.
  async function importarYoutube(url) {
    const info = await youtubeFetcher.buscar(url);
    if (info) {
      const texto = [info.titulo, info.descricao].filter(Boolean).join('\n').trim();
      if (texto) {
        const bruto = await extrator.extrairReceita({ legenda: texto });
        const { dados, avisos } = validarComAvisos(bruto);
        // Descrição rendeu ingredientes → não precisa assistir ao vídeo.
        if (dados.ingredientes.length > 0) {
          return { draft: dados, avisos, fonte: 'descricao' };
        }
      }
    }

    // Fallback: manda a URL do vídeo pro Gemini assistir.
    const bruto = await extrator.extrairReceita({ youtubeUrl: url.trim() });
    const { dados, avisos } = validarComAvisos(bruto);
    return { draft: dados, avisos, fonte: 'youtube' };
  }

  async function importarInstagram(url) {
    const { legenda, titulo, urlVideo, comentarios = [] } = await scraper.buscarPost(url);

    const avisos = [];
    // Comentários entram no texto analisado: receitas costumam vir fixadas no
    // primeiro comentário do autor, não na legenda.
    const textoBase = [titulo, legenda, ...comentarios].filter(Boolean).join('\n').trim();

    let video = null;
    let fonte = 'legenda';

    if (legendaInsuficiente(textoBase)) {
      if (urlVideo) {
        try {
          video = await downloader.baixarVideo(urlVideo);
          fonte = 'legenda+video';
        } catch {
          avisos.push(
            'Não foi possível baixar o vídeo do post para análise; a receita foi extraída apenas da legenda.'
          );
        }
      } else {
        avisos.push(
          'A legenda é curta e não há vídeo disponível; a receita extraída pode estar incompleta — confira os campos.'
        );
      }
    }

    const bruto = await extrator.extrairReceita({ legenda: textoBase, video });
    const { dados, avisos: avisosValidacao } = validarComAvisos(bruto);

    return { draft: dados, avisos: [...avisos, ...avisosValidacao], fonte };
  }

  return { importar };
}

module.exports = { criarImportadorReceita, legendaInsuficiente, TAMANHO_MINIMO_LEGENDA };
