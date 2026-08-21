'use strict';

const express = require('express');
const errorHandler = require('./middlewares/errorHandler');
const autenticar = require('./middlewares/auth');
const criarRotasAuth = require('./routes/auth');
const criarRotasReceitas = require('./routes/receitas');
const criarRotasCadernos = require('./routes/cadernos');
const criarRotasImportacaoReceitas = require('./routes/receitasImportacao');
const criarRotasPreferencias = require('./routes/preferencias');
const criarRotasCardapio = require('./routes/cardapio');

function criarApp(db, opcoes = {}) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/auth', criarRotasAuth(db));
  // Rota mais específica antes de /receitas para não colidir com /receitas/:id.
  app.use(
    '/receitas/importar-instagram',
    autenticar,
    criarRotasImportacaoReceitas(db, opcoes.importadorDeps)
  );
  app.use('/cadernos', autenticar, criarRotasCadernos(db));
  app.use('/receitas', autenticar, criarRotasReceitas(db));
  app.use('/preferencias', autenticar, criarRotasPreferencias(db));
  app.use('/cardapio', autenticar, criarRotasCardapio(db));

  app.use((req, res) => {
    res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  });

  app.use(errorHandler);

  return app;
}

module.exports = criarApp;
