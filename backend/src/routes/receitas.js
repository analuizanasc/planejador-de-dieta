'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validarReceitaPayload, validarCategoria } = require('../utils/validators');
const repo = require('../repositories/receitasRepository');
const cadernosRepo = require('../repositories/cadernosRepository');

function parseId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'id deve ser um número inteiro positivo');
  }
  return id;
}

// Traduz o filtro ?caderno= da query: 'nenhum' → receitas avulsas (null);
// um id → aquele caderno; ausente → sem filtro (undefined).
function parseFiltroCaderno(valor) {
  if (valor === undefined) return undefined;
  if (valor === 'nenhum') return null;
  return parseId(valor);
}

// Garante que o caderno informado pertence ao usuário (RN7). Vínculo com
// caderno de outro usuário (ou inexistente) é 400, não vaza existência.
function garantirCadernoDoUsuario(db, usuarioId, caderno_id) {
  if (caderno_id == null) return;
  if (!cadernosRepo.buscarCadernoPorId(db, usuarioId, caderno_id)) {
    throw new AppError(400, `caderno_id ${caderno_id} não encontrado`);
  }
}

module.exports = function criarRotasReceitas(db) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { categoria } = req.query;
      if (categoria !== undefined) validarCategoria(categoria, 'categoria (query)');
      const caderno_id = parseFiltroCaderno(req.query.caderno);
      res.json(repo.listarReceitas(db, req.usuarioId, { categoria, caderno_id }));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const receita = repo.buscarReceitaPorId(db, req.usuarioId, id);
      if (!receita) throw new AppError(404, `Receita ${id} não encontrada`);
      res.json(receita);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dados = validarReceitaPayload(req.body);
      garantirCadernoDoUsuario(db, req.usuarioId, dados.caderno_id);
      const receita = repo.criarReceita(db, req.usuarioId, dados);
      res.status(201).json(receita);
    })
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const dados = validarReceitaPayload(req.body);
      garantirCadernoDoUsuario(db, req.usuarioId, dados.caderno_id);
      const receita = repo.atualizarReceita(db, req.usuarioId, id, dados);
      if (!receita) throw new AppError(404, `Receita ${id} não encontrada`);
      res.json(receita);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      const removida = repo.deletarReceita(db, req.usuarioId, id);
      if (!removida) throw new AppError(404, `Receita ${id} não encontrada`);
      res.status(204).end();
    })
  );

  return router;
};
