# Planejador de Dieta

Aplicação de organização de dieta por semana/mês a partir de uma base de receitas, com **geração híbrida de cardápio**: o sistema sugere automaticamente respeitando as regras do usuário, e o usuário pode editar manualmente cada refeição.

**Stack:** Node.js + Express + SQLite (`better-sqlite3`) no backend · React + Vite no frontend · JWT para autenticação.

---

## Modelo de dados

Schema completo em [`backend/db/schema.sql`](backend/db/schema.sql). Entidades principais:

| Entidade | Descrição |
|---|---|
| **Usuário** | `email` (único), `senha_hash`, `nome`. Dono de todas as demais entidades. |
| **Receita** | `nome`, `categoria`, `calorias`, `permite_repeticao`; arrays de **ingredientes** e **tags de restrição** normalizados em tabelas filhas. |
| **Preferência do usuário** | `meta_calorica` (opcional) + `categorias_ativas` e `restricoes` (N:N). Uma linha por usuário. |
| **Cardápio** | `dia`, `categoria`, `receita_id`, `origem` (`gerado`/`manual`). Único por `(usuário, dia, categoria)`. |

Categorias e restrições são **enums normalizados** em tabelas próprias, com integridade referencial garantida por chaves estrangeiras.

---

## API

Base autenticada via JWT (header `Authorization: Bearer <token>`), exceto `/auth` e `/health`.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/registrar` | Cria usuário |
| `POST` | `/auth/login` | Autentica e retorna token JWT |
| `GET/POST` | `/receitas` · `/receitas/:id` | CRUD de receitas |
| `PUT/DELETE` | `/receitas/:id` | Atualiza / remove receita |
| `GET/PUT` | `/preferencias` | Consulta / atualiza preferências |
| `POST` | `/cardapio/gerar` | Geração automática (`dias[]` ou `data_inicio` + `quantidade_dias`) |
| `PUT` | `/cardapio/:dia/:categoria` | Edição manual de uma refeição |
| `GET` | `/cardapio?semana=YYYY-MM-DD` \| `?mes=YYYY-MM` | Consulta por semana ou mês |
| `GET` | `/health` | Healthcheck |

---

## Como rodar

**Backend** (porta padrão via `.env`):
```bash
cd backend
npm install
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Copie os arquivos `.env.example` para `.env` em cada pasta antes de subir. Versões de Node fixadas em `.nvmrc`.

---

## Testes

O projeto tem cobertura em quatro camadas — **unitário (Jest)**, **integração (Jest + Supertest, heurística VADER)**, **contrato** e **E2E (Playwright)**.

> 📖 **Os detalhes de testes** — estratégia, plano de casos por técnica e regra de negócio, matriz de rastreabilidade, casos por camada e configuração de cobertura no CI — **estão na [Wiki do projeto](../../wiki)**.

Execução rápida:
```bash
cd backend && npm test          # unit + integração + contrato
cd backend && npm run test:coverage
cd e2e && npx playwright test    # E2E
```

---

## Estrutura do repositório

```
backend/    API Express + SQLite (regras de negócio, rotas, repositórios)
frontend/   SPA React + Vite
e2e/        Testes end-to-end Playwright
docs/       Documentação de testes e sessões de teste exploratório
```

### Backend (`backend/`)

API REST em camadas: as **rotas** validam entrada e orquestram, os **repositórios** isolam o acesso ao SQLite e o **serviço** concentra a regra de negócio pura.

```
backend/
├── db/
│   └── schema.sql              # Schema completo (usuários, receitas, preferências, cardápio)
├── src/
│   ├── server.js               # Bootstrap: cria conexão + sobe o servidor
│   ├── app.js                  # Monta o Express, middlewares e as rotas
│   ├── db/
│   │   └── connection.js       # Conexão SQLite e aplicação do schema
│   ├── routes/                 # Endpoints HTTP (validação + orquestração)
│   │   ├── auth.js             #   /auth (registrar, login)
│   │   ├── receitas.js         #   /receitas (CRUD)
│   │   ├── preferencias.js     #   /preferencias (get/put)
│   │   └── cardapio.js         #   /cardapio (gerar, editar, consultar)
│   ├── repositories/           # Acesso a dados, um por entidade
│   │   ├── usuariosRepository.js
│   │   ├── receitasRepository.js
│   │   ├── preferenciasRepository.js
│   │   └── cardapioRepository.js
│   ├── services/
│   │   └── geradorCardapio.js  # Gerador automático de cardápio (módulo puro, sem I/O)
│   ├── middlewares/
│   │   ├── auth.js             # Verificação do JWT
│   │   └── errorHandler.js     # Tratamento centralizado de erros
│   └── utils/                  # AppError, asyncHandler, jwt, senha, datas, validators
├── jest.config.js
└── package.json
```

### Frontend (`frontend/`)

SPA React (Vite) organizada por responsabilidade: **api** (chamadas HTTP), **hooks** (estado/data-fetching), **components** (primitivos de UI) e **pages** (telas), com autenticação via contexto e rotas protegidas.

```
frontend/
├── index.html
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx                # Entry point
    ├── App.jsx                 # Definição das rotas
    ├── api/                    # Cliente HTTP + módulos por recurso
    │   ├── client.js           #   fetch base (token, erros)
    │   └── auth.js · receitas.js · preferencias.js · cardapio.js
    ├── context/
    │   └── AuthContext.jsx     # Sessão do usuário (token + login/logout)
    ├── hooks/                  # useReceitas, usePreferencias, useCardapio, useGerarCardapio
    ├── routes/
    │   ├── AppLayout.jsx       # Layout autenticado
    │   └── RequireAuth.jsx     # Guarda de rota protegida
    ├── pages/                  # Login, Registro, Receitas, Preferencias,
    │                           # CardapioSemana, CardapioMes, AuthLayout
    ├── components/             # Botao, Campo, Select, ReceitaCard, ReceitaForm,
    │                           # CelulaCardapio, MedidorMeta, Nav, Alerta, selos… (+ CSS Modules)
    ├── styles/                 # tokens.css, global.css, categorias.js
    └── utils/
        └── datas.js
```

### Testes (`backend/tests/` e `e2e/`)

Pirâmide de testes em quatro camadas. Unitário, integração e contrato ficam no backend (Jest); o E2E é um projeto Playwright separado.

```
backend/tests/
├── setupEnv.js                 # Ambiente de teste (NODE_ENV, banco em memória)
├── unit/                       # Jest — cobertura de sentença/decisão
│   ├── geradorCardapio.test.js #   Algoritmo de geração
│   └── validators.test.js      #   Funções de validação
├── integration/                # Jest + Supertest — heurística VADER + regras de negócio
│   ├── auth.test.js · autorizacao.test.js
│   ├── receitas.test.js · preferencias.test.js · cardapio.test.js
│   └── helpers/                # appDeTeste, receitaBuilder, usuarios
└── contract/                   # Jest — estrutura/tipos de resposta por endpoint
    ├── contrato.test.js
    └── helpers/contractMatchers.js

e2e/                            # Playwright — cenários de maior risco/valor
├── playwright.config.js
└── tests/
    ├── geracao-cardapio.spec.js            # Geração respeitando restrições e meta
    ├── nao-repeticao-consecutiva.spec.js   # Não repetição em dias consecutivos
    ├── edicao-manual-cardapio.spec.js      # Edição manual persistindo
    └── helpers/                            # api, auth
```
