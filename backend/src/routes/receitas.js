'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validarReceitaPayload, validarCategoria } = require('../utils/validators');
const repo = require('../repositories/receitasRepository');

function parseId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'id deve ser um número inteiro positivo');
  }
  return id;
}

module.exports = function criarRotasReceitas(db) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { categoria } = req.query;
      if (categoria !== undefined) validarCategoria(categoria, 'categoria (query)');
      res.json(repo.listarReceitas(db, { categoria }));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const receita = repo.buscarReceitaPorId(db, id);
      if (!receita) throw new AppError(404, `Receita ${id} não encontrada`);
      res.json(receita);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dados = validarReceitaPayload(req.body);
      const receita = repo.criarReceita(db, dados);
      res.status(201).json(receita);
    })
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const dados = validarReceitaPayload(req.body);
      const receita = repo.atualizarReceita(db, id, dados);
      if (!receita) throw new AppError(404, `Receita ${id} não encontrada`);
      res.json(receita);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const removida = repo.deletarReceita(db, id);
      if (!removida) throw new AppError(404, `Receita ${id} não encontrada`);
      res.status(204).end();
    })
  );

  return router;
};
