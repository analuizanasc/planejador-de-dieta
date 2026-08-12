# 🧭 CHARTER DE TESTE EXPLORATÓRIO — SBTM

## 📋 IDENTIFICAÇÃO
- **Título da Missão:** Explorar o fluxo completo do Planejador de Dieta (Auth, Receitas, Preferências, Geração de Cardápio) com heurísticas **CRUD, Fronteira, Estado, Abordagem Contrária e VADER**
- **Funcionalidade Alvo:** App "Mesa" — cadastro/login (JWT), CRUD de receitas, preferências/restrições, geração de cardápio semanal/mensal
- **Data / Versão:** 2026-08-12 · branch `dev` (commit fec00c8) · frontend :5173 + backend :3000

## 🎯 MISSÃO
Explorar o app ponta a ponta identificando defeitos funcionais, falhas de validação, inconsistências de UX/design e riscos de segurança, com foco nos fluxos de maior risco (autenticação, integridade dos dados do cardápio e validações de formulário).

## 🔍 HEURÍSTICAS RECOMENDADAS
- **Principal — CRUD:** ciclo completo de receitas (criar, ler, atualizar, excluir) e integridade referencial com o cardápio.
- **Apoio:** Fronteira/Dados (limites de senha, calorias, meta), Estado (sessão/token, rotas protegidas), Abordagem Contrária (login inválido, geração sem dados suficientes), VADER (respostas e códigos da API), Strings (XSS/escapamento).

## 🔎 ÁREAS DE INVESTIGAÇÃO
1. Autenticação: registro, login, validações, rotas protegidas, persistência de sessão
2. CRUD de Receitas + validações de campo
3. Preferências: categorias, restrições, meta calórica
4. Geração de cardápio (semana/mês): restrições, meta, dias consecutivos, atribuição manual
5. Estados de UI: vazio, carregando, erro, feedback

## 🧩 RECURSOS E DADOS
- **Dados de teste:** usuário criado na hora (`ana.explora@teste.com`); receita "Tapioca com ovo" (320→450 kcal)
- **Ambiente:** http://localhost:5173 (Vite) → proxy `/api` → backend :3000 (Express + SQLite)
- **Ferramentas:** agent-browser (navegador visível), inspeção de rede e DOM

## 🚫 FORA DO ESCOPO
Teste de carga/performance, responsividade mobile detalhada, e-mail de recuperação de senha (inexistente), testes de API isolados (cobertos por outra suíte).

---

## ⏱️ DURAÇÃO REAL: ~10min23s (19:57:18 → 20:07:41)

## 📊 TASK BREAKDOWN (TBS)
- Test Design & Execution: **60%**
- Bug Investigation & Reporting: **25%**
- Session Setup: **15%**
- Charter vs Opportunity: **80% / 20%**

## 📝 NOTAS DA SESSÃO
- (I) Login inválido retorna mensagem **genérica** ("Email ou senha inválidos") — boa prática de segurança (não revela qual campo falhou).
- (I) Validações nativas HTML5 corretas: senha `minlength=8`, calorias `min=0`.
- (I) Geração respeita a regra **"não repetir em dias consecutivos"**: com 1 receita de Café, o gerador preencheu dias alternados e listou os incompatíveis.
- (I) Medidor de meta funcional ("320/2000 kcal", "0/2000 kcal" por dia).
- (I) Seletor de atribuição manual **filtra por categoria** e mostra empty state "Nenhuma opção disponível".
- (I) Sessão **persiste no reload**; logout limpa o token e redireciona para `/entrar`.
- (I) XSS: payload `<img onerror>` no nome da receita **não executou** (React escapa por padrão).
- (R) Token JWT em **localStorage** → exposto a XSS caso surja uma brecha de injeção no futuro.
- (R) Meta calórica **sem limite máximo** → aceita valores absurdos.
- (R) Feedback de erro em ações destrutivas usa `window.alert`/`confirm` **nativos**, fora do design system (existe componente `Alerta` próprio não utilizado nesses pontos).

## 🐞 DEFEITOS / MELHORIAS ENCONTRADAS

| # | Sev. | Área | Descrição | Evidência |
|---|------|------|-----------|-----------|
| 1 | Média (UX) | Receitas | Mensagem ao tentar excluir receita em uso é **jargão técnico**: *"Operação viola uma referência existente (ex.: receita em uso no cardápio)"*. Deveria ser voltada ao usuário: *"Não é possível excluir: esta receita está em uso em um cardápio. Remova-a do cardápio antes."* | `20-delete-409-feedback.png` |
| 2 | Média (Design) | Global | Confirmação de exclusão e erros usam `window.confirm`/`window.alert` **nativos**, quebrando a identidade visual — o app já tem o componente `Alerta` (usado no estado `erro` da lista). Inconsistência de padrão. | `18-excluir-confirmacao.png` |
| 3 | Baixa (Validação) | Preferências | Meta calórica diária tem `min=1` mas **nenhum `max`** — aceita valores absurdos (ex.: 99999999 kcal). | `12-preferencias.png` |
| 4 | Baixa (Boundary) | Receitas | Calorias aceita **0** (`min=0`) — receita com 0 kcal é semanticamente questionável para um planejador de dieta. | `06-calorias-negativas.png` |
| 5 | Baixa (Segurança) | Auth | Token JWT em **localStorage** (chave `planejador-dieta:token`) — trade-off conhecido de exposição a XSS. Avaliar httpOnly cookie. | `04-pos-registro.png` |
| 6 | Baixa (UX) | Cardápio | **Visão mensal não permite gerar/editar** cardápio — só a semanal. Obriga o usuário a alternar de tela. | `17-cardapio-mes.png` |

### ✅ Pontos fortes observados
- Integridade referencial no backend: **exclusão de receita em uso é bloqueada (409)** — dado não fica órfão.
- Rotas protegidas redirecionam corretamente (logado e deslogado).
- CRUD de receitas funcional (POST 201, PUT 200, DELETE protegido) com confirmação antes de excluir.
- Feedback claro de categorias sem receita compatível na geração.
- Empty states bem tratados em receitas, cardápio e seletor manual.

## ❓ ISSUES / PERGUNTAS
- O checkbox de restrição na receita (Glúten/Lactose/Açúcar) significa "**contém**" ou "**é livre de**"? O comportamento sugere "contém", mas não há rótulo explicativo.
- Calorias 0 e meta ilimitada são intencionais ou faltam regras de negócio?
- Há intenção de estilizar as confirmações/erros com o design system ou o uso de dialogs nativos é deliberado?

## 🔄 DEBRIEFING PROOF
- **Past:** Cobri auth (registro/login/inválido/rotas protegidas/sessão), CRUD completo de receitas com validações de fronteira, preferências (categorias/restrições/meta), geração semanal/mensal com meta e atribuição manual, logout e um teste de XSS.
- **Results:** Fluxo principal **funciona e é sólido**; 6 achados (2 médios de UX/design, 4 menores) e vários pontos fortes de integridade e segurança confirmados.
- **Obstacles:** Dialogs nativos (`confirm`/`alert`) foram auto-tratados pela automação — precisei instrumentar `window.alert` para confirmar que o feedback de erro realmente aparece (inicialmente pareceu falha silenciosa; **corrigido após verificação**). Persistir uma receita com payload XSS teve atrito de tooling.
- **Outlook:** Confirmar semântica das restrições com o time; testar geração com receitas em **múltiplas categorias e restrições conflitantes**; validar meta com limites; revisitar XSS persistindo o payload; testar responsividade mobile.
- **Feelings:** Confiança **alta** no núcleo (auth + integridade dos dados). As ressalvas são de acabamento de UX/consistência de design, não de correção funcional.
