'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { validarPreferenciasPayload } = require('../utils/validators');
const repo = require('../repositories/preferenciasRepository');

module.exports = function criarRotasPreferencias(db) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(repo.buscarPreferencias(db));
    })
  );

  router.put(
    '/',
    asyncHandler(async (req, res) => {
      const dados = validarPreferenciasPayload(req.body);
      res.json(repo.atualizarPreferencias(db, dados));
    })
  );

  return router;
};
