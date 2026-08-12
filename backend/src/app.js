'use strict';

const express = require('express');
const errorHandler = require('./middlewares/errorHandler');
const autenticar = require('./middlewares/auth');
const criarRotasAuth = require('./routes/auth');
const criarRotasReceitas = require('./routes/receitas');
const criarRotasPreferencias = require('./routes/preferencias');
const criarRotasCardapio = require('./routes/cardapio');

function criarApp(db) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/auth', criarRotasAuth(db));
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
