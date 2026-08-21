'use strict';

const AppError = require('../utils/AppError');
const { ehUrlInstagramValida } = require('./instagramScraper');

const BASE = 'https://api.apify.com/v2';
// Actor oficial de Instagram do Apify. Slug usa "~" no lugar de "/" na URL da API.
const ACTOR_PADRAO = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper';

// O undici (fetch nativo) às vezes lança erro de rede transitório
// (inclusive um enganoso "Failed to parse URL" para uma URL válida). Retry
// curto com backoff absorve essas falhas antes de desistir.
const MAX_TENTATIVAS = 3;
// Teto de espera pelo run do Apify terminar (o actor de fato raspa o Instagram).
const POLL_INTERVALO_MS = 3000;
const POLL_MAX_MS = 120 * 1000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Busca o conteúdo do post via Apify (scraping autenticado gerenciado).
 * Usa o fluxo assíncrono do Apify (inicia run → aguarda → baixa dataset),
 * que é mais estável que o endpoint run-sync. `fetchFn` e `token` injetáveis
 * para teste. Retorna o mesmo contrato do scraper anônimo, com um campo extra
 * `comentarios` (array de strings).
 */
function criarApifyFetcher({
  token = process.env.APIFY_API_TOKEN,
  fetchFn = fetch,
  actor = ACTOR_PADRAO,
  dormir = espera,
} = {}) {
  // Faz uma chamada HTTP com retry em falha de rede e devolve o JSON.
  async function pedirJson(url, opcoes) {
    let resposta;
    let ultimoErro;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
      try {
        resposta = await fetchFn(url, opcoes);
        break;
      } catch (e) {
        ultimoErro = e;
        if (tentativa < MAX_TENTATIVAS) await dormir(tentativa * 800);
      }
    }
    if (!resposta) {
      throw new AppError(
        502,
        `Não foi possível contatar o serviço de importação (Apify)${
          ultimoErro ? `: ${ultimoErro.message}` : ''
        }.`
      );
    }
    if (!resposta.ok) {
      throw new AppError(502, `O serviço de importação retornou um erro (${resposta.status}).`);
    }
    return resposta.json().catch(() => null);
  }

  async function buscarPost(url) {
    if (!ehUrlInstagramValida(url)) {
      throw new AppError(400, 'Informe um link válido de post ou reel do Instagram.');
    }
    if (!token) {
      throw new AppError(
        503,
        'Importação não configurada: defina APIFY_API_TOKEN no ambiente do backend.'
      );
    }

    const tk = encodeURIComponent(token);
    const input = { resultsType: 'posts', directUrls: [url.trim()], resultsLimit: 1 };

    // 1) Inicia o run do actor.
    const inicio = await pedirJson(`${BASE}/acts/${actor}/runs?token=${tk}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const run = inicio && inicio.data;
    if (!run || !run.id || !run.defaultDatasetId) {
      throw new AppError(502, 'O serviço de importação não iniciou a análise do post.');
    }

    // 2) Aguarda o run terminar.
    let status = run.status;
    const limite = Date.now() + POLL_MAX_MS;
    while ((status === 'READY' || status === 'RUNNING') && Date.now() < limite) {
      await dormir(POLL_INTERVALO_MS);
      const atual = await pedirJson(`${BASE}/actor-runs/${run.id}?token=${tk}`);
      status = atual && atual.data && atual.data.status;
    }
    if (status !== 'SUCCEEDED') {
      throw new AppError(
        502,
        `A análise do post não foi concluída (status: ${status || 'desconhecido'}). Tente novamente.`
      );
    }

    // 3) Baixa os itens do dataset.
    const itens = await pedirJson(`${BASE}/datasets/${run.defaultDatasetId}/items?token=${tk}`);
    const post = Array.isArray(itens) ? itens[0] : null;
    if (!post) {
      throw new AppError(
        422,
        'Não encontramos o conteúdo desse post (pode ser privado ou removido). Tente cadastrar a receita manualmente.'
      );
    }

    return normalizar(post);
  }

  return { buscarPost };
}

function normalizar(post) {
  const legenda = typeof post.caption === 'string' ? post.caption : '';
  const titulo = post.ownerUsername ? `@${post.ownerUsername}` : '';
  const urlVideo = post.videoUrl || null;
  const imagem = post.displayUrl || null;
  const comentarios = Array.isArray(post.latestComments)
    ? post.latestComments
        .map((c) => (c && typeof c.text === 'string' ? c.text : null))
        .filter(Boolean)
    : [];

  return { legenda, titulo, urlVideo, imagem, comentarios };
}

module.exports = { criarApifyFetcher };
