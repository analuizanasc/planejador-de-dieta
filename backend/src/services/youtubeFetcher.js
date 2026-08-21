'use strict';

// Busca título + descrição de um vídeo via YouTube Data API v3 (cota grátis).
// Usado para tentar extrair a receita do TEXTO da descrição antes de recorrer
// ao vídeo no Gemini (que custa tokens). Falhas são silenciosas: retorna null
// e o orquestrador cai no vídeo como fallback.
const API = 'https://www.googleapis.com/youtube/v3/videos';

function extrairVideoId(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/(?:[?&]v=|\/shorts\/|\/live\/|youtu\.be\/)([\w-]{6,})/i);
  return m ? m[1] : null;
}

function criarYoutubeFetcher({ apiKey = process.env.YOUTUBE_API_KEY, fetchFn = fetch } = {}) {
  async function buscar(url) {
    if (!apiKey) return null;
    const id = extrairVideoId(url);
    if (!id) return null;

    let resposta;
    try {
      resposta = await fetchFn(`${API}?part=snippet&id=${id}&key=${encodeURIComponent(apiKey)}`);
    } catch {
      return null;
    }
    if (!resposta || !resposta.ok) return null;

    const dados = await resposta.json().catch(() => null);
    const snippet = dados && dados.items && dados.items[0] && dados.items[0].snippet;
    if (!snippet) return null;

    return {
      titulo: snippet.title || '',
      descricao: snippet.description || '',
      imagem: melhorThumbnail(snippet.thumbnails),
    };
  }

  return { buscar };
}

// Escolhe a maior thumbnail disponível (a API nem sempre entrega todas).
function melhorThumbnail(thumbnails) {
  if (!thumbnails || typeof thumbnails !== 'object') return null;
  for (const chave of ['maxres', 'standard', 'high', 'medium', 'default']) {
    if (thumbnails[chave] && thumbnails[chave].url) return thumbnails[chave].url;
  }
  return null;
}

module.exports = { criarYoutubeFetcher, extrairVideoId, melhorThumbnail };
