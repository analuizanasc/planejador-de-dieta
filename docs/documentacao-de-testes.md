# Documentação de Testes — Planejador de Dieta

> Gerado a partir do código e das suítes de teste já implementadas no repositório (backend Jest/Supertest + E2E Playwright), conforme Prompt 6 do [plano de execução](../planejador-dieta-plano-execucao.md).

---

## 1. Estratégia de Testes

### 1.1 Objetivos

- Garantir que as 5 regras de negócio centrais do gerador de cardápio (RN1–RN5) estão corretas e permanecem corretas a cada mudança (rede de segurança de regressão).
- Garantir que a API REST expõe essas regras de forma consistente, segura (autenticação/isolamento por usuário) e com contratos de resposta estáveis para o frontend.
- Garantir que os fluxos de maior risco para o produto funcionam de ponta a ponta na UI real, não apenas na camada de API.
- Detectar rupturas de contrato entre backend e frontend antes que cheguem à produção.

### 1.2 Escopo

**Dentro do escopo:**
- Algoritmo de geração de cardápio (`backend/src/services/geradorCardapio.js`) — módulo puro, sem I/O.
- Camada de validação de entrada (`backend/src/utils/validators.js`).
- API REST completa: `/auth`, `/receitas`, `/preferencias`, `/cardapio`.
- Autenticação JWT e isolamento de dados entre usuários (multiusuário).
- Contrato de resposta de cada endpoint (shape, tipos, campos obrigatórios).
- Fluxos de UI de maior risco: geração automática com restrição + meta calórica, não repetição em dias consecutivos, edição manual persistente.

**Fora do escopo (não coberto por esta suíte):**
- Testes de carga/performance sob concorrência real (múltiplos usuários simultâneos).
- Testes de acessibilidade (a11y) e cross-browser além do Chromium usado pelo Playwright.
- Testes de segurança ofensivos (pentest, fuzzing de payloads maliciosos além de validação de schema).
- Fluxo E2E completo ponta a ponta (login → cadastro de receitas → preferências → geração → edição → visão mensal) — deliberadamente reduzido aos 3 cenários de maior risco/valor (ver seção 1.3 e §7).

### 1.3 Técnicas aplicadas por camada

| Camada | Técnica principal | Como é aplicada aqui |
|---|---|---|
| Unitário | Cobertura de sentença e decisão | `geradorCardapio.js` e `validators.js` têm threshold de 90% (statements/branches/functions/lines) configurado em `backend/jest.config.js`; todo `if`/ramo de decisão do algoritmo e dos validadores tem um teste dedicado a cada lado da decisão. |
| Unitário | Particionamento de equivalência + Análise de Valor Limite (AVL) | Aplicado sistematicamente em `validators.test.js` (ex.: `calorias = -1` inválido / `0` válido; `senha` com 7 vs. 8 caracteres; `meta_calorica` com `0` vs. `1`). |
| Integração | Heurística **VADER** (Verbs, Authorization, Data, Errors, Responsiveness) | Ver detalhamento em §5. |
| Integração | Regras de negócio pela camada de API | Cada RN1–RN5 tem pelo menos um teste de integração equivalente ao teste unitário, provando que a regra sobrevive à composição rota→repositório→SQLite. |
| Contrato | Verificação de shape (chaves exatas + tipos) | `backend/tests/contract/helpers/contractMatchers.js` — matchers hand-rolled que verificam `Object.keys(...).sort()` e `typeof` de cada campo. |
| E2E | Cenário de maior risco/valor (não fluxo completo) | Playwright dirigindo a UI real contra o backend real, focando nos 3 pontos onde uma falha teria maior impacto no usuário. |

### 1.4 Critérios de entrada

- Schema do banco (`backend/db/schema.sql`) estável e aplicado.
- API REST implementada e rodando localmente (`npm start` no backend expõe as rotas usadas pelos testes de integração/contrato via app de teste in-memory; E2E depende do backend + frontend servidos).
- Variável de ambiente `JWT_SECRET` definida (`backend/tests/setupEnv.js` supre isso para os testes Jest; o workflow de CI define um valor dedicado de CI).
- Dependências instaladas (`npm ci` em `backend/`, `frontend/` e `e2e/`).

### 1.5 Critérios de saída

- 100% dos testes unitários, de integração e de contrato passando (`npm test` no backend).
- Cobertura de sentença/decisão ≥ 90% em `geradorCardapio.js` e `validators.js` — build falha no CI se ficar abaixo (`coverageThreshold` em `jest.config.js`).
- Os 3 cenários E2E de Playwright passando contra o build atual do frontend + backend.
- Nenhuma regressão de contrato: todos os matchers de shape em `contractMatchers.js` passando.
- Pipeline `Testes` do GitHub Actions (`.github/workflows/tests.yml`) verde nos jobs `backend` e `e2e`, incluindo publicação do relatório de cobertura (`coverage-report`) e, em caso de falha E2E, do relatório do Playwright.

### 1.6 Observação sobre o "R" (Responsiveness) do VADER

A suíte atual **não** possui asserções automatizadas de tempo de resposta (SLA). Isso é reportado aqui como uma lacuna consciente, não como algo coberto: as chamadas HTTP nos testes de integração rodam contra SQLite local e app in-memory, portanto qualquer medição de tempo seria não representativa de produção. Se performance virar requisito formal, recomenda-se um teste de carga separado (ex.: k6/Artillery) fora do Jest, com orçamento de tempo definido por endpoint.

---

## 2. Plano de Testes — casos mapeados por técnica e regra de negócio

### 2.1 Regras de negócio cobertas

As RN1–RN5 são as regras de negócio formais definidas no plano de execução. RN6–RN9 são regras de suporte identificadas no código e amplamente testadas, incluídas aqui para dar rastreabilidade completa.

| ID | Regra | Fonte |
|---|---|---|
| RN1 | Receita não repete em 2 dias consecutivos, exceto se `permite_repeticao = true` | `geradorCardapio.js` |
| RN2 | Café/almoço/jantar obrigatórios por padrão; lanche opcional; usuário customiza `categorias_ativas` | `geradorCardapio.js` |
| RN3 | Só sugere receitas compatíveis com as restrições do usuário (glúten/lactose/açúcar refinado) | `geradorCardapio.js` |
| RN4 | Com meta calórica definida, aproxima o total diário da meta sem ultrapassar | `geradorCardapio.js` |
| RN5 | Sem receita compatível para uma categoria/dia: erro claro, sem quebrar a geração | `geradorCardapio.js` |
| RN6 | Toda rota protegida exige JWT válido no header `Authorization: Bearer` | `middlewares/auth.js` |
| RN7 | Isolamento de dados: um usuário nunca lê/edita/apaga receitas ou cardápio de outro | `repositories/*.js` (todas as queries filtram por `usuario_id`) |
| RN8 | Integridade referencial: não é possível excluir uma receita referenciada no cardápio | `errorHandler.js` (`SQLITE_CONSTRAINT_FOREIGNKEY` → 409) |
| RN9 | Toda entrada de cardápio rastreia sua origem (`gerado` vs. `manual`) | `routes/cardapio.js`, `repositories/cardapioRepository.js` |

### 2.2 Plano por técnica

| Técnica | Onde é usada | RNs cobertas |
|---|---|---|
| Cobertura de sentença/decisão | Unitário — `geradorCardapio.js`, `validators.js` | RN1–RN5 (algoritmo) + validação de payload (RN6 indiretamente via shape de entrada) |
| Particionamento de equivalência | Unitário — validadores (categoria válida/inválida, array vazio/preenchido, tipos certos/errados) | Validação de entrada de todos os endpoints |
| Análise de valor limite | Unitário — `calorias` (-1/0), `senha` (7/8 chars), `meta_calorica` (0/1) | Validação de payload de `/receitas`, `/preferencias`, `/auth/registrar` |
| Tabela de decisão | Unitário — `selecionarComMeta` (combinações de soma × meta: exata, abaixo, acima, empate, ordem de descoberta) | RN4 |
| Heurística VADER | Integração — todos os módulos de rota | RN1–RN9 (ver §5) |
| Verificação de contrato (shape) | Contrato — todos os endpoints | Consistência de payload consumido pelo frontend |
| Cenário de maior risco (E2E) | Playwright — 3 specs | RN1, RN3, RN4, RN9 |

---

## 3. Matriz de Rastreabilidade (caso de teste → regra de negócio)

Legenda de camada: **UT** unitário · **IT** integração · **CT** contrato · **E2E** ponta a ponta.

| RN | UT | IT | CT | E2E |
|---|---|---|---|---|
| RN1 — não repetição em dias consecutivos | UT-G01–UT-G05 (`filtrarCandidatas`), UT-G16–UT-G17 (`gerarCardapio`) | IT-CARD-01, IT-CARD-02 | CT-05 (shape reaproveita as mesmas entradas) | E2E-03 |
| RN2 — categorias obrigatórias/opcionais | UT-G12–UT-G14 (`resolverCategoriasAtivas`), UT-G18, UT-G23 | IT-CARD-03, IT-CARD-04 | CT-05, CT-06 | E2E-01 (implícito: só café/almoço/jantar aparecem sem customização) |
| RN3 — compatibilidade com restrições | UT-G01–UT-G05 (`receitaCompativel`), UT-G07 (`filtrarCandidatas`) | IT-CARD-05 | CT-05 | E2E-01 |
| RN4 — meta calórica sem ultrapassar | UT-G15, UT-G19–UT-G22 (`selecionarComMeta`), UT-G19 (`gerarCardapio`) | IT-CARD-06, IT-CARD-07 | CT-05 | E2E-01 |
| RN5 — erro claro sem receita compatível | UT-G17, UT-G20 | IT-CARD-02, IT-CARD-08 | CT-05 (shape do array `erros`) | — |
| RN6 — autenticação obrigatória | — (é responsabilidade de integração, não de unidade pura) | IT-AUTZ-01–IT-AUTZ-07 | CT-09 (shape de erro 401) | — (sessão simulada via `entrarComSessao`, fora do escopo do E2E atual) |
| RN7 — isolamento entre usuários | — | IT-AUTZ-08–IT-AUTZ-13 | — | — |
| RN8 — integridade referencial | — | IT-REC-09 | — | — |
| RN9 — origem gerado/manual | — | IT-CARD-14–IT-CARD-16 | CT-05, CT-07 | E2E-02 |
| Validação de payload (`/receitas`) | UT-V16–UT-V30 | IT-REC-10 | CT-09 | — |
| Validação de payload (`/preferencias`) | UT-V31–UT-V40 | IT-PREF-05 | — | — |
| Validação de payload (`/auth`) | UT-V41–UT-V51 | IT-AUTH-03, IT-AUTH-06 | CT-01 | — |
| Cálculo de intervalo semana/mês (`datas.js`) | — (sem suíte unitária dedicada — coberto indiretamente) | IT-CARD-17–IT-CARD-21 | CT-06 | — |

> Observação de rastreabilidade: `backend/src/utils/datas.js` não tem arquivo de teste unitário próprio; sua cobertura hoje vem inteiramente da integração via `GET /cardapio`. Isso é um gap real — ver §4.3.

---

## 4. Casos Unitários — sentenças e decisões cobertas

### 4.1 `geradorCardapio.js`

#### `receitaCompativel` (RN3)

| ID | Caso | Decisão coberta |
|---|---|---|
| UT-G01 | Compatível quando usuário não tem restrição | `restricoesUsuario = []` → `tags.some(...)` sempre `false` |
| UT-G02 | Incompatível quando alguma tag colide | `tags.some(...)` → `true` em pelo menos um elemento |
| UT-G03 | Compatível quando há tags mas nenhuma colide | `tags.some(...)` → `false` com `tags.length > 0` |
| UT-G04 | `restricoesUsuario` ausente (`undefined`) tratado como `[]` | ramo `restricoesUsuario || []` |
| UT-G05 | Receita sem campo `tags_restricao` tratada como `[]` | ramo `receita.tags_restricao || []` |

#### `filtrarCandidatas`

| ID | Caso | Decisão coberta |
|---|---|---|
| UT-G06 | Exclui categoria diferente | `if (r.categoria !== categoria) return false` |
| UT-G07 | Exclui por restrição ativa (RN3) | `if (!receitaCompativel(...)) return false` |
| UT-G08 | Exclui a usada ontem sem `permite_repeticao` (RN1) | `if (r.id === receitaIdOntem && !r.permite_repeticao) return false` — ramo verdadeiro |
| UT-G09 | Inclui a usada ontem com `permite_repeticao` (RN1, exceção) | mesmo `if`, ramo falso por `permite_repeticao = true` |

#### `selecionarSemMeta` (critério de variedade/LRU, suporte a RN1)

| ID | Caso | Decisão coberta |
|---|---|---|
| UT-G10 | Prioriza nunca usada sobre já usada | comparação `ua !== ub` |
| UT-G11 | Empate de último uso → desempate por menor contagem | `ua === ub`, depois `ca !== cb` |
| UT-G12 | Empate total → desempate por menor id | `ua === ub && ca === cb`, retorno `a.id - b.id` |

#### `selecionarComMeta` (RN4) — tabela de decisão sobre soma × meta

| ID | Caso | Decisão coberta |
|---|---|---|
| UT-G13 | Combinação soma exatamente a meta | `soma <= meta` com `soma === meta` |
| UT-G14 | Prefere o maior total que não ultrapassa (não o mais distante por baixo) | ramo `soma > melhorSemUltrapassar.soma` |
| UT-G15 | Toda combinação ultrapassa → cai no fallback de menor total | `melhorSemUltrapassar === null`, usa `menorTotal` |
| UT-G16 | Maior total ≤ meta é achado mesmo com somas fora de ordem crescente no `Map` | robustez da comparação `soma > melhorSemUltrapassar.soma` independente da ordem de iteração |
| UT-G17 | Empate de soma total → mantém a primeira combinação encontrada | `soma > melhorSemUltrapassar.soma` é `false` em empate, não substitui |

#### `resolverCategoriasAtivas` (RN2)

| ID | Caso | Decisão coberta |
|---|---|---|
| UT-G18 | Sem preferência explícita, usa padrão café/almoço/jantar | ramo `Array.isArray(...) && length > 0` → falso, usa `CATEGORIAS_PADRAO` |
| UT-G19 | Usa array customizado quando informado | mesmo ramo → verdadeiro |
| UT-G20 | Lança erro com categoria inválida no array | `if (invalidas.length > 0) throw` |

#### `gerarCardapio` — integração das regras (RN1–RN5) em nível de função pura

| ID | Caso | RN | Decisão coberta |
|---|---|---|---|
| UT-G21 | Não repete café em 3 dias consecutivos | RN1 | loop `dias.forEach` + rastreamento `usadoOntem` entre iterações |
| UT-G22 | Respeita `historicoAnterior` na fronteira do período gerado | RN1 | seed de `usadoOntem` fora do primeiro dia do loop |
| UT-G23 | Sem customização, gera cafe/almoco/jantar e nunca lanche | RN2 | `resolverCategoriasAtivas` aplicado dentro do fluxo completo |
| UT-G24 | Com meta calórica, total diário ≤ meta | RN4 | ramo `meta !== null` → usa `selecionarComMeta` |
| UT-G25 | Categoria sem receita compatível gera erro e não interrompe as demais | RN5 | `if (candidatas.length === 0) { erros.push(...); continue; }` |
| UT-G26 | Lança erro quando `receitas` não é array | — (guarda de entrada) | `if (!Array.isArray(receitas)) throw` |
| UT-G27 | Lança erro quando `dias` não é array | — (guarda de entrada) | `if (!Array.isArray(dias)) throw` |
| UT-G28 | Lança erro quando chamado sem argumentos | — (guarda de entrada) | valor default `{}` do parâmetro + guarda acima |
| UT-G29 | Funciona com `preferencias` omitida, usando os padrões | RN2 | `preferencias || {}` |

*(29 casos, arquivo `backend/tests/unit/geradorCardapio.test.js`.)*

### 4.2 `validators.js`

#### `isDataValida` / `validarData`

| ID | Caso | Decisão / partição coberta |
|---|---|---|
| UT-V01 | Aceita `2026-08-12` | partição válida |
| UT-V02 | Rejeita formato fora do padrão (`12-08-2026`) | regex `DATA_REGEX` falha |
| UT-V03 | Rejeita data de calendário inexistente (`2026-02-31`) | regex passa, mas round-trip via `Date` diverge |
| UT-V04 | Rejeita valor que não é string | `typeof valor !== 'string'` |
| UT-V05 | `validarData` retorna o valor quando válido | ramo feliz |
| UT-V06 | `validarData` lança `AppError` 400 citando o campo | ramo de erro + verificação de `statusCode` e mensagem |

#### `validarCategoria`

| ID | Caso | Partição |
|---|---|---|
| UT-V07 | Aceita categoria válida (`cafe`) | dentro do enum |
| UT-V08 | Rejeita categoria inválida (`brunch`) | fora do enum |
| UT-V09 | Rejeita string vazia | fronteira do enum (vazio) |

#### `validarArrayDeStrings`

| ID | Caso | Partição/decisão |
|---|---|---|
| UT-V10 | Lança erro quando obrigatório e ausente | `opcional = false` + `undefined` |
| UT-V11 | Retorna `[]` quando opcional e ausente | `opcional = true` + `undefined` |
| UT-V12 | Rejeita valor que não é array | `!Array.isArray(valor)` |
| UT-V13 | Rejeita array com item não-string | `.some((v) => typeof v !== 'string')` |
| UT-V14 | Rejeita valor fora da lista de aceitos | `valoresAceitos` + `filter` não vazio |
| UT-V15 | Aceita array válido dentro dos aceitos | ramo feliz completo |

#### `validarReceitaPayload` (payload completo, `parcial=false`)

| ID | Caso | Campo / fronteira |
|---|---|---|
| UT-V16 | Aceita payload completo e válido | ramo feliz |
| UT-V17 | Rejeita corpo nulo | guarda `!body \|\| typeof body !== 'object'` |
| UT-V18 | Rejeita `nome` ausente | `typeof body.nome !== 'string'` |
| UT-V19 | Rejeita `nome` vazio após trim | `body.nome.trim().length === 0` |
| UT-V20 | Rejeita `categoria` ausente/inválida | delega a `validarCategoria` |
| UT-V21 | Rejeita `calorias = -1` (fronteira inválida) | `calorias < 0` |
| UT-V22 | Aceita `calorias = 0` (fronteira válida) | `calorias >= 0` |
| UT-V23 | Rejeita `calorias` não numérica | `typeof !== 'number'` |
| UT-V24 | Rejeita `ingredientes` ausente | delega a `validarArrayDeStrings` (obrigatório) |
| UT-V25 | Rejeita `ingredientes = []` quando não parcial | `dados.ingredientes.length === 0` |
| UT-V26 | Rejeita `tags_restricao` fora do enum | `valoresAceitos: RESTRICOES_VALIDAS` |
| UT-V27 | Aceita `tags_restricao` ausente → `[]` | `opcional: true` |
| UT-V28 | Rejeita `permite_repeticao` não-boolean | `typeof !== 'boolean'` |
| UT-V29 | Converte `permite_repeticao` ausente para `false` | `Boolean(undefined)` |

#### `validarReceitaPayload` (payload parcial)

| ID | Caso | Decisão |
|---|---|---|
| UT-V30 | Permite payload com apenas 1 campo quando `parcial=true` | ramo `!parcial \|\| body.X !== undefined` avaliado por campo |

#### `validarPreferenciasPayload`

| ID | Caso | Fronteira/decisão |
|---|---|---|
| UT-V31 | Rejeita corpo nulo | guarda de entrada |
| UT-V32 | Rejeita corpo vazio (nenhum campo) | `Object.keys(dados).length === 0` |
| UT-V33 | Rejeita `categorias_ativas: []` | `categorias.length === 0` |
| UT-V34 | Deduplica `categorias_ativas` repetidas | `[...new Set(categorias)]` |
| UT-V35 | Rejeita `restricoes` fora do enum | `valoresAceitos: RESTRICOES_VALIDAS` |
| UT-V36 | Deduplica `restricoes` repetidas | `[...new Set(...)]` |
| UT-V37 | Rejeita `meta_calorica = 0` (fronteira inválida) | `meta_calorica <= 0` |
| UT-V38 | Aceita `meta_calorica = 1` (fronteira válida) | `meta_calorica > 0` |
| UT-V39 | Aceita `meta_calorica = null` (limpa a meta) | ramo `!== null` é falso, pula validação numérica |
| UT-V40 | Rejeita `meta_calorica` não numérica | `typeof !== 'number'` |

#### `validarRegistroPayload`

| ID | Caso | Fronteira |
|---|---|---|
| UT-V41 | Rejeita corpo nulo | guarda de entrada |
| UT-V42 | Aceita payload válido e normaliza email (trim + lowercase) | ramo feliz + transformação |
| UT-V43 | Rejeita email sem `@` | `EMAIL_REGEX` falha |
| UT-V44 | Rejeita email sem domínio | `EMAIL_REGEX` falha (variação) |
| UT-V45 | Rejeita senha com 7 caracteres (fronteira abaixo do mínimo) | `senha.length < 8` |
| UT-V46 | Aceita senha com 8 caracteres (fronteira mínima válida) | `senha.length >= 8` |
| UT-V47 | Rejeita nome vazio/só espaços | `nome.trim().length === 0` |

#### `validarLoginPayload`

| ID | Caso | Decisão |
|---|---|---|
| UT-V48 | Aceita payload válido | ramo feliz |
| UT-V49 | Rejeita corpo nulo | guarda de entrada |
| UT-V50 | Rejeita email ausente | `typeof !== 'string' \|\| trim vazio` |
| UT-V51 | Rejeita senha ausente | `typeof !== 'string' \|\| length === 0` |

*(51 casos, arquivo `backend/tests/unit/validators.test.js`.)*

### 4.3 Gap identificado

`backend/src/utils/datas.js` (cálculo de semana ISO e mês) não tem suíte unitária própria — hoje só é exercitado indiretamente pelos testes de integração de `GET /cardapio` (IT-CARD-17–IT-CARD-21). Como é lógica pura de datas com casos de fronteira relevantes (ano bissexto, virada de mês/ano, domingo como fim de semana), recomenda-se criar `backend/tests/unit/datas.test.js` dedicado.

---

## 5. Casos de Integração — heurística VADER + regras de negócio

### 5.1 `/auth` — `backend/tests/integration/auth.test.js`

| ID | Verbo | VADER | Caso |
|---|---|---|---|
| IT-AUTH-01 | POST `/auth/registrar` | Data + Errors | Registra usuário novo → 201, sem expor `senha_hash` |
| IT-AUTH-02 | POST `/auth/registrar` | Errors | Email já cadastrado → 409 |
| IT-AUTH-03 | POST `/auth/registrar` | Data | Payload sem `nome` → 400 |
| IT-AUTH-04 | GET `/auth/registrar` | Verbs | Verbo não suportado na rota → 404 |
| IT-AUTH-05 | POST `/auth/login` | Data | Credenciais válidas → 200, token + dados públicos |
| IT-AUTH-06 | POST `/auth/login` | Errors | Senha errada → 401, mensagem genérica |
| IT-AUTH-07 | POST `/auth/login` | Errors | Email inexistente → 401, **mesma** mensagem genérica (não vaza quais emails existem) |

### 5.2 Autorização — `backend/tests/integration/autorizacao.test.js`

| ID | VADER | RN | Caso |
|---|---|---|---|
| IT-AUTZ-01–03 | Authorization | RN6 | `GET /receitas`, `GET /preferencias`, `GET /cardapio` sem header → 401 "Token de autenticação ausente" (via `test.each`) |
| IT-AUTZ-04 | Authorization | RN6 | `POST /cardapio/gerar` sem header → 401 |
| IT-AUTZ-05 | Authorization | RN6 | Header sem prefixo `Bearer ` → 401 |
| IT-AUTZ-06 | Authorization | RN6 | Token malformado/assinatura inválida → 401 "Token inválido" |
| IT-AUTZ-07 | Authorization | RN6 | Token expirado (`expiresIn: '-1s'`) → 401 "Token expirado" |
| IT-AUTZ-08 | Authorization | RN7 | Receita criada por A não aparece na listagem de B |
| IT-AUTZ-09 | Authorization | RN7 | `GET /receitas/:id` de receita de A → 404 para B (não vaza existência) |
| IT-AUTZ-10 | Authorization | RN7 | `PUT` em receita de A como B → 404 |
| IT-AUTZ-11 | Authorization | RN7 | `DELETE` em receita de A como B → 404, receita de A permanece intacta |
| IT-AUTZ-12 | Authorization | RN7 | Cardápio gerado por A não aparece na consulta de B |
| IT-AUTZ-13 | Authorization | RN7 | B não edita cardápio referenciando receita de A → 404 |

### 5.3 `/receitas` — `backend/tests/integration/receitas.test.js`

| ID | Verbo | VADER | RN | Caso |
|---|---|---|---|---|
| IT-REC-01 | POST | Verbs + Data | — | Cria receita → 201 com payload completo |
| IT-REC-02 | GET | Verbs + Data | — | Lista receitas do usuário autenticado |
| IT-REC-03 | GET `?categoria=` | Data | — | Filtra pela categoria informada |
| IT-REC-04 | GET `?categoria=` | Errors | — | Categoria inválida → 400 |
| IT-REC-05 | GET `/:id` | Errors | — | Id inexistente → 404 |
| IT-REC-06 | PUT | Verbs + Data | — | Atualiza receita existente, reflete mudança |
| IT-REC-07 | PUT | Errors | — | Id inexistente → 404 |
| IT-REC-08 | DELETE | Verbs | — | Remove receita; GET subsequente → 404 |
| IT-REC-09 | DELETE | Errors | RN8 | Receita referenciada no cardápio → 409 (integridade referencial) |
| IT-REC-10 | DELETE | Errors | — | Id inexistente → 404 |
| IT-REC-11 | POST | Data + Errors | — | Payload sem `nome` → 400 (confirma wiring do validator na rota) |

### 5.4 `/preferencias` — `backend/tests/integration/preferencias.test.js`

| ID | Verbo | VADER | RN | Caso |
|---|---|---|---|---|
| IT-PREF-01 | GET | Data | RN2 | Logo após registro, retorna defaults (`cafe/almoco/jantar`, sem restrição, sem meta) |
| IT-PREF-02 | PUT | Data | — | Atualiza `meta_calorica` isoladamente, sem alterar os demais campos |
| IT-PREF-03 | PUT | Data | RN2 | Atualiza `categorias_ativas` e deduplica |
| IT-PREF-04 | PUT | Data | RN3 | Atualiza `restricoes` |
| IT-PREF-05 | PUT | Errors | — | Corpo vazio → 400 |
| IT-PREF-06 | PUT | Data | RN4 | `meta_calorica: null` limpa meta previamente definida |

### 5.5 `/cardapio` — `backend/tests/integration/cardapio.test.js`

**POST /cardapio/gerar**

| ID | VADER | RN | Caso |
|---|---|---|---|
| IT-CARD-01 | Data | RN1 | Não repete receita de categoria sem `permite_repeticao` em dias consecutivos |
| IT-CARD-02 | Data | RN1, RN5 | Respeita histórico já persistido entre chamadas separadas (fronteira via banco) |
| IT-CARD-03 | Data | RN2 | Sem customizar preferências, cardápio não inclui lanche |
| IT-CARD-04 | Data | RN2 | Após ativar lanche nas preferências, cardápio passa a incluí-lo |
| IT-CARD-05 | Data | RN3 | Nenhuma receita gerada carrega tag presente nas restrições ativas |
| IT-CARD-06 | Data | RN4 | Com meta calórica definida, total diário ≤ meta |
| IT-CARD-07 | Data | RN4 | Meta impossível → ainda gera cardápio (melhor esforço, não vazio) |
| IT-CARD-08 | Data + Errors | RN5 | Categoria sem receita compatível entra em `erros`, não impede as demais |
| IT-CARD-09 | Errors | — | `dias: []` → 400 |
| IT-CARD-10 | Errors | — | `dias` com mais de 90 datas → 400 |
| IT-CARD-11 | Errors | — | Data inválida em `dias` → 400 |
| IT-CARD-12 | Errors | — | Nem `dias` nem `data_inicio` informados → 400 |
| IT-CARD-13 | Data | — | Modo `data_inicio` + `quantidade_dias` gera o número correto de dias |

**PUT /cardapio/:dia/:categoria**

| ID | VADER | RN | Caso |
|---|---|---|---|
| IT-CARD-14 | Data | RN9 | Edição manual persiste e sobrescreve entrada gerada automaticamente |
| IT-CARD-15 | Data | RN9 | Entradas de `POST /gerar` vêm marcadas como `"gerado"` |
| IT-CARD-16 | Data | RN9 | Entrada editada manualmente fica marcada como `"manual"` (GET reflete) |
| IT-CARD-17 | Data | RN9 | Gerar novamente sobre período com edição manual reverte origem para `"gerado"` |
| IT-CARD-18 | Errors | — | Receita de categoria incompatível com a rota → 400 com mensagem exata |
| IT-CARD-19 | Errors | — | `receita_id` inexistente → 404 |
| IT-CARD-20 | Errors | — | `receita_id` ausente → 400 |
| IT-CARD-21 | Errors | — | `dia` com formato inválido na URL → 400 |
| IT-CARD-22 | Errors | — | Categoria inválida na URL → 400 |

**GET /cardapio**

| ID | VADER | Caso |
|---|---|---|
| IT-CARD-23 | Data | `?semana` calcula segunda a domingo contendo a data (meio de semana) |
| IT-CARD-24 | Data | `?semana` com data que já é domingo usa esse dia como fim |
| IT-CARD-25 | Data | `?mes` calcula do 1º ao último dia (fevereiro, mês curto) |
| IT-CARD-26 | Errors | `semana` e `mes` juntos → 400 |
| IT-CARD-27 | Errors | Nem `semana` nem `mes` → 400 |
| IT-CARD-28 | Data | Período sem cardápio gerado → 200 com lista vazia (não 404) |

*(Total: 26 casos de integração só em `/cardapio`, arquivo `backend/tests/integration/cardapio.test.js`.)*

---

## 6. Casos de Contrato — por endpoint

Fonte: `backend/tests/contract/contrato.test.js` + `backend/tests/contract/helpers/contractMatchers.js`.

| ID | Endpoint | O que valida |
|---|---|---|
| CT-01 | POST `/auth/registrar` | Resposta 201 tem exatamente `id`/`email`/`nome`, tipos corretos, **sem** `senha_hash` |
| CT-02 | POST `/auth/login` | Resposta 200 tem `token` (string) + `usuario` com shape público |
| CT-03 | POST `/receitas` | Resposta tem shape completo de receita (`id`, `nome`, `categoria`, `calorias`, `ingredientes[]`, `tags_restricao[]`, `permite_repeticao`) com tipos corretos |
| CT-04 | GET `/receitas` | Array onde cada item respeita o shape de receita |
| CT-05 | GET `/preferencias` | Retorna exatamente `categorias_ativas`/`restricoes`/`meta_calorica` com tipos corretos (`meta_calorica` é `number \| null`) |
| CT-06 | POST `/cardapio/gerar` | Retorna `{ cardapio: [...], erros: [...] }`; cada entrada de `cardapio` respeita shape (`dia`, `categoria`, `receita` aninhada, `origem` ∈ `{gerado, manual}`); cada erro tem exatamente `categoria`/`dia`/`motivo` |
| CT-07 | GET `/cardapio` | Retorna `{ periodo: {tipo, inicio, fim}, cardapio: [...] }` com shape correto |
| CT-08 | PUT `/cardapio/:dia/:categoria` | Retorna uma entrada de cardápio com shape correto |
| CT-09 | Erros (400/401/404/409, transversal) | Toda resposta de erro é `{ erro: string }`, verificado nos 3 status via um único teste parametrizado (sem token → 401; recurso inexistente → 404; payload inválido → 400) |

*(9 casos. O matcher `assertReceitaShape` é reutilizado por `assertCardapioEntradaShape`, então qualquer regressão no shape de receita é detectada em ambos os contextos — cardápio e listagem direta.)*

---

## 7. Casos E2E — por fluxo do usuário

Fonte: `e2e/tests/*.spec.js` (Playwright). Os 3 cenários foram escolhidos deliberadamente como os de maior risco/valor, **não** um fluxo completo ponta a ponta — decisão já registrada nos comentários dos próprios specs.

| ID | Arquivo | Fluxo | RN | O que verifica |
|---|---|---|---|---|
| E2E-01 | `geracao-cardapio.spec.js` | Geração automática respeitando restrição + meta | RN3, RN4 | Cria 4 receitas (1 com glúten), ativa restrição a glúten e meta de 1200 kcal, clica em "Gerar cardápio automático" na grade semanal real. Verifica que **nenhuma** célula de café exibe a receita com glúten e que o total diário (via `data-total`/`data-meta` do medidor de meta) nunca ultrapassa a meta, em todas as células visíveis. |
| E2E-02 | `edicao-manual-cardapio.spec.js` | Edição manual persistente através de reload real | RN9 | Gera cardápio, troca manualmente a receita de uma célula de café via dropdown, confirma que o nome muda e que a assinatura visual (sublinhado ondulado, `text-decoration-style: wavy`) aparece. Decisivo: dá **`page.reload()`** (reload real do navegador, não navegação client-side) e confirma que o valor, o atributo `data-origem="manual"` e o sublinhado sobrevivem — cobre exatamente o tipo de bug já visto em desenvolvimento (rota do SPA colidindo com o proxy da API). |
| E2E-03 | `nao-repeticao-consecutiva.spec.js` | Não repetição em dias consecutivos, na grade real | RN1 | Cadastra 2 opções de café sem `permite_repeticao` (garante que o algoritmo sempre consegue alternar, sem células vazias por RN5 interferindo). Gera a semana inteira (7 dias) e verifica, célula a célula na grade real, que nenhum dia repete a receita de café do dia anterior. |

### 7.1 Fluxos de usuário não cobertos por E2E (fora do escopo atual)

- Cadastro/edição/remoção de receita pela UI (coberto só via API nos helpers de setup dos specs, não pela interface).
- Tela de preferências (só é acionada via helper `atualizarPreferencias`, chamando a API diretamente — não há clique real na UI de preferências).
- Visão mensal consolidada do cardápio.
- Fluxo de registro/login pela UI (os specs entram já autenticados via `entrarComSessao`, injetando sessão — não exercitam o formulário de login real).

Essas lacunas são aceitáveis dado o critério explícito de "cenários de maior risco/valor" do plano de execução, mas ficam registradas aqui para uma decisão consciente de prioridade futura, não como esquecimento.

---

## 8. Resumo quantitativo

| Camada | Arquivos | Casos |
|---|---|---|
| Unitário | 2 (`geradorCardapio.test.js`, `validators.test.js`) | 80 |
| Integração | 5 (`auth`, `autorizacao`, `receitas`, `preferencias`, `cardapio`) | 65 |
| Contrato | 1 (`contrato.test.js`) | 9 |
| E2E | 3 specs Playwright | 3 |
| **Total** | **11 arquivos** | **157 casos** |

*(Contagem exclui 1 teste de `auth.test.js` que é um smoke test do próprio helper de setup `criarUsuarioAutenticado`, não um caso de negócio.)*

Cobertura de sentença/decisão exigida no CI: ≥ 90% em `geradorCardapio.js` e `validators.js` (`backend/jest.config.js`), com relatório publicado como artefato (`coverage-report`) a cada execução do workflow `Testes` (`.github/workflows/tests.yml`).
