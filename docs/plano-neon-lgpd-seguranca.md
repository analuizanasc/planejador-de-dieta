# Plano de ação — Neon + TypeScript + LGPD + Segurança

**Objetivo:** levar o backend de `SQLite + JavaScript` para `Postgres (Neon) + TypeScript + Drizzle ORM`, adequado à LGPD e com segurança de produção.

**Estado atual (verificado):**
- Banco: SQLite (`better-sqlite3`), acesso **síncrono**.
- Linguagem: JavaScript (CommonJS, `'use strict'`).
- Auth: scrypt + salt + `timingSafeEqual` ✅ / JWT 7d sem refresh ❌.
- Segredos: `.env` no `.gitignore` ✅.
- Hardening HTTP: **ausente** (sem helmet/CORS/rate-limit).
- Testes: Jest + Supertest, SQLite `:memory:`.

**Dados sensíveis (LGPD art. 11):** `preferencia_restricoes` / `receita_restricoes` (glúten, lactose) podem indicar saúde.

**Residência de dados no Brasil NÃO é requisito da LGPD.** A lei permite transferência internacional com salvaguardas + transparência. Logo, **Neon está liberado**; região BR é conforto, não obrigação. O gate da Fase 2 foi removido.

---

## Como usar este documento

Cada fase traz:
1. **Modelo** — qual Claude setar com `/model` **antes** de enviar o prompt.
2. **Prompt para a IA** — copie e cole no Claude Code para executar a fase.
3. **Esforço humano** vs **Esforço com IA** (você dirigindo + revisando).

**Regra dos modelos:** Opus decide e desenha (arquitetura, segurança, LGPD); Sonnet replica o padrão já definido; Haiku só o trivial.

**Sobre o prazo:** a coluna "humano" é quanto levaria uma pessoa codando à mão. A coluna "com IA" é o tempo que **você** gasta dirigindo a IA e revisando/testando — a IA escreve o código, mas você ainda cria contas, decide, testa e redige texto legal. Por isso semanas viram dias.

---

## Fase 0 — Rede de segurança e planejamento

**Por quê:** nunca refatorar sem os testes verdes e um ponto de retorno.

**Modelo:** Haiku

**Prompt para a IA:**
> Estou começando uma migração grande do backend (SQLite→Postgres, JS→TypeScript). Antes de tudo: rode a suíte de testes do backend e confirme que está toda verde; e crie e mude para a branch `feat/neon-typescript`. Não preciso de backup dos dados atuais. Não altere código de aplicação ainda, só prepare o terreno e me reporte o estado.

**Esforço:** humano 1–2h · **com IA ~15 min**

---

## Fase 1 — Fundação TypeScript (incremental)

**Por quê:** converter pra TS **antes** de reescrever os repos evita fazer o trabalho duas vezes. O Drizzle só entrega tipos de verdade em TS.

**Modelo:** **Opus** (define o pipeline que afeta tudo)

**Prompt para a IA:**
> Configure TypeScript no backend de forma incremental, sem quebrar os `.js` existentes. Instale `typescript`, `@types/node`, `@types/express`, `tsx` e `ts-jest` como devDependencies. Crie um `tsconfig.json` com `allowJs: true`, `strict: true` e `esModuleInterop: true`, para `.js` e `.ts` coexistirem. Adicione scripts de build (`tsc`) e dev (`tsx watch src/server`). Ajuste o Jest para rodar testes em TS. Como prova de que o pipeline funciona, converta só `src/utils/jwt.js` para `.ts` e rode os testes. Explique cada escolha do tsconfig.

**Esforço:** humano meio dia · **com IA 1–2h**

---

## Fase 2 — Provisionar Neon + Drizzle + schema

**Por quê:** ter o banco e o schema traduzido antes de mexer no código de acesso.

**Modelo:** **Opus** (schema é a fundação; erro aqui contamina tudo)

**Antes do prompt (você faz):** criar conta no Neon, criar um projeto, copiar a `DATABASE_URL` e colocar no `backend/.env`.

**Prompt para a IA:**
> Vou usar Neon (Postgres) com Drizzle ORM. Já pus a `DATABASE_URL` no `backend/.env`. Instale `drizzle-orm`, `pg`, `drizzle-kit` e `@types/pg`. Traduza o schema de `backend/db/schema.sql` para um schema Drizzle em TypeScript, mantendo TODAS as tabelas, foreign keys, `ON DELETE CASCADE`, `UNIQUE` e índices. Aplique estas conversões: `INTEGER PRIMARY KEY AUTOINCREMENT` → identity; o inteiro 0/1 `permite_repeticao` → `boolean`; `datetime('now')` → timestamp com `defaultNow()`. Configure o `drizzle.config`, gere a primeira migração com drizzle-kit e me mostre o SQL gerado para eu revisar ANTES de aplicar no Neon. Ainda não mexa nos repositories.

**Esforço:** humano 1 dia · **com IA 2–3h** (maior parte é você criando a conta e revisando o schema)

---

## Fase 3 — Reescrever os repositories (SQLite → Drizzle, síncrono → async)

**Por quê:** núcleo da migração e maior fatia de trabalho (40 acessos ao banco em 5 repos).

**Modelo:** **Opus** no 1º repo (define o padrão) → **Sonnet** nos outros 4

**Prompt para a IA (1º repo — com Opus):**
> Reescreva `src/db/connection.js` para `connection.ts` usando `pg.Pool` + Drizzle (lendo `DATABASE_URL`), e remova a lógica de migração caseira antiga (era gambiarra de SQLite; agora as migrações são do drizzle-kit). Depois converta `src/repositories/usuariosRepository.js` para `.ts`, tornando todas as funções `async` e usando Drizzle. Atenção à transação de `criarUsuario` (vira `db.transaction(async (tx) => …)`) e ao `lastInsertRowid` (vira `.returning()`). Esse arquivo será o PADRÃO para os outros repos — deixe-o exemplar e comente as decisões. Não converta os outros repos ainda.

**Prompt para a IA (repos restantes — troque para Sonnet):**
> Seguindo exatamente o padrão já aplicado em `usuariosRepository.ts` (Drizzle, funções async, `.returning()`, `INSERT OR IGNORE` → `.onConflictDoNothing()`, transações async), converta os repositories restantes para `.ts`: `cadernosRepository`, `preferenciasRepository`, `cardapioRepository` e `receitasRepository`. Mantenha as mesmas assinaturas de função sempre que possível.

**Esforço:** humano 1–1,5 dia · **com IA 2–3h**

---

## Fase 4 — Propagar `async` por serviços e rotas

**Por quê:** tornar os repos assíncronos quebra tudo que os chamava de forma síncrona.

**Modelo:** **Sonnet** (mecânico) → Opus só se surgir lógica de transação delicada

**Prompt para a IA:**
> Os repositories agora são assíncronos. Percorra os serviços e rotas que chamam repositories e adicione `await` onde faltar (ex: `geradorCardapio`). Confirme que as rotas continuam usando `asyncHandler` e propagando erros. Converta para `.ts` os serviços e rotas que você tocar. No final, rode `tsc --noEmit` e corrija todos os erros de tipo que aparecerem. Me mostre a lista de arquivos alterados.

**Esforço:** humano meio–1 dia · **com IA 1–2h**

---

## Fase 5 — Migrar a suíte de testes

**Por quê:** os testes usam SQLite `:memory:` (síncrono, instantâneo). Isso morre com Postgres.

**Modelo:** **Opus** (estratégia de teste é decisão) → **Sonnet** para ajustar os arquivos

**Prompt para a IA (estratégia — com Opus):**
> Preciso migrar a suíte (Jest + Supertest) de SQLite `:memory:` para Postgres. Compare duas estratégias para o banco de teste: (a) branch efêmera do Neon por rodada de CI, (b) Testcontainers/Docker Postgres local. Recomende uma para um projeto solo, justifique, e proponha como rodar as migrações Drizzle antes da suíte e limpar o estado entre testes. Ainda não altere os arquivos — só a estratégia.

**Prompt para a IA (implementação — troque para Sonnet):**
> Implemente a estratégia de banco de teste que definimos. Ajuste os helpers (`receitaBuilder`, setup/teardown) para async + Postgres, rode as migrações antes da suíte e garanta isolamento entre testes. Rode tudo e me mostre a suíte verde.

**Esforço:** humano 1 dia · **com IA 2–3h**

---

## Fase 6 — Blindagem de segurança

**Por quê:** furos abertos hoje (força-bruta, headers, sem CORS). Baixo esforço, alto impacto.

**Modelo:** **Opus** (auth/refresh token é crítico) → Sonnet para o básico

**Prompt para a IA:**
> Aplique hardening de segurança no `app.ts`: adicione `helmet`; CORS restrito à origem do frontend (via variável de ambiente); `express-rate-limit` nas rotas `/auth/login` e `/auth/registrar`; e limite de body `express.json({ limit: '1mb' })`. Depois, implemente **refresh token**: encurte o access token (ex: 15 min) e adicione um refresh token de vida longa com rota de renovação e de logout/revogação — hoje o JWT é 7d fixo sem revogação. Revise o `errorHandler` para nunca vazar PII (email/senha/restrições) em log ou stack trace. Explique o fluxo de refresh que você implementou.

**Esforço:** humano 1 dia · **com IA 1–2h**

---

## Fase 7 — Adequação à LGPD

**Por quê:** obrigação legal; app guarda dado pessoal e sensível (saúde).

**Modelo:** **Opus** (conformidade e texto legal) → Sonnet para implementar as rotas

**Prompt para a IA:**
> Adeque o app à LGPD. Implemente: (1) rota `DELETE /conta` que apaga o usuário logado — confirme que o `ON DELETE CASCADE` limpa receitas, cadernos, preferências e cardápio; (2) rota `GET /meus-dados` que devolve todos os dados do usuário em JSON (portabilidade); (3) suporte a **consentimento destacado** no cadastro para as restrições alimentares (dado sensível de saúde) — a API deve receber e persistir um registro de consentimento com data e versão do termo, separado do aceite geral. Depois, redija um rascunho de **Política de Privacidade** em português dizendo quais dados são coletados, para quê, e citando **Gemini/Google** e **Apify** como terceiros com transferência internacional de dados. Marque com TODO tudo que exigir decisão minha (ex: e-mail de contato do titular).

**Esforço:** humano 1–2 dias · **com IA 2–4h** (a política precisa da sua revisão)

---

## Fase 8 — Deploy e cutover

**Por quê:** colocar em produção com HTTPS e segredos corretos.

**Modelo:** **Sonnet** (execução) → Opus se der problema de SSL/config

**Antes do prompt (você faz):** criar projeto de produção no Neon, conta no host (Render/Fly), conta no Vercel/Cloudflare para o frontend.

**Prompt para a IA:**
> Vou publicar. Já tenho um banco de produção separado no Neon e conta no host [Render/Fly]. Gere os arquivos de configuração de deploy do backend, garantindo HTTPS forçado (redirect http→https) e leitura das variáveis de ambiente do host (nunca commitadas). Me dê o passo a passo para rodar as migrações Drizzle em produção e para configurar o frontend no [Vercel/Cloudflare] apontando para a API. Por fim, escreva um script único para migrar os dados do SQLite antigo para o Postgres de produção.

**Esforço:** humano meio–1 dia · **com IA 2–3h** (você cria as contas e clica em deploy)

---

## Fase 9 — Verificação final

**Por quê:** confirmar que segurança e LGPD estão de pé antes de considerar pronto.

**Modelo:** **Opus** (revisão crítica)

**Prompt para a IA:**
> Rode a verificação final: suíte de testes verde contra Postgres e `tsc --noEmit` sem erros. Depois rode `/security-review` nas mudanças da branch. Por fim, me dê um roteiro de teste manual cobrindo: cadastro com consentimento → login → renovação de token → apagar conta → exportar dados, e o que devo observar nos logs de produção para garantir que não há PII vazando.

**Esforço:** humano meio dia · **com IA 1–2h**

---

## Resumo de esforço

| Fase | Modelo | Humano | Com IA |
|---|---|---|---|
| 0 · Rede de segurança | Haiku | 1–2h | ~15 min |
| 1 · TypeScript | Opus | meio dia | 1–2h |
| 2 · Neon + schema | Opus | 1 dia | 2–3h |
| 3 · Repositories | Opus → Sonnet | 1–1,5 dia | 2–3h |
| 4 · Async ripple | Sonnet | meio–1 dia | 1–2h |
| 5 · Testes | Opus → Sonnet | 1 dia | 2–3h |
| 6 · Segurança | Opus | 1 dia | 1–2h |
| 7 · LGPD | Opus | 1–2 dias | 2–4h |
| 8 · Deploy | Sonnet | meio–1 dia | 2–3h |
| 9 · Verificação | Opus | meio dia | 1–2h |

**Total humano solo:** ~2 a 3 semanas em ritmo parcial.
**Total com IA (você dirigindo):** **~2 a 4 dias** de trabalho focado.

O gargalo com IA deixa de ser o código e passa a ser o que só você faz: criar contas (Neon, host), decidir, testar e revisar o texto da Política de Privacidade.
