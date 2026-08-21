# Planejador de Dieta — Fase 2: Plano de Execução e Prompts (Melhorias)

Continuação de [planejador-dieta-plano-execucao.md](planejador-dieta-plano-execucao.md), com 4 melhorias solicitadas sobre a base já implementada.

---

## Resumo das mudanças

| # | Feature | Camadas afetadas | Complexidade | Depende de |
|---|---|---|---|---|
| 1 | Limite nos campos | Backend (validators) + Frontend (forms) | Baixa | — |
| 2 | Múltiplas categorias por receita | Schema + Algoritmo de geração + API + UI + Testes | Média | — |
| 3 | Despensa: ingredientes estruturados + cálculo automático de calorias | Schema + API + UI + Testes | Alta | — |
| 4 | Lista de compras (semana/mês) | Schema (leitura) + API + UI + Testes | Média | Feature 3 |

**Ordem recomendada: 1 → 2 → 3 → 4.** 1 e 2 são independentes e de baixo risco (bom aquecimento). 3 muda o formato de `ingredientes` de `string[]` para objetos estruturados — a 4 (lista de compras) só faz sentido agregando quantidades reais, então precisa que 3 já exista.

---

## Decisões de projeto assumidas neste plano

Marquei como **[DECISÃO]** os pontos onde tomei um caminho por padrão. Se algum não fizer sentido pra você, é só falar antes de eu seguir com a implementação.

**[DECISÃO 1] Migração do banco.** O projeto não tem sistema de migração (`connection.js` só roda `schema.sql` uma vez, se as tabelas não existirem). Para não perder as receitas e o histórico de cardápio que você já tem localmente, vou adicionar uma rotina de migração leve e idempotente em `connection.js` (verifica se a coluna/tabela antiga existe, migra os dados, aplica o novo schema) em vez de simplesmente apagar `backend/data/dieta.db`.

**[DECISÃO 2] Base de calorias por alimento (feature 3).** Em vez de integrar com uma API externa de nutrição (dependência de internet, custo, rate limit — foge do estilo 100% local/SQLite do projeto), vou criar uma tabela `alimentos` local, semeada com um conjunto curado de alimentos comuns (nome, kcal por 100g, opcionalmente kcal por unidade para itens como "1 ovo"). O cálculo é automático quando o alimento está na base; se não estiver, o usuário digita a caloria manualmente para aquele ingrediente (fallback). A base pode crescer com o tempo (tela simples de cadastro de alimento, ou seed maior depois).

**[DECISÃO 3] Lista de compras.** Agregada por alimento (soma a quantidade do mesmo alimento em receitas diferentes do período), calculada on-the-fly (não persistida) — sem gravar "já comprei" no banco na v1, pra manter o escopo enxuto. O checkbox de "comprado" existe só na tela, reseta ao recarregar. Se fizer falta na prática, dá pra persistir depois.

---

## Feature 1 — Limite nos campos

**Escopo:** validação de tamanho/faixa em todos os campos de entrada, no backend (fonte da verdade, em `backend/src/utils/validators.js`) e replicada no frontend (`maxLength`/`min`/`max` + mensagens, em `ReceitaForm.jsx`, `Preferencias.jsx`, `AuthForm`/`Registro.jsx`).

**Limites propostos:**

| Campo | Limite proposto | Onde hoje |
|---|---|---|
| `receita.nome` | 3–120 caracteres | sem limite |
| `receita.calorias` | 0–10000 kcal | só `>= 0` |
| `receita.ingredientes` | 1–30 itens, cada item 1–200 caracteres | sem limite |
| `usuario.nome` | 2–120 caracteres | sem limite |
| `usuario.email` | até 254 caracteres (RFC 5321) | sem limite |
| `usuario.senha` | 8–72 caracteres (72 = limite prático de hash) | só mínimo 8 |
| `preferencia.meta_calorica` | 200–10000 kcal | só `> 0` |

**Testes:** unitário (Jest) cobrindo decisão/sentença de cada nova validação (limite inferior, superior, dentro da faixa); integração (Supertest) com payloads no limite e além do limite por endpoint.

---

## Feature 2 — Múltiplas categorias por receita

Hoje `receitas.categoria` é uma coluna única (`cafe`/`almoco`/`jantar`/`lanche`). O algoritmo de geração (`geradorCardapio.js`) filtra candidatas com `r.categoria !== categoria`.

**Modelo de dados:** nova tabela `receita_categorias` (N:N, no mesmo padrão de `receita_restricoes`):

```sql
CREATE TABLE receita_categorias (
  receita_id INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  categoria  TEXT NOT NULL REFERENCES categorias(codigo),
  PRIMARY KEY (receita_id, categoria)
);
```

A coluna `receitas.categoria` é removida; a API passa a expor `categorias: string[]` (mín. 1 item, sem duplicata).

**Impacto no algoritmo:** `filtrarCandidatas` passa a checar `r.categorias.includes(categoria)` em vez de igualdade. A tabela `cardapio` **não muda** — ela já guarda uma categoria por dia/slot; uma receita elegível para café e lanche pode preencher qualquer um dos dois slots num dia, sem ambiguidade.

**Impacto na UI:** `ReceitaForm` troca o `<Select>` único de categoria por um grupo de checkboxes (mesmo padrão visual já usado para `tags_restricao`); `CategoriaSelo` passa a ser renderizado em lista (um selo por categoria) em `ReceitaCard`, `CardapioSemana` e `CardapioMes`.

**Testes:** unitário no filtro de candidatas (receita com 2+ categorias elegível nos dois slots); integração no CRUD de receitas com `categorias` vazio/inválido/duplicado; contrato validando o novo formato de resposta; E2E cadastrando uma receita em 3 categorias e conferindo que ela pode aparecer em qualquer uma delas após gerar o cardápio.

---

## Feature 3 — Despensa: ingredientes estruturados + cálculo automático de calorias

Hoje `ingredientes` é um array de strings livres (`"2 ovos"`), sem quantidade nem unidade estruturada, e `calorias` é digitado manualmente para a receita inteira.

**Modelo de dados:**

```sql
CREATE TABLE alimentos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT NOT NULL UNIQUE,
  kcal_por_100g  REAL,          -- para unidade g/kg/ml/l
  kcal_por_unidade REAL         -- para unidade 'unidade' (ex.: 1 ovo)
);

-- substitui receita_ingredientes atual
CREATE TABLE receita_ingredientes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  receita_id          INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  alimento_id         INTEGER REFERENCES alimentos(id),   -- NULL se for item livre sem calorias
  descricao_livre     TEXT,                                -- usado quando alimento_id é NULL
  quantidade          REAL NOT NULL CHECK (quantidade > 0),
  unidade             TEXT NOT NULL CHECK (unidade IN ('g','kg','ml','l','unidade')),
  calorias_calculadas REAL,     -- snapshot calculado no momento do save
  ordem               INTEGER NOT NULL DEFAULT 0
);
```

A base `alimentos` é semeada com um conjunto curado de itens comuns (ex.: baseado na tabela TACO), com espaço para o usuário cadastrar novos alimentos manualmente pela UI (nome + kcal/100g).

**Regra de cálculo:**
- `unidade` em `g/kg/ml/l` → `calorias = kcal_por_100g * quantidade_em_g / 100` (kg/l convertidos para g/ml, aproximando densidade de água para líquidos — dá pra ajustar por alimento se precisar de mais precisão depois).
- `unidade = 'unidade'` → exige `kcal_por_unidade` no alimento; se não existir, bloqueia essa unidade pra esse alimento e pede g/kg/ml/l.
- Alimento não encontrado na busca → usuário digita `descricao_livre` + caloria manual pra aquele item (sem `alimento_id`).
- `receita.calorias` (total) passa a ser **sugerido automaticamente** como a soma dos itens, mas continua editável manualmente (perdas de preparo, tempero, etc. não entram na conta do alimento cru).

**UI:** em `ReceitaForm`, cada linha de ingrediente vira: campo de busca de alimento (autocomplete via `GET /alimentos?busca=`) + quantidade + unidade + caloria calculada (somente leitura, com opção "usar valor manual" quando não há alimento correspondente). O total de calorias da receita atualiza em tempo real conforme os itens mudam, com botão "usar total calculado" vs. edição manual.

**Testes:** unitário na função pura de cálculo (unidade cada uma, conversão kg/l, alimento sem `kcal_por_unidade` com unidade `unidade` → erro claro, alimento não encontrado → sem cálculo); integração no novo endpoint `/alimentos` (busca, criação) e no CRUD de receitas com ingredientes estruturados; contrato do novo formato de `ingredientes`; E2E cadastrando uma receita, buscando um alimento pela busca, preenchendo quantidade e conferindo que a caloria aparece calculada e soma no total.

---

## Feature 4 — Lista de compras

Nova tela que agrega os ingredientes de todas as receitas do cardápio de um período (semana ou mês), somando quantidades do mesmo alimento.

**Backend:** `GET /lista-compras?inicio=YYYY-MM-DD&fim=YYYY-MM-DD` — reaproveita `cardapioRepository.buscarPorIntervalo`, junta os ingredientes estruturados das receitas do período e agrega por `alimento_id` (mesma unidade soma direto; unidades diferentes do mesmo alimento são convertidas para a mesma base antes de somar, ex. g e kg). Resposta:

```json
{
  "itens": [
    { "alimento": "Ovo", "quantidade_total": 12, "unidade": "unidade" },
    { "alimento": "Farinha de mandioca", "quantidade_total": 900, "unidade": "g" }
  ],
  "itens_sem_estrutura": [
    { "descricao": "tempero a gosto", "receitas": ["Cuscuz"] }
  ]
}
```

`itens_sem_estrutura` cobre ingredientes cadastrados como `descricao_livre` (sem alimento vinculado) — aparecem separados, sem soma, só listados por nome de receita de origem.

**Frontend:** página `ListaCompras.jsx` (rota nova), com alternância Semana/Mês (reaproveitando os seletores de período já usados em `CardapioSemana`/`CardapioMes`), lista agrupada por item com checkbox local de "comprado" (estado só na tela, não persiste).

**Testes:** unitário na função pura de agregação (mesmo alimento em unidades iguais, mesmo alimento em unidades convertíveis, alimento sem estrutura cai em `itens_sem_estrutura`, período sem cardápio gerado → lista vazia com mensagem clara); integração no endpoint (VADER completo); contrato da resposta; E2E gerando um cardápio da semana com uma receita repetida em dois dias e conferindo que a quantidade do ingrediente aparece somada corretamente na lista.

---

## Estratégia de execução — chats e modelos

O plano original (`planejador-dieta-plano-execucao.md`) foi pensado para conversas avulsas coladas em chats separados, porque construía o projeto do zero. Aqui a situação é diferente: são 4 mudanças **incrementais sobre um código já existente**, com dependência de schema entre as features (3 depende de 2 já ter mudado a tabela `receitas`; 4 depende de 3). Nesse cenário, recomendo:

- **Rodar tudo pelo Claude Code (este tipo de sessão), não em chats avulsos do claude.ai.** Um chat avulso não tem acesso ao repositório — você teria que colar arquivos inteiros manualmente e não consegue rodar os testes pra confirmar que nada quebrou. O Claude Code lê o schema e o código reais, edita os arquivos certos e roda a suíte de testes existente a cada passo.
- **Uma sessão contínua (ou sessões no mesmo repositório/branch), em sequência — nunca em paralelo.** Como 3 e 4 dependem do schema criado nas etapas anteriores, rodar em paralelo geraria conflito de schema. Faça um commit por feature, com os testes verdes antes de passar pra próxima.
- **Modelo:** Sonnet 5 dá conta bem da maior parte — é código repetitivo em cima de padrões já existentes no projeto (a tabela N:N de categorias é uma cópia do padrão de `receita_restricoes`, por exemplo). Vale trocar para Opus 5 especificamente no desenho do modelo de dados/regra de conversão de unidades da feature 3 e no algoritmo de agregação da feature 4 (mais raciocínio, menos repetição de padrão), e numa revisão final de consistência entre as 4 features.

| Etapa | Modelo recomendado |
|---|---|
| Feature 1 — Limite nos campos | Sonnet 5 |
| Feature 2 — Múltiplas categorias | Sonnet 5 |
| Feature 3 — Modelo de dados + regra de conversão de unidades | Opus 5 |
| Feature 3 — Implementação (API + UI + testes) | Sonnet 5 |
| Feature 4 — Algoritmo de agregação | Opus 5 |
| Feature 4 — Implementação (API + UI + testes) | Sonnet 5 |
| Revisão final de consistência (schema, API, frontend, testes) | Opus 5 |

---

## Prompts prontos (colar em uma sessão do Claude Code, nesta ordem)

### Prompt 1 — Limite nos campos
**Modelo:** Claude Sonnet 5

```
Adicione limites de tamanho/faixa nos campos de entrada do planejador de
dieta, tanto no backend (backend/src/utils/validators.js, fonte da
verdade) quanto replicados no frontend (maxLength/min/max + mensagem de
erro). Limites: receita.nome 3-120 caracteres; receita.calorias 0-10000;
receita.ingredientes 1-30 itens, cada item 1-200 caracteres; usuario.nome
2-120 caracteres; usuario.email até 254 caracteres; usuario.senha 8-72
caracteres; preferencia.meta_calorica 200-10000. Atualize os testes
unitários de validators.test.js cobrindo limite inferior, superior e
dentro da faixa para cada campo, e os testes de integração com payloads
no limite e além do limite.
```

### Prompt 2 — Múltiplas categorias por receita
**Modelo:** Claude Sonnet 5

```
Quero que uma receita possa pertencer a mais de uma categoria (ex.:
cuscuz em café, almoço e lanche). Hoje receitas.categoria é uma coluna
única em backend/db/schema.sql, e backend/src/services/geradorCardapio.js
filtra candidatas com r.categoria !== categoria. Crie uma tabela N:N
receita_categorias (mesmo padrão de receita_restricoes já existente no
schema), migre os dados existentes da coluna categoria para a nova
tabela via uma rotina idempotente em backend/src/db/connection.js (não
pode perder dados dos usuários já cadastrados), remova a coluna antiga,
e exponha categorias como array na API (mínimo 1 item, sem duplicata).
Atualize geradorCardapio.js para checar r.categorias.includes(categoria).
No frontend, troque o Select único de categoria em ReceitaForm.jsx por
um grupo de checkboxes (mesmo padrão visual usado para tags_restricao),
e ajuste CategoriaSelo para renderizar uma lista de selos em
ReceitaCard, CardapioSemana e CardapioMes. Atualize todos os testes
unitários, de integração, de contrato e o E2E de geração de cardápio
para o novo formato, e adicione um teste E2E cadastrando uma receita em
3 categorias e conferindo que ela é elegível em qualquer uma delas.
```

### Prompt 3a — Modelo de dados e regra de conversão (despensa)
**Modelo:** Claude Opus 5

```
Preciso estruturar os ingredientes de uma receita no planejador de
dieta (hoje são só strings livres em receita_ingredientes) para
calcular a caloria automaticamente a partir de alimento + quantidade.
Desenhe: uma tabela alimentos (nome único, kcal_por_100g, e opcional
kcal_por_unidade para itens como "1 ovo"); e a nova
receita_ingredientes com alimento_id opcional (NULL quando o usuário
digita um item livre sem alimento cadastrado, usando descricao_livre),
quantidade, unidade (g/kg/ml/l/unidade) e calorias_calculadas como
snapshot. Defina a regra de cálculo: kcal_por_100g * quantidade
convertida para g/ml / 100 para g/kg/ml/l (kg e l convertidos para
g/ml, litro aproximando densidade da água); para unidade 'unidade',
exige kcal_por_unidade no alimento cadastrado, senão bloqueia essa
unidade para aquele alimento com erro claro. receita.calorias (total)
passa a ser sugerido automaticamente como soma dos itens, mas
continua editável manualmente. Proponha o schema SQL final e a função
pura de cálculo (sem tocar em banco/HTTP), pronta para receber testes
de cobertura de sentença e decisão.
```

### Prompt 3b — Implementação (despensa)
**Modelo:** Claude Sonnet 5

```
Com base no modelo de dados e na função de cálculo de calorias já
definidos para ingredientes estruturados, implemente: migração da
tabela receita_ingredientes e criação de alimentos em
backend/db/schema.sql + rotina de migração idempotente em
backend/src/db/connection.js preservando receitas já cadastradas;
endpoint GET /alimentos?busca= para autocomplete e POST /alimentos
para cadastrar um novo alimento (nome + kcal_por_100g); CRUD de
receitas atualizado para aceitar ingredientes estruturados. No
frontend, em ReceitaForm.jsx, cada linha de ingrediente vira busca de
alimento (autocomplete) + quantidade + unidade + caloria calculada
somente leitura, com opção de usar valor manual quando o alimento não
é encontrado; o total de calorias da receita atualiza em tempo real
conforme os itens mudam, com opção de usar o total calculado ou
editar manualmente. Gere testes unitários da função de cálculo
(cada unidade, conversão kg/l, alimento sem kcal_por_unidade em
unidade 'unidade', alimento não encontrado), testes de integração dos
novos endpoints e do CRUD de receitas com VADER completo, testes de
contrato do novo formato de ingredientes, e um teste E2E cadastrando
uma receita, buscando um alimento, preenchendo quantidade e conferindo
que a caloria calculada aparece e soma no total.
```

### Prompt 4a — Algoritmo de agregação (lista de compras)
**Modelo:** Claude Opus 5

```
Preciso de uma função pura de agregação para uma lista de compras no
planejador de dieta: recebe uma lista de entradas de cardápio de um
período (cada uma com sua receita e os ingredientes estruturados dela
— alimento, quantidade, unidade) e devolve os itens agregados por
alimento, somando quantidade quando a unidade é igual, convertendo
antes de somar quando as unidades são compatíveis (g/kg, ml/l), e
separando em uma lista à parte os ingredientes sem alimento vinculado
(descricao_livre), listados por nome mas sem soma, indicando de quais
receitas vieram. Trate período sem cardápio gerado retornando lista
vazia com uma mensagem clara em vez de erro. Escreva a função sem
tocar em banco/HTTP, pronta para receber testes de cobertura de
sentença e decisão.
```

### Prompt 4b — Implementação (lista de compras)
**Modelo:** Claude Sonnet 5

```
Com base na função de agregação de lista de compras já definida,
implemente o endpoint GET /lista-compras?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
reaproveitando cardapioRepository.buscarPorIntervalo para buscar as
entradas do período e aplicando a agregação. No frontend, crie a
página ListaCompras.jsx (nova rota) com alternância Semana/Mês
reaproveitando os seletores de período já usados em CardapioSemana.jsx
e CardapioMes.jsx, exibindo os itens agregados agrupados, com checkbox
local de "comprado" (estado só na tela, sem persistir no backend), e
os itens sem estrutura separados com indicação de receita de origem.
Gere testes unitários da agregação, testes de integração do endpoint
com heurística VADER completa, testes de contrato da resposta, e um
teste E2E gerando um cardápio da semana com uma receita repetida em
dois dias e conferindo que a quantidade do ingrediente aparece somada
corretamente na lista de compras.
```

### Prompt 5 — Revisão final
**Modelo:** Claude Opus 5

```
Revise as 4 melhorias implementadas no planejador de dieta (limites de
campo, múltiplas categorias por receita, ingredientes estruturados com
cálculo automático de calorias, e lista de compras) verificando:
consistência entre schema, API e frontend; se a migração preservou os
dados existentes corretamente; se todas as regras de negócio novas
estão cobertas em pelo menos uma camada de teste (unitário, integração,
contrato, E2E); se a documentação de testes em docs/documentacao-de-testes.md
precisa de atualização; e se há gaps ou inconsistências entre as
features, especialmente na dependência entre ingredientes estruturados
(feature 3) e a agregação da lista de compras (feature 4).
```
