'use strict';

const AppError = require('./AppError');
const { CATEGORIAS_VALIDAS } = require('../services/geradorCardapio');

const RESTRICOES_VALIDAS = ['gluten', 'lactose', 'acucar_refinado'];
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isDataValida(valor) {
  if (typeof valor !== 'string' || !DATA_REGEX.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
  );
}

function validarData(valor, campo) {
  if (!isDataValida(valor)) {
    throw new AppError(400, `${campo} deve ser uma data válida no formato YYYY-MM-DD`);
  }
  return valor;
}

function validarCategoria(valor, campo = 'categoria') {
  if (!CATEGORIAS_VALIDAS.includes(valor)) {
    throw new AppError(
      400,
      `${campo} inválida: '${valor}'. Valores aceitos: ${CATEGORIAS_VALIDAS.join(', ')}`
    );
  }
  return valor;
}

function validarArrayDeStrings(valor, campo, { opcional = false, valoresAceitos } = {}) {
  if (valor === undefined || valor === null) {
    if (opcional) return [];
    throw new AppError(400, `${campo} é obrigatório e deve ser um array`);
  }
  if (!Array.isArray(valor) || valor.some((v) => typeof v !== 'string')) {
    throw new AppError(400, `${campo} deve ser um array de strings`);
  }
  if (valoresAceitos) {
    const invalidos = valor.filter((v) => !valoresAceitos.includes(v));
    if (invalidos.length > 0) {
      throw new AppError(
        400,
        `${campo} contém valores inválidos: ${invalidos.join(', ')}. Aceitos: ${valoresAceitos.join(', ')}`
      );
    }
  }
  return valor;
}

function validarReceitaPayload(body, { parcial = false } = {}) {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'Corpo da requisição inválido');
  }

  const dados = {};

  if (!parcial || body.nome !== undefined) {
    if (typeof body.nome !== 'string' || body.nome.trim().length === 0) {
      throw new AppError(400, 'nome é obrigatório e deve ser uma string não vazia');
    }
    dados.nome = body.nome.trim();
  }

  if (!parcial || body.categoria !== undefined) {
    dados.categoria = validarCategoria(body.categoria);
  }

  if (!parcial || body.calorias !== undefined) {
    if (typeof body.calorias !== 'number' || !Number.isFinite(body.calorias) || body.calorias < 0) {
      throw new AppError(400, 'calorias é obrigatório e deve ser um número >= 0');
    }
    dados.calorias = body.calorias;
  }

  if (!parcial || body.ingredientes !== undefined) {
    dados.ingredientes = validarArrayDeStrings(body.ingredientes, 'ingredientes', {
      opcional: parcial,
    });
    if (!parcial && dados.ingredientes.length === 0) {
      throw new AppError(400, 'ingredientes deve conter ao menos 1 item');
    }
  }

  if (!parcial || body.tags_restricao !== undefined) {
    dados.tags_restricao = validarArrayDeStrings(body.tags_restricao, 'tags_restricao', {
      opcional: true,
      valoresAceitos: RESTRICOES_VALIDAS,
    });
  }

  if (!parcial || body.permite_repeticao !== undefined) {
    if (body.permite_repeticao !== undefined && typeof body.permite_repeticao !== 'boolean') {
      throw new AppError(400, 'permite_repeticao deve ser um boolean');
    }
    dados.permite_repeticao = Boolean(body.permite_repeticao);
  }

  return dados;
}

function validarPreferenciasPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'Corpo da requisição inválido');
  }

  const dados = {};

  if (body.categorias_ativas !== undefined) {
    const categorias = validarArrayDeStrings(body.categorias_ativas, 'categorias_ativas', {
      valoresAceitos: CATEGORIAS_VALIDAS,
    });
    if (categorias.length === 0) {
      throw new AppError(400, 'categorias_ativas não pode ser vazio');
    }
    dados.categorias_ativas = [...new Set(categorias)];
  }

  if (body.restricoes !== undefined) {
    dados.restricoes = [
      ...new Set(
        validarArrayDeStrings(body.restricoes, 'restricoes', {
          valoresAceitos: RESTRICOES_VALIDAS,
        })
      ),
    ];
  }

  if (body.meta_calorica !== undefined) {
    if (
      body.meta_calorica !== null &&
      (typeof body.meta_calorica !== 'number' || !Number.isFinite(body.meta_calorica) || body.meta_calorica <= 0)
    ) {
      throw new AppError(400, 'meta_calorica deve ser um número positivo ou null');
    }
    dados.meta_calorica = body.meta_calorica;
  }

  if (Object.keys(dados).length === 0) {
    throw new AppError(
      400,
      'Informe ao menos um campo: categorias_ativas, restricoes ou meta_calorica'
    );
  }

  return dados;
}

module.exports = {
  RESTRICOES_VALIDAS,
  isDataValida,
  validarData,
  validarCategoria,
  validarArrayDeStrings,
  validarReceitaPayload,
  validarPreferenciasPayload,
};
