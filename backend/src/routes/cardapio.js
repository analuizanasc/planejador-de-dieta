'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validarData, validarCategoria } = require('../utils/validators');
const { inicioFimSemana, inicioFimMes, somarDias } = require('../utils/datas');
const { gerarCardapio } = require('../services/geradorCardapio');

const receitasRepo = require('../repositories/receitasRepository');
const preferenciasRepo = require('../repositories/preferenciasRepository');
const cardapioRepo = require('../repositories/cardapioRepository');

const MAX_DIAS_POR_GERACAO = 90;

function resolverDiasSolicitados(body) {
  if (body && Array.isArray(body.dias)) {
    if (body.dias.length === 0) {
      throw new AppError(400, "'dias' não pode ser um array vazio");
    }
    if (body.dias.length > MAX_DIAS_POR_GERACAO) {
      throw new AppError(400, `'dias' não pode ter mais que ${MAX_DIAS_POR_GERACAO} datas`);
    }
    body.dias.forEach((d, i) => validarData(d, `dias[${i}]`));
    return [...body.dias].sort();
  }

  if (body && body.data_inicio !== undefined) {
    validarData(body.data_inicio, 'data_inicio');
    const quantidade = body.quantidade_dias;
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_DIAS_POR_GERACAO) {
      throw new AppError(
        400,
        `quantidade_dias deve ser um inteiro entre 1 e ${MAX_DIAS_POR_GERACAO}`
      );
    }
    return Array.from({ length: quantidade }, (_, i) => somarDias(body.data_inicio, i));
  }

  throw new AppError(
    400,
    "Informe 'dias' (array de datas 'YYYY-MM-DD') ou 'data_inicio' + 'quantidade_dias'"
  );
}

module.exports = function criarRotasCardapio(db) {
  const router = express.Router();

  router.post(
    '/gerar',
    asyncHandler(async (req, res) => {
      const dias = resolverDiasSolicitados(req.body);

      const preferencias = preferenciasRepo.buscarPreferencias(db, req.usuarioId);
      const receitas = receitasRepo.listarReceitas(db, req.usuarioId);
      const historicoAnterior = cardapioRepo.obterHistoricoAnterior(db, req.usuarioId, dias[0]);

      const resultado = gerarCardapio({ receitas, preferencias, dias, historicoAnterior });

      if (resultado.cardapio.length > 0) {
        cardapioRepo.persistirCardapio(db, req.usuarioId, resultado.cardapio);
      }

      // geradorCardapio.js é puro e não conhece "origem" (é conceito de persistência,
      // não de geração) — anota aqui, na borda da rota, para a resposta ficar
      // consistente com o shape retornado por GET/PUT /cardapio.
      const cardapioComOrigem = resultado.cardapio.map((entrada) => ({ ...entrada, origem: 'gerado' }));

      res.status(201).json({ cardapio: cardapioComOrigem, erros: resultado.erros });
    })
  );

  router.put(
    '/:dia/:categoria',
    asyncHandler(async (req, res) => {
      const { dia, categoria } = req.params;
      validarData(dia, 'dia');
      validarCategoria(categoria);

      const receitaId = Number(req.body && req.body.receita_id);
      if (!Number.isInteger(receitaId) || receitaId <= 0) {
        throw new AppError(400, 'receita_id é obrigatório e deve ser um inteiro positivo');
      }

      const receita = receitasRepo.buscarReceitaPorId(db, req.usuarioId, receitaId);
      if (!receita) throw new AppError(404, `Receita ${receitaId} não encontrada`);
      if (receita.categoria !== categoria) {
        throw new AppError(
          400,
          `Receita ${receitaId} pertence à categoria '${receita.categoria}', não '${categoria}'`
        );
      }

      const entrada = cardapioRepo.upsertManual(db, req.usuarioId, dia, categoria, receitaId);
      res.json(entrada);
    })
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { semana, mes } = req.query;

      if (Boolean(semana) === Boolean(mes)) {
        throw new AppError(400, "Informe exatamente um dos parâmetros: 'semana' (YYYY-MM-DD) ou 'mes' (YYYY-MM)");
      }

      let periodo;
      if (semana) {
        validarData(semana, 'semana');
        const { inicio, fim } = inicioFimSemana(semana);
        periodo = { tipo: 'semana', inicio, fim };
      } else {
        const { inicio, fim } = inicioFimMes(mes);
        periodo = { tipo: 'mes', inicio, fim };
      }

      const cardapio = cardapioRepo.buscarPorIntervalo(db, req.usuarioId, periodo.inicio, periodo.fim);
      res.json({ periodo, cardapio });
    })
  );

  return router;
};
