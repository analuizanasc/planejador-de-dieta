'use strict';

const AppError = require('./AppError');
const { CATEGORIAS_VALIDAS } = require('../services/geradorCardapio');

const RESTRICOES_VALIDAS = ['gluten', 'lactose', 'acucar_refinado'];
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Campo de texto opcional: null/ausente vira null; string é aparada e, se
// ficar vazia, também vira null. Qualquer outro tipo é rejeitado.
function validarTextoOpcional(valor, campo) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') {
    throw new AppError(400, `${campo} deve ser uma string`);
  }
  const aparado = valor.trim();
  return aparado.length > 0 ? aparado : null;
}

// Id opcional (FK): null/ausente vira null; caso contrário, inteiro positivo.
function validarIdOpcional(valor, campo) {
  if (valor === undefined || valor === null) return null;
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new AppError(400, `${campo} deve ser um inteiro positivo ou null`);
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

  if (!parcial || body.categorias !== undefined) {
    const categorias = validarArrayDeStrings(body.categorias, 'categorias', {
      opcional: parcial,
      valoresAceitos: CATEGORIAS_VALIDAS,
    });
    if (categorias.length === 0) {
      throw new AppError(400, 'categorias deve conter ao menos 1 item');
    }
    dados.categorias = [...new Set(categorias)];
  }

  // calorias é opcional: null (ou ausente) representa "não informado".
  // Quando informado, precisa ser um número >= 0.
  if (!parcial || body.calorias !== undefined) {
    if (body.calorias === undefined || body.calorias === null) {
      dados.calorias = null;
    } else if (
      typeof body.calorias !== 'number' ||
      !Number.isFinite(body.calorias) ||
      body.calorias < 0
    ) {
      throw new AppError(400, 'calorias deve ser um número >= 0 ou null');
    } else {
      dados.calorias = body.calorias;
    }
  }

  if (!parcial || body.ingredientes !== undefined) {
    dados.ingredientes = validarArrayDeStrings(body.ingredientes, 'ingredientes', {
      opcional: parcial,
    });
    if (!parcial && dados.ingredientes.length === 0) {
      throw new AppError(400, 'ingredientes deve conter ao menos 1 item');
    }
  }

  if (!parcial || body.modo_preparo !== undefined) {
    dados.modo_preparo = validarTextoOpcional(body.modo_preparo, 'modo_preparo');
  }

  if (!parcial || body.imagem_url !== undefined) {
    dados.imagem_url = validarTextoOpcional(body.imagem_url, 'imagem_url');
  }

  if (!parcial || body.caderno_id !== undefined) {
    dados.caderno_id = validarIdOpcional(body.caderno_id, 'caderno_id');
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

// Validação best-effort para o rascunho vindo da IA (importação do Instagram).
// NUNCA lança: campos inválidos são coeridos para um valor seguro que o
// formulário do frontend renderiza sem quebrar, e cada correção vira um aviso
// para o usuário revisar antes de salvar. Distinta de validarReceitaPayload,
// que é estrita e continua guardando o POST/PUT de /receitas.
function validarReceitaComAvisos(bruto) {
  const origem = bruto && typeof bruto === 'object' ? bruto : {};
  const avisos = [];
  const dados = {};

  if (typeof origem.nome === 'string' && origem.nome.trim().length > 0) {
    dados.nome = origem.nome.trim();
  } else {
    dados.nome = '';
    avisos.push('Não identificamos o nome da receita; preencha antes de salvar.');
  }

  // Aceita `categorias` (array) do modelo novo ou `categoria` (string) legada.
  const categoriasBrutas = Array.isArray(origem.categorias)
    ? origem.categorias
    : typeof origem.categoria === 'string'
      ? [origem.categoria]
      : [];
  const categoriasValidas = [...new Set(categoriasBrutas.filter((c) => CATEGORIAS_VALIDAS.includes(c)))];
  dados.categorias = categoriasValidas;
  if (categoriasValidas.length === 0) {
    avisos.push('Categoria não reconhecida; selecione ao menos uma categoria válida.');
  }

  if (typeof origem.calorias === 'number' && Number.isFinite(origem.calorias) && origem.calorias >= 0) {
    dados.calorias = origem.calorias;
  } else {
    dados.calorias = null;
    avisos.push('Não foi possível estimar as calorias; informe o valor manualmente.');
  }

  const ingredientes = Array.isArray(origem.ingredientes)
    ? origem.ingredientes.filter((i) => typeof i === 'string' && i.trim().length > 0).map((i) => i.trim())
    : [];
  dados.ingredientes = ingredientes;
  if (ingredientes.length === 0) {
    avisos.push('Nenhum ingrediente foi identificado; adicione os ingredientes antes de salvar.');
  }

  dados.modo_preparo =
    typeof origem.modo_preparo === 'string' && origem.modo_preparo.trim().length > 0
      ? origem.modo_preparo.trim()
      : null;

  dados.imagem_url =
    typeof origem.imagem_url === 'string' && origem.imagem_url.trim().length > 0
      ? origem.imagem_url.trim()
      : null;

  if (Array.isArray(origem.tags_restricao)) {
    const validas = origem.tags_restricao.filter((t) => RESTRICOES_VALIDAS.includes(t));
    dados.tags_restricao = [...new Set(validas)];
    if (validas.length !== origem.tags_restricao.length) {
      avisos.push('Algumas tags de restrição não foram reconhecidas e foram descartadas.');
    }
  } else {
    dados.tags_restricao = [];
  }

  dados.permite_repeticao = Boolean(origem.permite_repeticao);

  return { dados, avisos };
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

function validarRegistroPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'Corpo da requisição inválido');
  }

  if (typeof body.email !== 'string' || !EMAIL_REGEX.test(body.email.trim())) {
    throw new AppError(400, 'email é obrigatório e deve ter um formato válido');
  }

  if (typeof body.senha !== 'string' || body.senha.length < 8) {
    throw new AppError(400, 'senha é obrigatória e deve ter ao menos 8 caracteres');
  }

  if (typeof body.nome !== 'string' || body.nome.trim().length === 0) {
    throw new AppError(400, 'nome é obrigatório e deve ser uma string não vazia');
  }

  return { email: body.email.trim().toLowerCase(), senha: body.senha, nome: body.nome.trim() };
}

function validarCadernoPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'Corpo da requisição inválido');
  }
  if (typeof body.nome !== 'string' || body.nome.trim().length === 0) {
    throw new AppError(400, 'nome é obrigatório e deve ser uma string não vazia');
  }
  return { nome: body.nome.trim() };
}

function validarLoginPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'Corpo da requisição inválido');
  }

  if (typeof body.email !== 'string' || body.email.trim().length === 0) {
    throw new AppError(400, 'email é obrigatório');
  }

  if (typeof body.senha !== 'string' || body.senha.length === 0) {
    throw new AppError(400, 'senha é obrigatória');
  }

  return { email: body.email.trim().toLowerCase(), senha: body.senha };
}

module.exports = {
  RESTRICOES_VALIDAS,
  isDataValida,
  validarData,
  validarCategoria,
  validarArrayDeStrings,
  validarReceitaPayload,
  validarReceitaComAvisos,
  validarPreferenciasPayload,
  validarCadernoPayload,
  validarRegistroPayload,
  validarLoginPayload,
};
