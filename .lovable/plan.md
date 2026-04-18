

# Auditoria Completa do Sistema — Diagnóstico + Plano de Ação

## TL;DR — Minha opinião honesta

Você construiu uma **plataforma poderosa** (120 edge functions, 100+ tabelas, AI Squads, intelligence engines), mas está num ponto crítico: **complexidade demais, sobreposição funcional alta e custos de IA desnecessários**. Os Squads são uma adição excelente — mas só estão em **5 das ~40 funções de IA** (12,5%). Há ~10 funções duplicadas e várias páginas inchadas (>1000 linhas). Vamos arrumar.

---

## 1. O que está FUNCIONANDO bem ✅

- **AI Squads architecture** — `squad-runner.ts` está bem desenhado: fallback Gemini→Gateway, presets reutilizáveis, retry tolerante a falhas
- **Banco rico de inteligência** — 23.440 channel_intelligence, 9.113 viral_titles, 3.274 embeddings, 411 hooks
- **Segurança** — RLS, RBAC admin, credit guard com check de identidade, realtime scoping (recém-corrigidos)
- **CRONs reduzidos** (já feito): consumo desnecessário caiu drasticamente
- **Stack consistente** — Gemini direto + fallback gateway, tier limits, credit enforcement

---

## 2. PROBLEMAS críticos detectados 🔴

### 2.1 Squads incompletos (sua pergunta principal)
Apenas **5 funções** usam squads: `generate-script`, `generate-titles`, `generate-ideas`, `generate-thumbnail-prompt`, `packaging-score`.

**~30 funções de IA pesadas SEM squad** — e várias se beneficiariam muito:

| Função | Por que precisa de squad |
|---|---|
| `score-script` (529 LOC) | Score sem segunda opinião → notas inconsistentes |
| `refine-script` | Refina sem crítico → mantém slop |
| `generate-veo3-prompts` | Prompts sem validação Veo3 policy |
| `analyze-channel` | Análise rasa sem estrategista |
| `analyze-topic` (554 LOC) | Tópico sem validador de viralidade |
| `viral-diagnosis` | Diagnóstico sem segundo olhar |
| `reverse-engineer-video` | Engenharia reversa sem validador |
| `generate-30day-plan` + `generate-adaptive-plan` | Plano sem coach revisor |
| `niche-explorer` (579 LOC) | Exploração sem validador de saturação |
| `monetization-coach` | Coach sem auditor financeiro |
| **`refresh-references`** ⭐ | **Sua pergunta específica — ver §4** |

### 2.2 Funções DUPLICADAS (matar/fundir)
```
discover-channels-gemini  ╮
discover-viral-channels   ├─→ Fundir em UMA: discover-channels
analyze-viral-channels    ╯

find-competitors        ╮
find-competitors-ai     ├─→ Manter só find-competitors-ai (a IA)
                        ╯

seed-complete-knowledge ╮
seed-elite-knowledge    ├─→ Fundir em seed-knowledge (parametrizado)
seed-reference-channels ├
data-seeding-engine     ╯

self-learning-engine    ╮
self-learning-worker    ├─→ Manter só self-learning-engine
extract-user-learnings  ├   (worker chama engine internamente)
learn-from-user         ╯

generate-plan           ╮
generate-30day-plan     ├─→ Fundir em generate-plan (com flag adaptive)
generate-adaptive-plan  ╯

knowledge-auto-expand   ╮
calibrate-knowledge     ├─→ Fundir em knowledge-engine
gemini-bulk-seeder      ╯
```
**Impacto**: ~15 funções a remover → -12% de superfície, -manutenção, sem perda funcional.

### 2.3 Páginas gigantes (refatoração)
- `Scripts.tsx` — **1433 linhas** ❌
- `MultiChannel.tsx` — **1207 linhas** ❌
- `Channels.tsx` — **1077 linhas** ❌
- `NicheExplorer.tsx` — **985 linhas** ⚠️
- `Branding.tsx` — **842 linhas** ⚠️

→ Quebrar em sub-componentes (cada tab/seção em arquivo próprio).

### 2.4 Squads sem uso real
`squad_runs = 0` no banco. A página `/squads` existe mas **ninguém rodou um pipeline ainda**. Ou descobertabilidade é ruim, ou duplica o que já existe nas outras páginas.

### 2.5 Cobertura de squad baixa em fluxos críticos
- **Roteiros**: tem squad ✅ mas `refine-script` e `score-script` não → quebra a cadeia de qualidade
- **Veo3/Cenas**: ZERO squad — geração visual sem validação policy/coerência
- **Análise de canais**: ZERO squad nas análises (só na geração)

---

## 3. Custos de IA desnecessários 💸

| Origem | Problema | Solução |
|---|---|---|
| `track-video-performance` (44× em 7d, 1388 API calls) | Roda toda vez sem cache | Cachear por 6h, só re-rodar se métricas mudaram |
| `daily-data-ingestion` (90 calls Brave/semana) | 10 nichos × 7 dias | Reduzir para 5 nichos top, cache 14 dias |
| `auto-intelligence-cron` (avg 41s) | Pesado, lento | Quebrar em sub-jobs assíncronos |
| `intelligence-sync-engine` (3 erros em 11 calls) | Falhas silenciosas | Adicionar retry + alertas |
| Squad de roteiro = 4 chamadas Gemini sequenciais | 4× custo se tudo Gateway | Forçar Gemini direto (já gratuito) com fallback só em erro |
| `flash-quality-boost.ts` | Roda em todo gen-script | Skip quando squad já rodou (ele já refina) |

---

## 4. Squad para Reference Channels (sua pergunta principal) ⭐

Hoje: `refresh-references` faz **1 chamada Gemini Flash-Lite** que extrai padrões básicos. É **raso demais**.

### Squad proposto: `Squad Reference Intelligence`
Pipeline de 4 agentes rodando quando usuário adiciona/atualiza um canal de referência:

```text
USUÁRIO ADICIONA CANAL DE REFERÊNCIA
            │
            ▼
   ┌────────────────────────┐
   │ 1. SCANNER 📡           │  YouTube API: últimos 20 vídeos
   │ - top performers        │  + 5 piores → contraste
   │ - drops virais          │  Gemini Flash-Lite (rápido)
   └────────────┬───────────┘
                ▼
   ┌────────────────────────┐
   │ 2. PATTERN EXTRACTOR 🧬 │  Identifica:
   │ - fórmulas título       │  - hook patterns
   │ - estrutura roteiro     │  - thumbnail style
   │ - frequência postagem   │  Gemini Flash
   └────────────┬───────────┘
                ▼
   ┌────────────────────────┐
   │ 3. STRATEGIST 🎯        │  Cruza com:
   │ - gaps explorável       │  - canais do usuário
   │ - ângulos a roubar      │  - viral_titles_db
   │ - o que NÃO copiar      │  Gemini Pro (qualidade)
   └────────────┬───────────┘
                ▼
   ┌────────────────────────┐
   │ 4. EVOLUTION TRACKER 📈 │  Compara com scan anterior:
   │ - mudou de formato?     │  - alerta de pivots
   │ - hooks novos?          │  - tendências emergentes
   │ - performance trend     │  Gemini Flash
   └────────────┬───────────┘
                ▼
       INTEL SALVA EM 
   user_reference_channels.latest_intel
   + injetada em generate-script,
     generate-titles, viral-diagnosis
```

### Algoritmo de alimentação contínua
1. **Scan inicial** (quando adiciona canal): squad completo (4 agentes)
2. **Refresh semanal**: só agentes 1+4 (scanner + evolution) — economia
3. **Refresh sob demanda**: usuário clica "atualizar agora" → squad full
4. **Auto-trigger**: se algum vídeo do canal viralizar (>3× média), dispara squad full
5. **Cache**: intel válido por 7 dias; se < 7d, reusa

### Como será USADO automaticamente
Toda função do usuário (`generate-script`, `generate-titles`, `viral-diagnosis`, `analyze-topic`) **busca os top 3 canais de referência do usuário** e injeta `latest_intel` no system prompt. Sem o usuário pedir.

---

## 5. PLANO DE AÇÃO (priorizado por ROI)

### Fase 1 — Squads críticos (alto ROI, baixo esforço)
1. **Squad Reference Intelligence** — refatorar `refresh-references` (4 agentes)
2. **Squad em `score-script`** — analista técnico + simulador audiência + coach
3. **Squad em `refine-script`** — crítico anti-slop + refinador + validador
4. **Squad em `generate-veo3-prompts`** — gerador + policy validator + cinematógrafo

### Fase 2 — Limpeza de duplicações
5. Fundir `discover-channels-*` (3→1)
6. Fundir `seed-*` (4→1 parametrizado)
7. Fundir `self-learning-*` (4→1)
8. Fundir `generate-*-plan` (3→1)
9. Remover `find-competitors` (manter só `-ai`)

### Fase 3 — Otimização de custos
10. Cache em `track-video-performance` (6h TTL)
11. Reduzir `daily-data-ingestion` para 5 nichos top + cache 14d
12. Remover `flash-quality-boost` quando squad rodou
13. Logging de custo por função (atualmente `api_logs` está vazio)

### Fase 4 — UX/Refatoração
14. Quebrar `Scripts.tsx` (1433 LOC) em 6-8 sub-componentes
15. Quebrar `MultiChannel.tsx` em sub-tabs
16. Promover `/squads` na navegação ou integrá-los direto nas páginas existentes (botão "Rodar com Squad" em cada gerador)

---

## 6. O que devo REMOVER ❌

- Funções: `find-competitors`, `discover-channels-gemini`, `analyze-viral-channels`, `seed-elite-knowledge`, `seed-complete-knowledge`, `gemini-bulk-seeder`, `learn-from-user`, `extract-user-learnings`, `generate-30day-plan`, `generate-adaptive-plan`, `self-learning-worker`
- Página `/squads` standalone? **Decisão sua**: ou divulga forte ou integra Squads como botão "Modo Pro" dentro de cada feature

---

## 7. Detalhes técnicos

- **Pipeline Squad atual** roda agentes 100% sequencial. Para `Squad Reference`, podemos paralelizar agentes 1+2 (independentes) → economia de ~3s
- `squad-runner.ts` tem fallback Gemini→Gateway ✅ mas não faz **batching** quando processa lote de canais
- `refresh-references` hoje processa canais um a um → para 10 canais ref, 10 calls sequenciais. Adicionar `Promise.all` em batches de 3
- Custo estimado por usuário/mês com squads em tudo: ~$0.80 (vs $0.30 sem squads) — **2.5x mais qualidade por 2.5x custo**, ainda dentro do tier Pro

---

## Pergunta pra você decidir antes de eu implementar

Quer que eu execute as 4 fases, ou começamos só pela **Fase 1 + Squad Reference** (a sua pergunta principal) e avaliamos resultado antes de seguir?

