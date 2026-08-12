import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Todas as chamadas de API passam por /api/* em dev, nunca pelos mesmos
// nomes das rotas do backend direto (/cardapio, /receitas...) — isso evita
// colidir com as rotas do próprio SPA (ex.: /cardapio/semana), que o
// navegador pode requisitar como navegação de página cheia (reload/link
// direto), não só via fetch().
const ALVO_BACKEND = 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: ALVO_BACKEND,
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
    },
  },
})
