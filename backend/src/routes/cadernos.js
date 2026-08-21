'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validarCadernoPayload } = require('../utils/validators');
const repo = require('../repositories/cadernosRepository');

function parseId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'id deve ser um número inteiro positivo');
  }
  return id;
}

module.exports = function criarRotasCadernos(db) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(repo.listarCadernos(db, req.usuarioId));
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dados = validarCadernoPayload(req.body);
      try {
        res.status(201).json(repo.criarCaderno(db, req.usuarioId, dados));
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new AppError(409, `Já existe um caderno chamado "${dados.nome}".`);
        }
        throw e;
      }
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!repo.deletarCaderno(db, req.usuarioId, id)) {
        throw new AppError(404, `Caderno ${id} não encontrado`);
      }
      res.status(204).end();
    })
  );

  return router;
};
