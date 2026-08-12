'use strict';

const express = require('express');
const errorHandler = require('./middlewares/errorHandler');
const criarRotasReceitas = require('./routes/receitas');
const criarRotasPreferencias = require('./routes/preferencias');
const criarRotasCardapio = require('./routes/cardapio');

function criarApp(db) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/receitas', criarRotasReceitas(db));
  app.use('/preferencias', criarRotasPreferencias(db));
  app.use('/cardapio', criarRotasCardapio(db));

  app.use((req, res) => {
    res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  });

  app.use(errorHandler);

  return app;
}

module.exports = criarApp;
