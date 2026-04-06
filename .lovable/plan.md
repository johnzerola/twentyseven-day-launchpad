

# Plano: Absorver Documento "Arquitetura 2026" no Sistema

## Análise de Cobertura

Após revisão exaustiva, **~90% do documento já está implementado**. Os módulos de algoritmo (CTR, APV, Session Time), engenharia de roteiro (Hook Mortal, Mas/Portanto, Binge Loop, Micro-Hooks), Sound Design, VFX Tags, Archetypes, Title Formulas, Thumbnail Rules, 48h Revival e Reference Channels já existem no sistema.

## Gaps Reais Identificados

### 1. Árvore de Nichos com Sub-Nichos e Micro-Nichos (`src/lib/viralDatabase.ts`)
O documento define uma **árvore hierárquica de nichos** (Nicho → Sub-Nicho → Micro-Nicho) com CPM estimado que não existe no sistema. Exemplo: Mistérios ($8-$15) → Casos Não Resolvidos → "Casos bizarros do Brasil".

**Ação:** Adicionar constante `NICHE_TREE` com 5 categorias (Mistérios, Curiosidades, Finanças, True Crime, Tecnologia/IA), cada uma com sub-nichos e micro-nichos + CPM range.

### 2. Protocolo Semanal 3×/Semana (`src/lib/viralDatabase.ts`)
O documento define um calendário semanal SEG-DOM com tarefas específicas (pesquisa, roteiro, publicação, análise, cortar Shorts). Não existe como constante no sistema.

**Ação:** Adicionar constante `WEEKLY_PROTOCOL_3X` com o cronograma dia-a-dia + horários de pico BR.

### 3. 10 Regras Inegociáveis (`src/lib/viralDatabase.ts`)
As 10 regras (não trocar nicho antes de 30 vídeos, CTR sem retenção = veneno, série > vídeo isolado, etc.) não estão codificadas.

**Ação:** Adicionar constante `INVIOLABLE_RULES` com as 10 regras como array estruturado.

### 4. Motor de Análise Pós-Publicação — Timelines (`src/lib/viralDatabase.ts`)
O documento define checkpoints (2h, 24h, 48h, Semana 4, Mês 2-3) com ações específicas. O sistema tem a estratégia 48h mas não o protocolo completo.

**Ação:** Adicionar constante `POST_PUBLISH_CHECKPOINTS` com os 5 momentos + ações + métricas alvo.

### 5. Stack de Ferramentas Recomendadas (`src/lib/viralDatabase.ts`)
Lista de ferramentas por etapa (VidIQ, ElevenLabs, CapCut, etc.) com custo. Útil para onboarding.

**Ação:** Adicionar constante `RECOMMENDED_TOOL_STACK`.

### 6. 5 Sistemas de Recomendação do YouTube (`src/lib/viralDatabase.ts`)
Home Feed, Suggested, Search, Subscriptions, Shorts Feed — cada um com sinal principal e como otimizar. Não codificado.

**Ação:** Adicionar constante `YOUTUBE_RECOMMENDATION_SYSTEMS`.

### 7. Injetar Protocolo Semanal no `generate-30day-plan`
O plano de 30 dias atualmente é genérico. Injetar o protocolo semanal 3×/semana com horários de pico e a regra "consistência > qualidade nos primeiros 30 vídeos".

**Ação:** Adicionar bloco `WEEKLY_PROTOCOL_DIRECTIVE` no system prompt com o cronograma SEG-DOM e as 10 regras.

### 8. Injetar Árvore de Nichos no `niche-explorer`
O explorador de nicho não tem a hierarquia micro-nicho.

**Ação:** Injetar constante `NICHE_TREE` no prompt do `niche-explorer` para sugerir micro-nichos com CPM.

### 9. Expandir Title Patterns com 2 fórmulas faltantes (`src/lib/viralDatabase.ts`)
Do documento: "Questão Perturbadora" ("E se [Fato Aceito] fosse completamente falso?") e "Pessoa Simples" ("O [Pessoa Anônima] que [Resultado Extraordinário]") não existem.

**Ação:** Adicionar 2 TitlePatterns ao array `VIRAL_TITLE_PATTERNS_V3`.

### 10. Thumbnail Color Combos (`src/lib/viralDatabase.ts`)
O documento lista 5 combinações de cores específicas (Laranja×Preto, Azul×Laranja, Vermelho×Branco, Verde×Preto, Roxo×Amarelo) com emoção e nicho ideal. Não codificado.

**Ação:** Adicionar constante `THUMBNAIL_COLOR_COMBOS`.

## Resumo de Implementação

| Arquivo | Mudanças |
|---------|----------|
| `src/lib/viralDatabase.ts` | +7 constantes (Niche Tree, Weekly Protocol, 10 Rules, Post-Publish Checkpoints, Tool Stack, YT Recommendation Systems, Thumbnail Color Combos) + 2 title patterns |
| `supabase/functions/generate-30day-plan/index.ts` | Injetar protocolo semanal 3×/sem + 10 regras + horários de pico |
| `supabase/functions/niche-explorer/index.ts` | Injetar árvore de nichos com micro-nichos + CPM |
| `supabase/functions/generate-titles/index.ts` | +2 fórmulas de título (Questão Perturbadora, Pessoa Simples) |
| `supabase/functions/generate-thumbnail-prompt/index.ts` | Injetar tabela de color combos no prompt |

## Detalhes Técnicos
- 5 arquivos editados (1 client-side, 4 edge functions)
- Zero mudanças de banco de dados
- Adições puras — sem risco de quebrar funcionalidades existentes

