'use strict';

const request = require('supertest');
const { criarAppDeTeste } = require('./helpers/appDeTeste');
const { criarUsuarioAutenticado } = require('./helpers/usuarios');
const { umaReceita } = require('./helpers/receitaBuilder');

describe('/cardapio', () => {
  let app;
  let token;

  beforeEach(async () => {
    ({ app } = criarAppDeTeste());
    ({ token } = await criarUsuarioAutenticado(app));
  });

  function auth(req) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  async function criarReceitasPadrao() {
    const cafeA = await auth(request(app).post('/receitas')).send(
      umaReceita().comNome('Cafe A').comCategoria('cafe').comCalorias(300).build()
    );
    const cafeB = await auth(request(app).post('/receitas')).send(
      umaReceita().comNome('Cafe B').comCategoria('cafe').comCalorias(250).build()
    );
    const almoco = await auth(request(app).post('/receitas')).send(
      umaReceita().comNome('Almoco').comCategoria('almoco').comCalorias(600).permiteRepeticao().build()
    );
    const jantar = await auth(request(app).post('/receitas')).send(
      umaReceita().comNome('Jantar').comCategoria('jantar').comCalorias(300).build()
    );
    return { cafeA: cafeA.body, cafeB: cafeB.body, almoco: almoco.body, jantar: jantar.body };
  }

  describe('POST /cardapio/gerar', () => {
    test('RN1: não repete a receita de uma categoria sem permite_repeticao em dias consecutivos', async () => {
      await criarReceitasPadrao();

      const resposta = await auth(request(app).post('/cardapio/gerar')).send({
        dias: ['2026-08-10', '2026-08-11', '2026-08-12'],
      });

      expect(resposta.status).toBe(201);
      const cafes = resposta.body.cardapio.filter((c) => c.categoria === 'cafe').map((c) => c.receita.id);
      for (let i = 1; i < cafes.length; i++) {
        expect(cafes[i]).not.toBe(cafes[i - 1]);
      }
    });

    test('RN1: respeita o histórico já persistido ao gerar em chamadas separadas (fronteira via banco)', async () => {
      await auth(request(app).post('/receitas')).send(
        umaReceita().comNome('Único café').comCategoria('cafe').build()
      );
      await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('almoco').permiteRepeticao().build());
      await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('jantar').permiteRepeticao().build());

      await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      const segundaChamada = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-11'] });

      // única receita de café não permite repetição -> dia seguinte deve falhar em achar candidata (RN5)
      const erroCafe = segundaChamada.body.erros.find((e) => e.categoria === 'cafe');
      expect(erroCafe).toBeDefined();
    });

    test('RN2: sem customizar preferências, o cardápio não inclui lanche', async () => {
      await criarReceitasPadrao();
      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      expect(resposta.body.cardapio.map((c) => c.categoria)).not.toContain('lanche');
    });

    test('RN2: após ativar lanche nas preferências, o cardápio passa a incluí-lo', async () => {
      await criarReceitasPadrao();
      await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('lanche').build());
      await auth(request(app).put('/preferencias')).send({
        categorias_ativas: ['cafe', 'almoco', 'jantar', 'lanche'],
      });

      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      expect(resposta.body.cardapio.map((c) => c.categoria)).toContain('lanche');
    });

    test('RN3: nenhuma receita gerada carrega uma tag presente nas restrições ativas do usuário', async () => {
      await auth(request(app).post('/receitas')).send(
        umaReceita().comCategoria('cafe').comTagsRestricao(['gluten']).build()
      );
      await auth(request(app).post('/receitas')).send(umaReceita().comNome('Cafe sem gluten').comCategoria('cafe').build());
      await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('almoco').permiteRepeticao().build());
      await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('jantar').permiteRepeticao().build());
      await auth(request(app).put('/preferencias')).send({ restricoes: ['gluten'] });

      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });

      for (const entrada of resposta.body.cardapio) {
        expect(entrada.receita.tags_restricao).not.toContain('gluten');
      }
    });

    test('RN4: com meta calórica definida, o total diário não ultrapassa a meta', async () => {
      await criarReceitasPadrao();
      await auth(request(app).put('/preferencias')).send({ meta_calorica: 1200 });

      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      const total = resposta.body.cardapio.reduce((soma, c) => soma + c.receita.calorias, 0);
      expect(total).toBeLessThanOrEqual(1200);
    });

    test('RN4: quando toda combinação ultrapassa a meta, ainda gera o cardápio (melhor esforço, não vazio)', async () => {
      await criarReceitasPadrao();
      await auth(request(app).put('/preferencias')).send({ meta_calorica: 10 }); // impossível

      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      expect(resposta.body.cardapio.length).toBeGreaterThan(0);
    });

    test('RN5: categoria sem receita compatível entra em "erros" e não impede as demais categorias', async () => {
      await auth(request(app).post('/receitas')).send(umaReceita().comCategoria('cafe').build());
      // sem receitas de almoco/jantar cadastradas

      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });

      expect(resposta.status).toBe(201);
      expect(resposta.body.cardapio.map((c) => c.categoria)).toEqual(['cafe']);
      expect(resposta.body.erros).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ dia: '2026-08-10', categoria: 'almoco' }),
          expect.objectContaining({ dia: '2026-08-10', categoria: 'jantar' }),
        ])
      );
    });

    test('"dias" vazio retorna 400', async () => {
      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: [] });
      expect(resposta.status).toBe(400);
    });

    test('"dias" com mais de 90 datas retorna 400', async () => {
      const dias = Array.from({ length: 91 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, '0')}`);
      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias });
      expect(resposta.status).toBe(400);
    });

    test('data inválida em "dias" retorna 400', async () => {
      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-02-30'] });
      expect(resposta.status).toBe(400);
    });

    test('nem "dias" nem "data_inicio" informados retorna 400', async () => {
      const resposta = await auth(request(app).post('/cardapio/gerar')).send({});
      expect(resposta.status).toBe(400);
    });

    test('modo alternativo data_inicio + quantidade_dias gera o número correto de dias', async () => {
      await criarReceitasPadrao();
      const resposta = await auth(request(app).post('/cardapio/gerar')).send({
        data_inicio: '2026-08-10',
        quantidade_dias: 2,
      });
      const diasGerados = new Set(resposta.body.cardapio.map((c) => c.dia));
      expect(diasGerados).toEqual(new Set(['2026-08-10', '2026-08-11']));
    });
  });

  describe('PUT /cardapio/:dia/:categoria', () => {
    test('edição manual persiste e sobrescreve uma entrada gerada automaticamente', async () => {
      const { cafeA, cafeB } = await criarReceitasPadrao();
      const gerado = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      const cafeGerado = gerado.body.cardapio.find((c) => c.categoria === 'cafe').receita.id;
      const outraOpcaoDeCafe = cafeGerado === cafeA.id ? cafeB.id : cafeA.id;

      const respostaPut = await auth(request(app).put('/cardapio/2026-08-10/cafe')).send({
        receita_id: outraOpcaoDeCafe,
      });
      expect(respostaPut.status).toBe(200);
      expect(respostaPut.body.receita.id).toBe(outraOpcaoDeCafe);

      const respostaGet = await auth(request(app).get('/cardapio?semana=2026-08-10'));
      const entradaCafe = respostaGet.body.cardapio.find((c) => c.categoria === 'cafe');
      expect(entradaCafe.receita.id).toBe(outraOpcaoDeCafe);
    });

    test('origem: entradas de POST /cardapio/gerar vêm marcadas como "gerado"', async () => {
      await criarReceitasPadrao();
      const resposta = await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      expect(resposta.body.cardapio.every((c) => c.origem === 'gerado')).toBe(true);
    });

    test('origem: uma entrada editada manualmente fica marcada como "manual" (GET reflete)', async () => {
      const { cafeA, cafeB } = await criarReceitasPadrao();
      await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      const cafeAtual = (await auth(request(app).get('/cardapio?semana=2026-08-10'))).body.cardapio.find(
        (c) => c.categoria === 'cafe'
      );
      const outraOpcao = cafeAtual.receita.id === cafeA.id ? cafeB.id : cafeA.id;

      const respostaPut = await auth(request(app).put('/cardapio/2026-08-10/cafe')).send({
        receita_id: outraOpcao,
      });
      expect(respostaPut.body.origem).toBe('manual');

      const respostaGet = await auth(request(app).get('/cardapio?semana=2026-08-10'));
      const entradaCafe = respostaGet.body.cardapio.find((c) => c.categoria === 'cafe');
      expect(entradaCafe.origem).toBe('manual');
    });

    test('origem: gerar novamente sobre um período com edição manual reverte a origem para "gerado"', async () => {
      const { cafeA, cafeB } = await criarReceitasPadrao();
      await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });
      const cafeAtual = (await auth(request(app).get('/cardapio?semana=2026-08-10'))).body.cardapio.find(
        (c) => c.categoria === 'cafe'
      );
      const outraOpcao = cafeAtual.receita.id === cafeA.id ? cafeB.id : cafeA.id;
      await auth(request(app).put('/cardapio/2026-08-10/cafe')).send({ receita_id: outraOpcao });

      // gera de novo sobre o mesmo dia — comportamento de backend já existente
      // (sobrescreve), a coluna origem só torna isso visível/rastreável.
      await auth(request(app).post('/cardapio/gerar')).send({ dias: ['2026-08-10'] });

      const respostaGet = await auth(request(app).get('/cardapio?semana=2026-08-10'));
      const entradaCafe = respostaGet.body.cardapio.find((c) => c.categoria === 'cafe');
      expect(entradaCafe.origem).toBe('gerado');
    });

    test('receita de categoria incompatível com a rota retorna 400 com mensagem exata', async () => {
      const { almoco } = await criarReceitasPadrao();
      const resposta = await auth(request(app).put('/cardapio/2026-08-10/cafe')).send({
        receita_id: almoco.id,
      });
      expect(resposta.status).toBe(400);
      expect(resposta.body.erro).toBe(
        `Receita ${almoco.id} pertence à categoria 'almoco', não 'cafe'`
      );
    });

    test('receita_id inexistente retorna 404', async () => {
      const resposta = await auth(request(app).put('/cardapio/2026-08-10/cafe')).send({
        receita_id: 99999,
      });
      expect(resposta.status).toBe(404);
    });

    test('receita_id ausente retorna 400', async () => {
      const resposta = await auth(request(app).put('/cardapio/2026-08-10/cafe')).send({});
      expect(resposta.status).toBe(400);
    });

    test('dia com formato inválido na URL retorna 400', async () => {
      const { cafeA } = await criarReceitasPadrao();
      const resposta = await auth(request(app).put('/cardapio/10-08-2026/cafe')).send({
        receita_id: cafeA.id,
      });
      expect(resposta.status).toBe(400);
    });

    test('categoria inválida na URL retorna 400', async () => {
      const { cafeA } = await criarReceitasPadrao();
      const resposta = await auth(request(app).put('/cardapio/2026-08-10/brunch')).send({
        receita_id: cafeA.id,
      });
      expect(resposta.status).toBe(400);
    });
  });

  describe('GET /cardapio', () => {
    test('?semana calcula o intervalo de segunda a domingo contendo a data informada (meio de semana)', async () => {
      // 2026-08-12 é uma quarta-feira.
      const resposta = await auth(request(app).get('/cardapio?semana=2026-08-12'));
      expect(resposta.body.periodo).toEqual({ tipo: 'semana', inicio: '2026-08-10', fim: '2026-08-16' });
    });

    test('?semana com data que já é domingo usa esse dia como fim do intervalo', async () => {
      // 2026-08-16 é domingo.
      const resposta = await auth(request(app).get('/cardapio?semana=2026-08-16'));
      expect(resposta.body.periodo).toEqual({ tipo: 'semana', inicio: '2026-08-10', fim: '2026-08-16' });
    });

    test('?mes calcula do primeiro ao último dia do mês (fevereiro, mês curto)', async () => {
      const resposta = await auth(request(app).get('/cardapio?mes=2026-02'));
      expect(resposta.body.periodo).toEqual({ tipo: 'mes', inicio: '2026-02-01', fim: '2026-02-28' });
    });

    test('semana e mes informados juntos retorna 400', async () => {
      const resposta = await auth(request(app).get('/cardapio?semana=2026-08-10&mes=2026-08'));
      expect(resposta.status).toBe(400);
    });

    test('nem semana nem mes informados retorna 400', async () => {
      const resposta = await auth(request(app).get('/cardapio'));
      expect(resposta.status).toBe(400);
    });

    test('período sem nenhum cardápio gerado retorna 200 com lista vazia (não 404)', async () => {
      const resposta = await auth(request(app).get('/cardapio?semana=2026-08-10'));
      expect(resposta.status).toBe(200);
      expect(resposta.body.cardapio).toEqual([]);
    });
  });
});
