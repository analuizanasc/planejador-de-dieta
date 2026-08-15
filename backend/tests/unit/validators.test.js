'use strict';

const AppError = require('../../src/utils/AppError');
const {
  isDataValida,
  validarData,
  validarCategoria,
  validarArrayDeStrings,
  validarReceitaPayload,
  validarReceitaComAvisos,
  validarPreferenciasPayload,
  validarRegistroPayload,
  validarLoginPayload,
} = require('../../src/utils/validators');

describe('isDataValida', () => {
  test('aceita data válida', () => {
    expect(isDataValida('2026-08-12')).toBe(true);
  });

  test('rejeita formato fora do padrão YYYY-MM-DD', () => {
    expect(isDataValida('12-08-2026')).toBe(false);
  });

  test('rejeita data de calendário inexistente (31 de fevereiro)', () => {
    expect(isDataValida('2026-02-31')).toBe(false);
  });

  test('rejeita valor que não é string', () => {
    expect(isDataValida(20260812)).toBe(false);
  });
});

describe('validarData', () => {
  test('retorna o valor quando válido', () => {
    expect(validarData('2026-08-12', 'dia')).toBe('2026-08-12');
  });

  test('lança AppError 400 quando inválido, citando o nome do campo', () => {
    expect(() => validarData('data-invalida', 'dia')).toThrow(AppError);
    try {
      validarData('data-invalida', 'dia');
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/^dia /);
    }
  });
});

describe('validarCategoria', () => {
  test('aceita categoria válida', () => {
    expect(validarCategoria('cafe')).toBe('cafe');
  });

  test('rejeita categoria inválida', () => {
    expect(() => validarCategoria('brunch')).toThrow(AppError);
  });

  test('rejeita valor vazio', () => {
    expect(() => validarCategoria('')).toThrow(AppError);
  });
});

describe('validarArrayDeStrings', () => {
  test('lança erro quando obrigatório e ausente', () => {
    expect(() => validarArrayDeStrings(undefined, 'ingredientes')).toThrow(AppError);
  });

  test('retorna array vazio quando opcional e ausente', () => {
    expect(validarArrayDeStrings(undefined, 'tags', { opcional: true })).toEqual([]);
  });

  test('rejeita valor que não é array', () => {
    expect(() => validarArrayDeStrings('não é array', 'ingredientes')).toThrow(AppError);
  });

  test('rejeita array com item que não é string', () => {
    expect(() => validarArrayDeStrings(['ok', 123], 'ingredientes')).toThrow(AppError);
  });

  test('rejeita valor fora da lista de aceitos', () => {
    expect(() =>
      validarArrayDeStrings(['gluten', 'soja'], 'tags', { valoresAceitos: ['gluten', 'lactose'] })
    ).toThrow(AppError);
  });

  test('aceita array de strings válido dentro dos valores aceitos', () => {
    expect(validarArrayDeStrings(['gluten'], 'tags', { valoresAceitos: ['gluten', 'lactose'] })).toEqual([
      'gluten',
    ]);
  });
});

describe('validarReceitaPayload (payload completo, parcial=false)', () => {
  const payloadValido = {
    nome: 'Tapioca',
    categoria: 'cafe',
    calorias: 300,
    ingredientes: ['tapioca', 'ovo'],
    tags_restricao: ['lactose'],
    permite_repeticao: true,
  };

  test('aceita payload completo e válido', () => {
    expect(validarReceitaPayload(payloadValido)).toEqual(payloadValido);
  });

  test('rejeita corpo nulo', () => {
    expect(() => validarReceitaPayload(null)).toThrow(AppError);
  });

  test('rejeita quando nome está ausente', () => {
    const { nome, ...semNome } = payloadValido;
    expect(() => validarReceitaPayload(semNome)).toThrow('nome é obrigatório');
  });

  test('rejeita quando nome é string vazia após trim', () => {
    expect(() => validarReceitaPayload({ ...payloadValido, nome: '   ' })).toThrow('nome é obrigatório');
  });

  test('rejeita quando categoria está ausente ou inválida', () => {
    expect(() => validarReceitaPayload({ ...payloadValido, categoria: undefined })).toThrow(AppError);
  });

  test('rejeita calorias negativa (fronteira: -1 inválido)', () => {
    expect(() => validarReceitaPayload({ ...payloadValido, calorias: -1 })).toThrow(
      'calorias é obrigatório'
    );
  });

  test('aceita calorias zero (fronteira: 0 é válido)', () => {
    expect(validarReceitaPayload({ ...payloadValido, calorias: 0 }).calorias).toBe(0);
  });

  test('rejeita calorias não numérica', () => {
    expect(() => validarReceitaPayload({ ...payloadValido, calorias: '300' })).toThrow(AppError);
  });

  test('rejeita ingredientes ausente', () => {
    const { ingredientes, ...semIngredientes } = payloadValido;
    expect(() => validarReceitaPayload(semIngredientes)).toThrow(AppError);
  });

  test('rejeita ingredientes vazio quando payload não é parcial', () => {
    expect(() => validarReceitaPayload({ ...payloadValido, ingredientes: [] })).toThrow(
      'ingredientes deve conter ao menos 1 item'
    );
  });

  test('rejeita tags_restricao com valor fora do enum', () => {
    expect(() => validarReceitaPayload({ ...payloadValido, tags_restricao: ['soja'] })).toThrow(AppError);
  });

  test('aceita tags_restricao ausente (opcional, vira array vazio)', () => {
    const { tags_restricao, ...semTags } = payloadValido;
    expect(validarReceitaPayload(semTags).tags_restricao).toEqual([]);
  });

  test('rejeita permite_repeticao que não é boolean', () => {
    expect(() => validarReceitaPayload({ ...payloadValido, permite_repeticao: 'sim' })).toThrow(
      'permite_repeticao deve ser um boolean'
    );
  });

  test('converte permite_repeticao ausente para false', () => {
    const { permite_repeticao, ...semFlag } = payloadValido;
    expect(validarReceitaPayload(semFlag).permite_repeticao).toBe(false);
  });
});

describe('validarReceitaPayload (payload parcial=true, usado hoje só nos testes de validação — atualização completa via PUT)', () => {
  test('permite payload com apenas um campo quando parcial=true', () => {
    expect(validarReceitaPayload({ calorias: 500 }, { parcial: true })).toEqual({ calorias: 500 });
  });
});

describe('validarPreferenciasPayload', () => {
  test('rejeita corpo nulo', () => {
    expect(() => validarPreferenciasPayload(null)).toThrow('Corpo da requisição inválido');
  });

  test('rejeita corpo vazio (nenhum campo informado)', () => {
    expect(() => validarPreferenciasPayload({})).toThrow(
      'Informe ao menos um campo: categorias_ativas, restricoes ou meta_calorica'
    );
  });

  test('rejeita categorias_ativas vazio', () => {
    expect(() => validarPreferenciasPayload({ categorias_ativas: [] })).toThrow(
      'categorias_ativas não pode ser vazio'
    );
  });

  test('deduplica categorias_ativas repetidas', () => {
    const resultado = validarPreferenciasPayload({ categorias_ativas: ['cafe', 'cafe', 'almoco'] });
    expect(resultado.categorias_ativas).toEqual(['cafe', 'almoco']);
  });

  test('rejeita restricoes com valor fora do enum', () => {
    expect(() => validarPreferenciasPayload({ restricoes: ['soja'] })).toThrow(AppError);
  });

  test('deduplica restricoes repetidas', () => {
    const resultado = validarPreferenciasPayload({ restricoes: ['gluten', 'gluten'] });
    expect(resultado.restricoes).toEqual(['gluten']);
  });

  test('rejeita meta_calorica zero (fronteira: 0 é inválido)', () => {
    expect(() => validarPreferenciasPayload({ meta_calorica: 0 })).toThrow(
      'meta_calorica deve ser um número positivo ou null'
    );
  });

  test('aceita meta_calorica no menor valor positivo (fronteira: 1 é válido)', () => {
    expect(validarPreferenciasPayload({ meta_calorica: 1 }).meta_calorica).toBe(1);
  });

  test('aceita meta_calorica null (limpa a meta)', () => {
    expect(validarPreferenciasPayload({ meta_calorica: null }).meta_calorica).toBeNull();
  });

  test('rejeita meta_calorica não numérica', () => {
    expect(() => validarPreferenciasPayload({ meta_calorica: '1200' })).toThrow(AppError);
  });
});

describe('validarRegistroPayload', () => {
  const payloadValido = { email: 'Ana@Teste.com', senha: 'senha1234', nome: 'Ana' };

  test('rejeita corpo nulo', () => {
    expect(() => validarRegistroPayload(null)).toThrow('Corpo da requisição inválido');
  });

  test('aceita payload válido e normaliza email (trim + lowercase)', () => {
    expect(validarRegistroPayload(payloadValido)).toEqual({
      email: 'ana@teste.com',
      senha: 'senha1234',
      nome: 'Ana',
    });
  });

  test('rejeita email sem @', () => {
    expect(() => validarRegistroPayload({ ...payloadValido, email: 'anateste.com' })).toThrow(
      'email é obrigatório e deve ter um formato válido'
    );
  });

  test('rejeita email sem domínio', () => {
    expect(() => validarRegistroPayload({ ...payloadValido, email: 'ana@teste' })).toThrow(AppError);
  });

  test('rejeita senha com 7 caracteres (fronteira: abaixo do mínimo)', () => {
    expect(() => validarRegistroPayload({ ...payloadValido, senha: '1234567' })).toThrow(
      'senha é obrigatória e deve ter ao menos 8 caracteres'
    );
  });

  test('aceita senha com 8 caracteres (fronteira: mínimo válido)', () => {
    expect(validarRegistroPayload({ ...payloadValido, senha: '12345678' }).senha).toBe('12345678');
  });

  test('rejeita nome vazio ou só espaços', () => {
    expect(() => validarRegistroPayload({ ...payloadValido, nome: '   ' })).toThrow(
      'nome é obrigatório e deve ser uma string não vazia'
    );
  });
});

describe('validarLoginPayload', () => {
  test('aceita payload válido', () => {
    expect(validarLoginPayload({ email: 'ana@teste.com', senha: 'qualquer' })).toEqual({
      email: 'ana@teste.com',
      senha: 'qualquer',
    });
  });

  test('rejeita corpo nulo', () => {
    expect(() => validarLoginPayload(null)).toThrow('Corpo da requisição inválido');
  });

  test('rejeita email ausente', () => {
    expect(() => validarLoginPayload({ senha: 'qualquer' })).toThrow('email é obrigatório');
  });

  test('rejeita senha ausente', () => {
    expect(() => validarLoginPayload({ email: 'ana@teste.com' })).toThrow('senha é obrigatória');
  });
});

describe('validarReceitaComAvisos', () => {
  const RECEITA_OK = {
    nome: 'Panqueca de banana',
    categoria: 'cafe',
    calorias: 250,
    ingredientes: ['1 banana', '2 ovos'],
    tags_restricao: ['gluten'],
    permite_repeticao: true,
  };

  test('nunca lança, mesmo com entrada não-objeto', () => {
    expect(() => validarReceitaComAvisos(null)).not.toThrow();
    expect(() => validarReceitaComAvisos('nada')).not.toThrow();
  });

  test('rascunho totalmente válido não gera avisos', () => {
    const { dados, avisos } = validarReceitaComAvisos(RECEITA_OK);
    expect(avisos).toEqual([]);
    expect(dados).toEqual(RECEITA_OK);
  });

  test('nome ausente vira string vazia com aviso', () => {
    const { dados, avisos } = validarReceitaComAvisos({ ...RECEITA_OK, nome: '   ' });
    expect(dados.nome).toBe('');
    expect(avisos).toContain('Não identificamos o nome da receita; preencha antes de salvar.');
  });

  test('categoria inválida vira null com aviso', () => {
    const { dados, avisos } = validarReceitaComAvisos({ ...RECEITA_OK, categoria: 'brunch' });
    expect(dados.categoria).toBeNull();
    expect(avisos).toContain('Categoria não reconhecida; selecione uma categoria válida.');
  });

  test('calorias inválidas viram null com aviso', () => {
    const { dados, avisos } = validarReceitaComAvisos({ ...RECEITA_OK, calorias: -5 });
    expect(dados.calorias).toBeNull();
    expect(avisos).toContain('Não foi possível estimar as calorias; informe o valor manualmente.');
  });

  test('ingredientes ausentes/ inválidos viram lista filtrada com aviso quando vazia', () => {
    const { dados, avisos } = validarReceitaComAvisos({ ...RECEITA_OK, ingredientes: [' ', 2, null] });
    expect(dados.ingredientes).toEqual([]);
    expect(avisos).toContain(
      'Nenhum ingrediente foi identificado; adicione os ingredientes antes de salvar.'
    );
  });

  test('ingredientes válidos são trimados e mantidos', () => {
    const { dados } = validarReceitaComAvisos({ ...RECEITA_OK, ingredientes: ['  farinha  ', 'ovo'] });
    expect(dados.ingredientes).toEqual(['farinha', 'ovo']);
  });

  test('tags inválidas são descartadas, mantendo as válidas, com aviso', () => {
    const { dados, avisos } = validarReceitaComAvisos({
      ...RECEITA_OK,
      tags_restricao: ['gluten', 'xyz', 'gluten'],
    });
    expect(dados.tags_restricao).toEqual(['gluten']);
    expect(avisos).toContain('Algumas tags de restrição não foram reconhecidas e foram descartadas.');
  });

  test('tags ausentes viram lista vazia sem aviso de tags', () => {
    const { dados } = validarReceitaComAvisos({ ...RECEITA_OK, tags_restricao: undefined });
    expect(dados.tags_restricao).toEqual([]);
  });

  test('permite_repeticao é coerido para boolean', () => {
    const { dados } = validarReceitaComAvisos({ ...RECEITA_OK, permite_repeticao: undefined });
    expect(dados.permite_repeticao).toBe(false);
  });
});
