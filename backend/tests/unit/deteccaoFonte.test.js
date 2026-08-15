'use strict';

const { detectarFonte, ehUrlYoutubeValida } = require('../../src/services/deteccaoFonte');

describe('ehUrlYoutubeValida', () => {
  test('aceita watch, youtu.be, shorts e live', () => {
    expect(ehUrlYoutubeValida('https://www.youtube.com/watch?v=abc123')).toBe(true);
    expect(ehUrlYoutubeValida('https://youtu.be/abc123')).toBe(true);
    expect(ehUrlYoutubeValida('https://youtube.com/shorts/abc_123')).toBe(true);
    expect(ehUrlYoutubeValida('https://m.youtube.com/watch?v=abc123')).toBe(true);
  });

  test('rejeita não-YouTube', () => {
    expect(ehUrlYoutubeValida('https://www.instagram.com/p/ABC/')).toBe(false);
    expect(ehUrlYoutubeValida('https://vimeo.com/123')).toBe(false);
    expect(ehUrlYoutubeValida(null)).toBe(false);
  });
});

describe('detectarFonte', () => {
  test('reconhece Instagram', () => {
    expect(detectarFonte('https://www.instagram.com/reel/ABC/')).toBe('instagram');
  });
  test('reconhece YouTube', () => {
    expect(detectarFonte('https://youtu.be/abc123')).toBe('youtube');
  });
  test('retorna null para link não suportado', () => {
    expect(detectarFonte('https://tiktok.com/@x/video/1')).toBeNull();
    expect(detectarFonte('não é url')).toBeNull();
  });
});
