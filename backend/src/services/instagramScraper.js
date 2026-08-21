'use strict';

const AppError = require('../utils/AppError');

// Regex de URL de post/reel do Instagram. Cobre /p/, /reel/ e /reels/,
// com ou sem www, e ignora querystring/barra final.
const URL_INSTAGRAM_REGEX =
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?/i;

// User-Agent de navegador real: o Instagram serve uma página "casca" (login
// wall) para clientes não-navegador, sem as meta tags og:* que precisamos.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function ehUrlInstagramValida(url) {
  return typeof url === 'string' && URL_INSTAGRAM_REGEX.test(url.trim());
}

// Extrai o conteúdo de <meta property="X" content="Y"> ou name="X".
// Regex simples e tolerante à ordem dos atributos, suficiente para as
// meta tags Open Graph que o Instagram renderiza no HTML inicial.
function lerMeta(html, chave) {
  const escapada = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const padroes = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapada}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapada}["']`, 'i'),
  ];
  for (const padrao of padroes) {
    const m = html.match(padrao);
    if (m) return decodificarEntidades(m[1]);
  }
  return null;
}

function decodificarEntidades(texto) {
  if (!texto) return texto;
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Factory do scraper. `fetchFn` é injetável para permitir testes sem rede.
 * Retorna `{ buscarPost(url) }` que devolve
 * `{ legenda, titulo, urlVideo }` ou lança AppError.
 */
function criarInstagramScraper({ fetchFn = fetch } = {}) {
  async function buscarPost(url) {
    if (!ehUrlInstagramValida(url)) {
      throw new AppError(400, 'Informe um link válido de post ou reel do Instagram.');
    }

    let resposta;
    try {
      resposta = await fetchFn(url.trim(), {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
        redirect: 'follow',
      });
    } catch {
      throw new AppError(
        422,
        'Não foi possível acessar esse post. Verifique sua conexão e tente novamente, ou cadastre a receita manualmente.'
      );
    }

    if (!resposta || !resposta.ok) {
      throw new AppError(
        422,
        'Não foi possível acessar esse post. Ele pode ser privado, ter sido removido, ou o Instagram bloqueou a requisição. Tente cadastrar a receita manualmente.'
      );
    }

    const html = await resposta.text();
    if (!html || html.length < 200) {
      throw new AppError(
        422,
        'O Instagram não retornou o conteúdo do post (possível bloqueio ou post privado). Tente cadastrar a receita manualmente.'
      );
    }

    const legenda = lerMeta(html, 'og:description') || lerMeta(html, 'description') || '';
    const titulo = lerMeta(html, 'og:title') || '';
    const urlVideo = lerMeta(html, 'og:video') || lerMeta(html, 'og:video:secure_url') || null;
    const imagem = lerMeta(html, 'og:image') || null;

    if (!legenda && !titulo && !urlVideo) {
      throw new AppError(
        422,
        'Não encontramos o conteúdo desse post (o Instagram pode ter bloqueado ou o post é privado). Tente cadastrar a receita manualmente.'
      );
    }

    return { legenda, titulo, urlVideo, imagem };
  }

  return { buscarPost };
}

module.exports = { criarInstagramScraper, ehUrlInstagramValida };
