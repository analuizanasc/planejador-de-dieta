'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { criarImportadorReceita } = require('../services/importadorReceitaInstagram');

/**
 * Rota de importação de receita a partir de um link do Instagram.
 * `db` mantido por consistência com as outras factories de rota (hoje não
 * persiste nada — o rascunho é revisado e salvo pelo fluxo normal de /receitas).
 * `deps.importador` permite injetar um importador fake nos testes de integração.
 */
module.exports = function criarRotasImportacaoReceitas(db, deps = {}) {
  const router = express.Router();
  const importador = deps.importador || criarImportadorReceita();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { url } = req.body || {};
      if (typeof url !== 'string' || url.trim().length === 0) {
        throw new AppError(400, 'Informe o link do post do Instagram no campo "url".');
      }

      const resultado = await importador.importar(url);
      res.json(resultado);
    })
  );

  return router;
};
