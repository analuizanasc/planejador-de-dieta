# Planejador de Dieta — Plano de Refatoração: Migração para Supabase

Continuação de [planejador-dieta-plano-execucao.md](planejador-dieta-plano-execucao.md) e [planejador-dieta-plano-fase2-melhorias.md](planejador-dieta-plano-fase2-melhorias.md). Este plano documenta a migração do banco/auth atuais (SQLite local + JWT/scrypt caseiro) para Supabase (Postgres gerenciado + Supabase Auth + RLS), motivada por duas necessidades concretas: publicar o app em produção sem perder dados a cada deploy, e ganhar "esqueci minha senha" e "login com Google" sem construir isso à mão.

---

## Decisão de escopo (registrada em conversa, não neste doc originalmente)

Avaliamos dois caminhos:

- **Caminho A — só o banco:** trocar `better-sqlite3` por Postgres do Supabase, mantendo JWT/scrypt/`usuarios` como estão. Menor esforço, mas não entrega esqueci-senha nem login Google sem trabalho extra.
- **Caminho B — plataforma completa:** adotar Supabase Auth (login e-mail/senha + esqueci-senha + Google) e RLS para o isolamento por usuário, substituindo a auth caseira.

**Escolhido: Caminho B**, porque as features de login pedidas (recuperação de senha por e-mail, login com Google) são exatamente o que o Supabase Auth entrega pronto — construir isso por conta própria com Neon/SQLite seria semanas de trabalho (servidor de e-mail, fluxo OAuth manual).

---

## Resumo do que muda

| Peça | Hoje | Depois |
|---|---|---|
| Banco | SQLite (`better-sqlite3`, arquivo local, síncrono) | Postgres gerenciado pelo Supabase (via `pg`, assíncrono) |
| Identidade do usuário | `usuarios.id INTEGER AUTOINCREMENT` | `auth.users.id UUID` (gerenciado pelo Supabase Auth) |
| Autenticação | `jwt.js` (jsonwebtoken) + `senha.js` (scrypt caseiro) + tabela `usuarios` própria | Supabase Auth (e-mail/senha, recuperação de senha, OAuth Google) |
| Isolamento por usuário | `WHERE usuario_id = ?` em cada query do backend | RLS (`auth.uid() = usuario_id`) no próprio Postgres, como defesa em profundidade |
| Frontend de login | `api/auth.js` chamando `/auth/registrar` e `/auth/login` próprios | `supabase-js` (`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `signInWithOAuth`) |
| Transações | `db.transaction()` síncrono (better-sqlite3) | `BEGIN`/`COMMIT` manual com client dedicado, ou funções Postgres |

**O que NÃO muda:** a forma dos dados (nomes de tabelas, colunas de domínio como `receitas`, `cardapio`, `cadernos`, `preferencia_usuario`), as regras de negócio do gerador de cardápio, a estrutura de rotas Express, os testes de unidade que não tocam banco/auth (`geradorCardapio`, extratores, validators de payload).

---

## Ordem recomendada: A antes de B, em duas fases dentro deste plano

Mesmo tendo escolhido o Caminho B como destino, a implementação é dividida em duas fases sequenciais — não simultâneas — para isolar risco:

- **Fase 1:** sair do SQLite para o Postgres do Supabase, mantendo a auth caseira funcionando exatamente como está. Ponto de checagem: toda a suíte atual (unit + integration + contract + e2e) passa, só que apontando para Postgres.
- **Fase 2:** substituir a auth caseira pelo Supabase Auth (e-mail/senha, esqueci-senha, Google) e ligar RLS.

Se a Fase 2 atrasar ou você decidir não fazer o Google/RLS agora, a Fase 1 sozinha já é um estado de produção válido (é o próprio Caminho A). Isso dá um ponto de parada seguro no meio do plano.

---

## Fase 1 — Migrar o banco para Postgres (Supabase), auth intacta

### 1.1 Provisionar o projeto Supabase

- Criar projeto no [supabase.com](https://supabase.com/dashboard) (plano gratuito).
- Guardar a **connection string** do Postgres (Session Pooler para uso geral; Transaction Pooler se for rodar em serverless/edge — não é o caso aqui, backend é um processo Node persistente).
- **[DECISÃO]** Usar a CLI do Supabase localmente para desenvolvimento (`supabase init`, `supabase start`) em vez de desenvolver direto contra o projeto na nuvem — permite iterar em schema sem afetar dados reais e sem gastar cota. Confirmar antes de seguir se você prefere isso ou desenvolver direto contra o projeto remoto.

### 1.2 Trocar dependências

Em `backend/package.json`:
- Remover `better-sqlite3`.
- Adicionar `pg` (driver Postgres para Node).
- Manter `jsonwebtoken`, `dotenv`, `express`, `@google/genai` como estão (auth não muda nesta fase).

### 1.3 Portar `backend/db/schema.sql` para Postgres

Aplicando as regras do skill `supabase-postgres-best-practices` (categorias `schema-*`):

| SQLite (atual) | Postgres (novo) | Referência da skill |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `bigint generated always as identity primary key` | `schema-primary-keys.md` |
| `TEXT NOT NULL DEFAULT (datetime('now'))` | `timestamptz not null default now()` | `schema-data-types.md` |
| `permite_repeticao INTEGER CHECK (IN (0,1))` | `boolean not null default false` | `schema-data-types.md` |
| `categorias.codigo CHECK (codigo IN (...))` | manter `CHECK` **ou** migrar para `CREATE TYPE categoria_codigo AS ENUM (...)` | `schema-constraints.md` |
| `restricoes.codigo CHECK (...)` | idem — `CHECK` ou enum nativo | `schema-constraints.md` |
| Nomes de tabela/coluna já em `snake_case` minúsculo | sem mudança necessária | `schema-lowercase-identifiers.md` (já conforme) |
| `REFERENCES` sem índice explícito em algumas FKs | garantir índice em toda FK usada em JOIN/filtro (a maioria já tem `idx_*`, revisar `receita_categorias`, `receita_restricoes`, `preferencia_categorias_ativas`, `preferencia_restricoes` — hoje só têm PK composta, sem índice na segunda coluna do lado "muitos") | `schema-foreign-key-indexes.md` |
| `usuario_id INTEGER REFERENCES usuarios(id)` | **fica pendente até a Fase 2** — nesta fase, `usuarios.id` continua sendo o autoincrement próprio; a troca para UUID de `auth.users` só acontece quando a auth for trocada | — |

**[DECISÃO]** Manter a tabela `usuarios` própria nesta fase (ela já existe e a auth caseira depende dela) — não criar dependência de `auth.users` ainda. Rodar `supabase db advisors` (ou MCP `get_advisors`) depois de aplicar o schema, para pegar índices faltando ou problemas de tipo antes de seguir.

### 1.4 Reescrever `backend/src/db/connection.js`

- Trocar `new Database(caminho)` (better-sqlite3, síncrono) por um `Pool` do `pg` apontando para a connection string do Supabase (via `DATABASE_URL` no `.env`).
- `criarConexao()` deixa de ser síncrona — vira `async function criarConexao()`, propagando `await` para `server.js`.
- A lógica de "aplicar schema só se não existir" (`schemaJaAplicado`) sai daqui: schema em Postgres/Supabase passa a ser gerenciado por **migrations versionadas** (`supabase/migrations/`), não por um `db.exec(schema)` ad-hoc no boot. Isso é uma melhoria de robustez que o próprio ecossistema Supabase espera (`supabase migration new`, `supabase db push`).

### 1.5 Reescrever os 5 repositories (mecânico, mas toca tudo)

Todos ganham `async`/`await` e trocam `db.prepare(sql).get/all/run(...)` por `pool.query(sql, params)` (sintaxe `$1, $2` em vez de `?`):

- [`usuariosRepository.js`](backend/src/repositories/usuariosRepository.js) — `criarUsuario` usa `db.transaction()` síncrono → vira `BEGIN`/`INSERT`/`INSERT`.../`COMMIT` com um client obtido de `pool.connect()`.
- [`receitasRepository.js`](backend/src/repositories/receitasRepository.js) — `criarReceita`/`atualizarReceita` têm a mesma transação com múltiplos inserts (categorias, ingredientes, restrições) → mesmo padrão de client dedicado.
- [`cadernosRepository.js`](backend/src/repositories/cadernosRepository.js) — sem transação, troca direta.
- [`cardapioRepository.js`](backend/src/repositories/cardapioRepository.js) — `persistirCardapio` usa transação + `ON CONFLICT ... DO UPDATE` (upsert), que **existe em Postgres com a mesma sintaxe** — baixo risco aqui.
- [`preferenciasRepository.js`](backend/src/repositories/preferenciasRepository.js) — mesma transação com múltiplos deletes/inserts.

**Padrão sugerido** para não duplicar a lógica de transação 4 vezes: criar um helper `withTransaction(pool, fn)` em `backend/src/db/` que abre client, `BEGIN`, executa `fn(client)`, `COMMIT`/`ROLLBACK` no catch, `release()` no finally.

### 1.6 Rotas e middlewares

- **Nenhuma rota muda de assinatura.** Todas já usam `asyncHandler` ([app.js](backend/src/app.js)), então repositories virando `async` é transparente para quem chama.
- `db` deixa de ser a instância do better-sqlite3 e passa a ser o `Pool` do `pg` — os `criarApp(db)` e `criarRotasX(db)` continuam recebendo "o banco" como parâmetro, só muda o que esse objeto é por dentro.

### 1.7 Testes — o maior ponto de atenção da Fase 1

Hoje a suíte de integração roda contra SQLite `:memory:` ([connection.js:11](backend/src/db/connection.js)), o que dá isolamento grátis e testes rápidos. Postgres não tem `:memory:` — opções, em ordem de preferência:

1. **Supabase CLI local** (`supabase start`) — sobe um Postgres via Docker localmente; os testes de integração apontam para ele. Mais fiel ao ambiente real, mas exige Docker rodando no CI.
2. **Postgres efêmero em container só para teste** (ex.: `pg-mem` para unit, container real para integração) — mais rápido de configurar no CI, mas outra peça de infra.

**[DECISÃO A CONFIRMAR]** Recomendo a opção 1 (Supabase CLI local) por já estar alinhada com o restante do fluxo de desenvolvimento (migrations, `supabase db diff`), mas isso significa que os testes de integração deixam de ser "instantâneos" e passam a depender de um Postgres de fato subir antes — vale confirmar que a máquina/CI aguenta isso.

Cada arquivo de teste de integração precisa de uma estratégia de limpeza entre testes (hoje, recriar o banco em memória a cada teste é trivial; em Postgres real, será `TRUNCATE ... CASCADE` ou transação com rollback por teste). Arquivos afetados:

- `backend/tests/integration/*.test.js` (todos os 7 arquivos)
- `backend/tests/integration/helpers/receitaBuilder.js` e qualquer helper de setup de usuário/banco
- `backend/tests/contract/contrato.test.js`
- `backend/tests/unit/geradorCardapio.test.js` e `validators.test.js` — **não tocam banco diretamente**, devem continuar passando sem alteração (confirmar isso é parte do ponto de checagem).

E2E (`e2e/tests/*.spec.js`) sobe o backend real via `playwright.config.js` — apontar para o Postgres de teste também, sem mudança nos specs em si (eles já falam com a API, não com o banco).

### Ponto de checagem da Fase 1

`npm test` (unit + integration + contract) e a suíte E2E completa passam com o backend apontando para Postgres. Auth continua sendo `/auth/registrar` e `/auth/login` como hoje — nenhuma tela de login muda.

---

## Fase 2 — Substituir a auth caseira por Supabase Auth (e-mail/senha, esqueci-senha, Google) + RLS

### 2.1 Configurar Supabase Auth no painel

- Habilitar provider **Email** (já vem habilitado por padrão) com confirmação por e-mail conforme desejado.
- Habilitar provider **Google**: criar credenciais OAuth no Google Cloud Console (Client ID/Secret), configurar a URL de callback do Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`), colar as credenciais no painel do Supabase (Authentication → Providers → Google).
- Configurar o template de e-mail de "recuperar senha" (Authentication → Email Templates) — o Supabase já provê o servidor de e-mail no plano grátis, com limite de envios/hora.
- Definir a **Site URL** e **Redirect URLs** (necessário para o fluxo de reset de senha e OAuth funcionarem apontando de volta para o seu frontend, tanto em dev quanto no domínio de produção).

### 2.2 Migrar a tabela `usuarios` para `auth.users`

Este é o ponto de maior impacto estrutural:

- `auth.users` passa a ser a fonte de verdade de identidade (gerenciada pelo Supabase, `id` é `uuid`).
- Dados extras que hoje ficam em `usuarios` (`nome`) precisam de uma tabela de perfil própria, ex. `public.profiles (id uuid primary key references auth.users(id) on delete cascade, nome text not null)`, populada via trigger `on auth.users insert` (`SECURITY INVOKER`, seguindo a diretriz da skill de nunca usar `SECURITY DEFINER` para contornar permissão sem necessidade real).
- **Todas as FKs `usuario_id INTEGER REFERENCES usuarios(id)`** em `receitas`, `cadernos`, `cardapio`, `preferencia_usuario` mudam para `usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE`. Isso é uma migration de schema real, não só uma troca de tipo trivial — dados existentes precisam de um mapeamento INTEGER→UUID se você quiser preservar receitas/cardápios já cadastrados (ou aceitar começar zerado, dado que hoje é ambiente de desenvolvimento/portfólio).

**[DECISÃO A CONFIRMAR]** Como este projeto está em fase de desenvolvimento/portfólio (sem usuários reais em produção ainda), recomendo **não migrar dados existentes** e simplesmente recriar o schema com `usuario_id uuid` desde o início — é bem mais simples que escrever um script de remapeamento de IDs. Confirmar se há dados locais que você quer preservar.

### 2.3 Backend: trocar middleware de auth

- [`backend/src/middlewares/auth.js`](backend/src/middlewares/auth.js) deixa de chamar `verificarToken` (jsonwebtoken próprio) e passa a validar o JWT emitido pelo Supabase Auth — via `supabase-js` (`supabase.auth.getUser(token)`) ou verificando o JWT com o segredo/JWKS do projeto Supabase.
- `req.usuarioId` passa a vir do `sub` do token do Supabase (uuid), não mais de um payload próprio.
- **Remover**: `backend/src/utils/jwt.js`, `backend/src/utils/senha.js`, `backend/src/repositories/usuariosRepository.js` (substituído pela tabela `profiles` + `auth.users`), as rotas `/auth/registrar` e `/auth/login` em [`backend/src/routes/auth.js`](backend/src/routes/auth.js) (o registro/login passam a ser chamados direto do frontend via `supabase-js`, o backend não precisa mais emitir token).
- `validarRegistroPayload`/`validarLoginPayload` em [`validators.js`](backend/src/utils/validators.js:271-315) somem junto — essa validação passa a ser responsabilidade do Supabase Auth no cliente.

### 2.4 Aplicar RLS em cada tabela escopada por usuário

Seguindo a política padrão da skill (`TO authenticated` + `USING`/`WITH CHECK` com `auth.uid()`, nunca `SECURITY DEFINER` para contornar isso):

```sql
alter table receitas enable row level security;

create policy "usuário vê as próprias receitas"
on receitas for select
to authenticated
using ( (select auth.uid()) = usuario_id );

create policy "usuário cria receitas para si"
on receitas for insert
to authenticated
with check ( (select auth.uid()) = usuario_id );

create policy "usuário atualiza as próprias receitas"
on receitas for update
to authenticated
using ( (select auth.uid()) = usuario_id )
with check ( (select auth.uid()) = usuario_id );

create policy "usuário deleta as próprias receitas"
on receitas for delete
to authenticated
using ( (select auth.uid()) = usuario_id );
```

Repetir o mesmo padrão de 4 políticas (select/insert/update/delete) para: `cadernos`, `cardapio`, `preferencia_usuario`. Para as tabelas filhas sem `usuario_id` direto (`receita_ingredientes`, `receita_restricoes`, `receita_categorias`, `preferencia_categorias_ativas`, `preferencia_restricoes`), a política precisa checar a posse via `EXISTS` na tabela pai (ex.: `receita_id in (select id from receitas where usuario_id = auth.uid())`).

Tabelas de domínio globais (`categorias`, `restricoes`) não são escopadas por usuário — RLS nelas, se ligado, seria só `select` liberado a todos os autenticados, sem `usuario_id`.

**Importante (regra da skill):** com RLS correto, o `WHERE usuario_id = ?` que hoje existe em todos os repositories **pode ser removido** do código, mas o plano recomenda **mantê-lo por enquanto** como defesa em profundidade — o backend continua sendo quem executa as queries (não é o frontend falando direto com o Postgres via Data API), então o RLS aqui é uma camada extra, não a única.

### 2.5 Frontend: trocar a camada de auth

- Adicionar `@supabase/supabase-js` ao `frontend/package.json`.
- [`frontend/src/api/auth.js`](frontend/src/api/auth.js) — `registrar`/`login` deixam de chamar `/auth/registrar`/`/auth/login` do seu backend e passam a chamar `supabase.auth.signUp(...)` / `supabase.auth.signInWithPassword(...)` diretamente.
- Novas funções: `esqueciSenha(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo })`; `entrarComGoogle()` → `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- [`frontend/src/context/AuthContext.jsx`](frontend/src/context/AuthContext.jsx) — troca o gerenciamento manual de token/localStorage (`CHAVE_USUARIO`, `definirToken`) por `supabase.auth.onAuthStateChange(...)` e `supabase.auth.getSession()`, que já cuidam de persistência e refresh de sessão.
- [`frontend/src/api/client.js`](frontend/src/api/client.js) — o `Authorization: Bearer <token>` enviado ao seu backend passa a usar `session.access_token` do Supabase em vez do token próprio; a lógica de "expirou, desloga" (`aoExpirarSessao`) se adapta ao evento `SIGNED_OUT` do Supabase.
- [`frontend/src/pages/Login.jsx`](frontend/src/pages/Login.jsx) — adicionar link "Esqueci minha senha" e botão "Entrar com Google"; criar página nova `EsqueciSenha.jsx` (formulário de e-mail) e `RedefinirSenha.jsx` (nova senha, acessada via link do e-mail).
- Provavelmente precisa de uma página `AuthCallback.jsx` para tratar o redirect do OAuth do Google.

### 2.6 Testes afetados nesta fase (reescrita real, não só ajuste)

- `backend/tests/integration/auth.test.js` e `autorizacao.test.js` — reescritos para o novo modelo de identidade (não dá mais para simplesmente chamar `/auth/registrar` do próprio backend; setup de usuário de teste passa a usar a API admin do Supabase Auth ou mocks do `supabase-js`).
- Todo helper de teste que cria "um usuário" para popular fixtures (builders de integração, `e2e/tests/helpers/api.js::criarUsuariaAutenticada`) muda a forma de obter o token.
- `e2e/tests/helpers/auth.js` (`entrarComSessao`) injeta token/usuário direto no `localStorage` sob as chaves atuais (`planejador-dieta:token`, `planejador-dieta:usuario`) — essas chaves deixam de existir; passa a injetar a sessão no formato que o `supabase-js` espera (ou, mais simples, logar de fato via `supabase.auth.signInWithPassword` no setup do teste).
- `backend/tests/unit/validators.test.js` perde os casos de `validarRegistroPayload`/`validarLoginPayload` (função removida).

### Ponto de checagem da Fase 2

Cadastro, login, "esqueci minha senha" (e-mail chega e o link funciona) e "entrar com Google" funcionam ponta a ponta na UI. RLS ativo em todas as tabelas de usuário, verificado com `supabase db advisors` sem alertas de segurança pendentes. Suíte de testes reescrita passa.

---

## Riscos e pontos em aberto

1. **Plano gratuito do Supabase pausa projetos inativos** (~1 semana sem uso). Para um app de portfólio isso significa que a primeira visita após um tempo parado demora a "acordar" — aceitável para portfólio, mencionar se for para uso real contínuo.
2. **Limite de envio de e-mail do Auth no plano grátis** — se o volume de cadastros/resets crescer, pode ser necessário configurar um provedor de e-mail (SMTP) próprio no painel.
3. **Migração de dados existentes (Fase 2, item 2.2)** — decisão pendente de confirmação: recriar zerado vs. remapear IDs.
4. **Infra de testes de integração (Fase 1, item 1.7)** — decisão pendente de confirmação: Supabase CLI local (Docker) vs. outra estratégia de Postgres efêmero.
5. **Uso do MCP Server do Supabase** — a skill recomenda usá-lo para `search_docs`, `execute_sql` iterativo e `get_advisors`; requer autenticação OAuth do lado do Claude Code na hora da implementação (fora do escopo deste plano, é um passo de setup quando a implementação começar).

---

## Ordem de execução sugerida (checklist)

- [ ] Fase 1.1 — Provisionar projeto Supabase + decidir dev local (CLI) vs. remoto
- [ ] Fase 1.2 — Trocar `better-sqlite3` por `pg`
- [ ] Fase 1.3 — Portar `schema.sql` para Postgres, rodar advisors
- [ ] Fase 1.4 — Reescrever `connection.js` (Pool async)
- [ ] Fase 1.5 — Reescrever os 5 repositories + helper `withTransaction`
- [ ] Fase 1.6 — Confirmar rotas/middlewares sem mudança de assinatura
- [ ] Fase 1.7 — Adaptar infraestrutura de testes (integration/contract/e2e) para Postgres
- [ ] **Checkpoint Fase 1** — suíte completa verde, app funcional em Postgres com auth antiga
- [ ] Fase 2.1 — Configurar Auth (Email + Google) no painel Supabase
- [ ] Fase 2.2 — Migrar `usuarios` → `auth.users` + `profiles`, atualizar FKs para `uuid`
- [ ] Fase 2.3 — Trocar middleware de auth do backend, remover `jwt.js`/`senha.js`/rotas antigas
- [ ] Fase 2.4 — Aplicar políticas RLS em todas as tabelas escopadas por usuário
- [ ] Fase 2.5 — Trocar camada de auth do frontend (`supabase-js`), telas de esqueci-senha/Google
- [ ] Fase 2.6 — Reescrever testes de auth/autorização e helpers de sessão
- [ ] **Checkpoint Fase 2** — cadastro, login, esqueci-senha e login Google funcionando ponta a ponta; RLS sem alertas nos advisors
