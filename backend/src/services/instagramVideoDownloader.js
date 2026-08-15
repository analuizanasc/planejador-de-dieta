'use strict';

const AppError = require('../utils/AppError');

// Limite defensivo de tamanho do vídeo baixado (~50MB). Reels de receita
// são curtos; acima disso provavelmente é um vídeo longo que não vale a
// pena mandar pro Gemini e ainda encareceria a chamada.
const TAMANHO_MAXIMO_BYTES = 50 * 1024 * 1024;

/**
 * Factory do downloader de vídeo. `fetchFn` injetável para testes.
 * Retorna `{ baixarVideo(urlVideo) }` que resolve
 * `{ buffer, mimeType }` — os bytes crus para repassar ao Gemini.
 * Lança AppError em falha; o orquestrador trata isso como soft-fail.
 */
function criarVideoDownloader({ fetchFn = fetch } = {}) {
  async function baixarVideo(urlVideo) {
    if (!urlVideo || typeof urlVideo !== 'string') {
      throw new AppError(422, 'Post sem vídeo disponível para análise.');
    }

    let resposta;
    try {
      resposta = await fetchFn(urlVideo, { redirect: 'follow' });
    } catch {
      throw new AppError(422, 'Não foi possível baixar o vídeo do post.');
    }

    if (!resposta || !resposta.ok) {
      throw new AppError(422, 'Não foi possível baixar o vídeo do post.');
    }

    const arrayBuffer = await resposta.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new AppError(422, 'O vídeo do post veio vazio.');
    }
    if (buffer.length > TAMANHO_MAXIMO_BYTES) {
      throw new AppError(422, 'O vídeo do post é grande demais para análise automática.');
    }

    const mimeType =
      (resposta.headers && typeof resposta.headers.get === 'function'
        ? resposta.headers.get('content-type')
        : null) || 'video/mp4';

    return { buffer, mimeType: mimeType.split(';')[0].trim() };
  }

  return { baixarVideo };
}

module.exports = { criarVideoDownloader, TAMANHO_MAXIMO_BYTES };
