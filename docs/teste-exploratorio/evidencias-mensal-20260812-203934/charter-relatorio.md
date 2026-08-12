# 🧭 CHARTER DE TESTE EXPLORATÓRIO — SBTM

## 📋 Identificação
- **Título da Missão:** E2E de **planejamento mensal** com catálogo rico (várias receitas por refeição), aplicando heurísticas **Siga os Dados, Variabilidade, Estado e Fronteira**
- **Funcionalidade Alvo:** Geração de cardápio (semana→mês) do app "Mesa" com 16 receitas distribuídas em cafe/almoco/jantar/lanche
- **Data/Versão:** 2026-08-12 · branch `dev` (fec00c8) · :5173 + :3000
- **⏱️ Duração real:** ~6min (20:39:34 → 20:45:31)

## 🎯 Missão
Percorrer o fluxo ponta a ponta de montar o cardápio de um mês inteiro, com **múltiplas opções por refeição**, verificando: variedade das escolhas, aderência à meta calórica, regra de não-repetição, restrições e a agregação correta na visão mensal.

## 🧩 Recursos e Dados (setup via API)
- **16 receitas** semeadas: Café (5: 250–450 kcal), Almoço (4: 400–700), Jantar (4: 300–480), Lanche (3: 150–250), com misturas de `tags_restricao` e 2 com `permite_repeticao`.
- **Preferências:** 4 categorias ativas, sem restrições, meta 2000 kcal.

## 🚫 Fora do escopo
Performance, mobile, e-mail de recuperação.

---

## ⏱️ DURAÇÃO REAL: ~6min

## 📊 TASK BREAKDOWN (TBS)
- Test Design & Execution: **45%**
- Bug Investigation & Reporting: **40%** (root cause + experimento A/B no algoritmo)
- Session Setup: **15%**
- Charter vs Opportunity: **70% / 30%**

## 📝 Notas da Sessão
- (I) Visão mensal **agrega corretamente** todas as semanas geradas (14 dias apareceram no mês: 10–16 e 24–30). ✅
- (I) Dentro de cada semana contígua, a regra **RN1 (não repetir em dias consecutivos) é respeitada** — alternância A/B, sem repetição literal. ✅
- (I) Meta é respeitada como teto: nenhum dia ultrapassa 2000 kcal ("sem ultrapassar"). ✅
- (R) O E2E mensal exige **gerar semana a semana manualmente** (não há "gerar mês"): para um mês são ~5 clicks em telas diferentes (reforça o achado #6 da 1ª sessão).
- (R) Com meta ativa, os totais diários **oscilam 1880/1560** e nunca se aproximam mais de 2000, mesmo havendo receitas de calorias intermediárias que permitiriam ajuste fino.

## 🐞 DEFEITO PRINCIPAL — Variedade colapsa quando há meta calórica

**Severidade: Alta (qualidade do produto / proposta de valor)**

Com meta de 2000 kcal e um catálogo de 3–5 receitas por categoria, o gerador usou **apenas 2 receitas por categoria** durante os 14 dias — o mês inteiro é a mesma dupla de pratos se alternando:

| Categoria | Distintas usadas / disponíveis | Nunca usadas |
|-----------|-------------------------------|--------------|
| Café | **2 / 5** | Pão com queijo, Vitamina de banana, Aveia com mel |
| Almoço | **2 / 4** | Arroz/feijão/frango, Salada com atum |
| Jantar | **2 / 4** | Sopa de legumes, Omelete |
| Lanche | **2 / 3** | Frutas picadas |

### 🔬 Causa raiz (verificada no código + experimento A/B)
`backend/src/services/geradorCardapio.js`:
- `selecionarSemMeta()` → escolhe por **LRU (variedade)**, desempate por menor uso.
- `selecionarComMeta()` → **subset-sum por programação dinâmica** que só maximiza a soma ≤ meta. **Não considera variedade/uso.** Como meta e catálogo são fixos, o ótimo é sempre a mesma combinação; a alternância diária vem só da RN1 forçando a 2ª melhor combinação (também fixa).

**Experimento controlado (mesmo catálogo, mesma semana):**
- Meta = null → **5/5, 4/4, 4/4, 3/3** distintas (variedade total, todas as receitas entram).
- Meta = 2000 → **2/5, 2/4, 2/4, 2/3** (colapso).

Ou seja: a variedade — que é a razão de existir de um planejador — **quebra exatamente quando o usuário define uma meta**, que é o caso de uso central de quem faz dieta.

### 💡 Sugestão de correção
Fazer `selecionarComMeta` desempatar por variedade: entre combinações de soma igual (ou dentro de uma tolerância de ±X kcal da meta), preferir as receitas menos usadas recentemente (mesma lógica LRU do caminho sem meta). Assim mantém a aderência à meta **e** rotaciona o catálogo.

**Evidências:** `01-semana1-gerada.png`, `02-semana-SEM-meta-variada.png` (variada), `03-semana-COM-meta-monotona.png` (monótona), `04-visao-mensal.png`.

## ❓ Issues / Perguntas
- A RN4 (meta) deveria coexistir com a intenção de variedade do `selecionarSemMeta`? Hoje elas se excluem.
- Há tolerância aceitável em torno da meta (ex.: ±150 kcal) que permitiria variar as escolhas? Isso destravaria a correção acima.
- Deveria existir uma ação "gerar o mês inteiro" para o fluxo mensal?

## 🔄 Debriefing PROOF
- **Past:** Semeei 16 receitas variadas, gerei 3 semanas de agosto com meta, analisei variedade/meta/repetição no mês e rodei um experimento A/B com e sem meta.
- **Results:** Agregação mensal e regras de meta/repetição **corretas**; encontrei 1 defeito de **alta severidade** (colapso de variedade com meta) com causa raiz isolada no algoritmo e reprodução determinística.
- **Obstacles:** A geração é semanal, então "planejar o mês" exigiu múltiplas gerações; parsing do DOM mensal falhou e migrei para a API para a análise quantitativa.
- **Outlook:** Implementar desempate por LRU no `selecionarComMeta`; adicionar teste que garanta N receitas distintas ao longo de um mês com meta ativa; avaliar botão "gerar mês".
- **Feelings:** As mecânicas estão corretas, mas a **experiência do produto com meta é pobre** — hoje o app entregaria 30 dias quase idênticos a quem tem meta calórica. É o achado de maior valor das duas sessões.
