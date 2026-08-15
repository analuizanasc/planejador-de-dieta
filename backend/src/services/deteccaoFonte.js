'use strict';

const { ehUrlInstagramValida } = require('./instagramScraper');

// Aceita youtube.com/watch?v=, youtu.be/<id>, youtube.com/shorts/<id>,
// com ou sem www/m., ignorando querystring extra.
const YOUTUBE_REGEX =
  /^https?:\/\/((www\.|m\.)?youtube\.com\/(watch\?v=|shorts\/|live\/)[\w-]+|youtu\.be\/[\w-]+)/i;

function ehUrlYoutubeValida(url) {
  return typeof url === 'string' && YOUTUBE_REGEX.test(url.trim());
}

// Detecta a origem do link. Retorna 'instagram', 'youtube' ou null.
function detectarFonte(url) {
  if (ehUrlInstagramValida(url)) return 'instagram';
  if (ehUrlYoutubeValida(url)) return 'youtube';
  return null;
}

module.exports = { detectarFonte, ehUrlYoutubeValida };
