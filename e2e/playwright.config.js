'use strict';

const { defineConfig } = require('@playwright/test');

const PORTA_BACKEND = 3000;
const PORTA_FRONTEND = 5173;

// Local: cada pacote fixa sua própria versão de Node via nvm (backend em 21
// por causa do binário nativo do better-sqlite3 já compilado; frontend em 22
// por causa do Vite/React Router) — os wrappers escondem essa diferença.
// CI: um único Node 22 fica ativo para o job inteiro e cada pacote instala
// suas dependências frescas ali mesmo, então os scripts de nvm não entram
// no caminho.
const comandoBackend = process.env.CI ? 'npm run start' : 'bash scripts/start.sh';
const comandoFrontend = process.env.CI ? 'npm run dev -- --port 5173 --strictPort' : 'bash scripts/dev.sh';

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORTA_FRONTEND}`,
    trace: 'retain-on-failure',
    // Padrão só grava vídeo de teste que falhou (mesmo critério do trace).
    // Para gravar TODOS os testes de uma run (ex.: demo, revisão manual):
    // PLAYWRIGHT_VIDEO=on npx playwright test
    video: process.env.PLAYWRIGHT_VIDEO || 'retain-on-failure',
  },
  webServer: [
    {
      command: comandoBackend,
      cwd: '../backend',
      url: `http://localhost:${PORTA_BACKEND}/health`,
      env: {
        DB_PATH: ':memory:',
        JWT_SECRET: 'segredo-e2e-nao-usar-em-producao',
        PORT: String(PORTA_BACKEND),
      },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: comandoFrontend,
      cwd: '../frontend',
      url: `http://localhost:${PORTA_FRONTEND}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
