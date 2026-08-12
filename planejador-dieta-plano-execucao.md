# Planejador de Dieta — Plano de Execução e Prompts

## Visão Geral do Projeto

Site de organização de dieta por mês/semana a partir de uma base de receitas, com geração híbrida de cardápio (sugestão automática + edição manual pelo usuário).

**Stack:** Node.js + Express + SQLite + React

---

## Modelo de Dados

- **Receita**: id, nome, categoria (cafe/almoco/jantar/lanche), calorias, ingredientes (array), tags_restricao (array: gluten/lactose/acucar_refinado), permite_repeticao (boolean)
- **PreferenciaUsuario**: categorias_ativas (array), restricoes (array), meta_calorica (number, opcional)
- **Cardapio**: dia (date), categoria, receita_id

---

## Regras de Negócio

1. Receita não pode repetir em 2 dias consecutivos, exceto se `permite_repeticao = true`
2. Café, almoço e jantar são obrigatórios por padrão; lanche é opcional; usuário pode customizar quais categorias quer ativas por dia
3. Sistema só sugere receitas compatíveis com as restrições alimentares do usuário (glúten, lactose, açúcar refinado)
4. Se houver meta calórica, o algoritmo prioriza receitas que aproximam o total diário da meta, sem ultrapassar
5. Se nenhuma receita compatível existir para uma categoria/dia, retornar erro claro (não quebrar a geração)

---

## Estratégia de Testes

- **Unitário (Jest):** cobertura de sentença e de decisão, com foco no algoritmo de geração de cardápio e nas funções de validação. Relatório de cobertura nativo do Jest configurado no CI.
- **Integração (Jest + Supertest):** heurística **VADER** completa — Verbs (verbos HTTP), Authorization, Data (payloads válidos/inválidos/vazios), Errors (códigos e mensagens), Responsiveness (tempo de resposta) — além da validação de todas as regras de negócio pela camada da API.
- **Contrato (camada de API, Jest):** estrutura de resposta, tipos de dados e campos obrigatórios de cada endpoint, garantindo que o backend não quebra o frontend silenciosamente.
- **E2E (Playwright):** cenários de maior risco e valor para o produto — geração automática respeitando restrições e meta calórica, não repetição em dias consecutivos e edição manual do cardápio — em vez do fluxo completo ponta a ponta.

## Avaliação da Estratégia (visão QA sênior)

**Pontos fortes:**
- Cobertura das três camadas da pirâmide de testes (unitário, integração, E2E)
- Uso de heurística estruturada (VADER) na integração — diferencial pouco comum
- Validação de regras de negócio em mais de uma camada

**Ajustes aplicados:**
- Cobertura de sentença/decisão delimitada ao algoritmo de geração (evita testes frágeis por excesso de escopo)
- Adição de testes de contrato na camada de API

---

## Documentação de Testes a Gerar (formato livre, bem estruturado)

1. Estratégia de testes (objetivos, escopo, técnicas, critérios de entrada/saída)
2. Plano de testes com casos mapeados por técnica e regra de negócio
3. Matriz de rastreabilidade (caso de teste → regra de negócio)
4. Casos unitários com sentenças/decisões cobertas explicitadas
5. Casos de integração mapeados por VADER + regras de negócio
6. Casos de contrato por endpoint
7. Casos E2E por fluxo
8. Configuração do relatório de cobertura no CI

---

## Mapeamento de Modelos por Etapa

| Etapa | Modelo recomendado |
|---|---|
| Arquitetura e modelagem de dados | Claude Sonnet 5 |
| Algoritmo de geração (regras complexas) | Claude Opus 4.8 |
| Código backend/frontend | Claude Sonnet 5 (via Claude Code) |
| Geração dos testes | Claude Sonnet 5 (via Claude Code) |
| Documentação de testes | Claude Sonnet 5 |
| Revisão final / detecção de inconsistências | Claude Opus 4.8 |

*Observação: a troca de modelo é manual — abra uma conversa com o modelo indicado e cole o prompt correspondente à etapa.*

---

## Prompts por Etapa

### Prompt 1 — Modelagem de dados
**Modelo:** Claude Sonnet 5

```
Quero modelar o banco de dados SQLite para um planejador de dieta. As
entidades são: Receita com id, nome, categoria (cafe, almoco, jantar,
lanche), calorias, ingredientes em array, tags de restrição em array
(gluten, lactose, acucar refinado) e permite repetição como boolean.
Preferência do usuário com categorias ativas, restrições e meta
calórica opcional. Cardápio com dia, categoria e receita associada.
Gere o schema SQL completo com os relacionamentos corretos.
```

### Prompt 2 — Algoritmo de geração de cardápio
**Modelo:** Claude Opus 4.8

```
Tenho um planejador de dieta com as seguintes regras de negócio:
receita não repete em 2 dias consecutivos exceto se permite repetição
for verdadeiro. Café, almoço e jantar são obrigatórios por padrão,
lanche é opcional e o usuário pode customizar. Sistema só sugere
receitas compatíveis com restrições do usuário. Se houver meta
calórica, prioriza receitas que aproximam o total diário sem
ultrapassar. Se nenhuma receita compatível existir, retorna erro
claro sem quebrar a geração. Construa o algoritmo de geração
automática de cardápio em Node.js cobrindo todas essas regras.
```

### Prompt 3 — Backend (API REST)
**Modelo:** Claude Sonnet 5 via Claude Code

```
Com base no schema e algoritmo já definidos, construa a API REST
completa em Node.js com Express e SQLite. Endpoints necessários:
CRUD de receitas em /receitas, CRUD de preferências do usuário em
/preferencias, geração automática de cardápio em POST
/cardapio/gerar, edição manual em PUT /cardapio/:dia/:categoria, e
consulta por semana e mês em GET /cardapio com query params. Inclua
validações de entrada e tratamento de erros em todos os endpoints.
```

### Prompt 4 — Testes (unitário, integração, contrato e E2E)
**Modelo:** Claude Sonnet 5 via Claude Code

```
Com base na API e algoritmo já construídos, gere os testes completos.
Unitários com Jest aplicando cobertura de sentença e decisão no
algoritmo de geração e nas funções de validação, com relatório de
cobertura configurado no CI. Integração com Jest e Supertest usando a
heurística VADER completa, cobrindo verbos HTTP, autorização, dados,
erros e responsividade, mais validação de todas as regras de negócio.
Testes de contrato na camada de API com Jest validando estrutura de
resposta, tipos de dados e campos obrigatórios por endpoint. E2E com
Playwright, focado nos cenários de maior risco e maior valor para o
produto (não no fluxo completo): geração automática de cardápio
respeitando restrições alimentares e meta calórica, não repetição de
receita em dias consecutivos, e edição manual de cardápio persistindo
corretamente.
```

### Prompt 5 — Frontend (React)
**Modelo:** Claude Sonnet 5 via Claude Code

```
Com base na API já construída, desenvolva o frontend em React com as
seguintes telas: cadastro e listagem de receitas com tags de
restrição, tela de preferências do usuário com categorias ativas,
restrições e meta calórica, grade semanal editável com botão de
gerar sugestão automática, e visão mensal consolidada do cardápio.
```

### Prompt 6 — Documentação de testes
**Modelo:** Claude Sonnet 5

```
Com base em todo o projeto construído, gere a documentação completa
de testes em formato livre e bem estruturado contendo: estratégia de
testes com objetivos, escopo, técnicas e critérios de entrada e
saída. Plano de testes com casos mapeados por técnica e regra de
negócio. Matriz de rastreabilidade ligando cada caso de teste a uma
regra de negócio. Especificação dos casos unitários com sentenças e
decisões cobertas explicitadas. Casos de integração mapeados pela
heurística VADER mais regras de negócio. Casos de contrato por
endpoint. Casos E2E por fluxo do usuário.
```

### Prompt 7 — Revisão final
**Modelo:** Claude Opus 4.8

```
Revise todo o projeto de planejador de dieta verificando consistência
entre as camadas de código e testes, se todas as regras de negócio
estão cobertas em pelo menos uma camada de teste, se a documentação
está rastreável e alinhada com o código, e se há gaps ou
inconsistências entre API, frontend e testes.
```
