

# Auditoria CEO/CTO — Otimização Econômica Total + Precificação Definitiva

## Diagnóstico: Onde o Dinheiro Está Vazando

### Pipeline Completo de 1 Vídeo de 60min (Custo REAL Atual)

```text
┌─────────────────────────────────────────────────────────┐
│ PIPELINE ATUAL — 1 VÍDEO 60MIN                         │
├─────────────────────────────────────────────────────────┤
│ 1. generate-script (Phase 0: Hook)                      │
│    → Gemini Flash (hook) ..................... R$ 0.02   │
│ 2. generate-script (Outline)                            │
│    → Gemini Flash ........................... R$ 0.01   │
│ 3. generate-script (Multi-Act: 5 acts × streaming)      │
│    → 5× Gemini Flash (~4k tokens each) ..... R$ 0.15   │
│ 4. smart-knowledge-retrieval (RAG)                      │
│    → Embedding + DB queries ................. R$ 0.01   │
│ 5. brave-search (research)                              │
│    → 1 query ............................... R$ 0.00   │
│ 6. perplexity-research (webdoc only)                    │
│    → 1 query Sonar Pro ..................... R$ 0.05   │
│ 7. refine-script (Phase 2)                              │
│    → Claude OR Gemini Pro .................. R$ 0.30   │
│ 8. score-script (dual evaluation)                       │
│    → 1× Gemini Flash ....................... R$ 0.03   │
│ 9. generate-titles (3 rounds → 1 round)                 │
│    → 1× Gemini Flash ....................... R$ 0.02   │
│ 10. title-score (statistical, NO AI)                    │
│    → DB only ............................... R$ 0.00   │
│ 11. packaging-score                                     │
│    → 1× Gemini Flash ....................... R$ 0.02   │
│ 12. google-tts (narração 54k chars)                     │
│    → Google Cloud TTS ...................... R$ 0.86   │
│ 13. generate-synced-prompts (90 cenas)                  │
│    → 1× Gemini Pro ........................ R$ 1.66   │
│ 14. generate-veo3-prompts (PRO only)                    │
│    → 1× Gemini Pro ........................ R$ 0.50   │
├─────────────────────────────────────────────────────────┤
│ TOTAL SEM VEO3: ~R$ 1.47/vídeo                         │
│ TOTAL COM VEO3 PROMPTS: ~R$ 3.63/vídeo                 │
│ TTS: ~R$ 0.86/vídeo (95% do custo não-visual)          │
└─────────────────────────────────────────────────────────┘
```

### 7 Problemas Encontrados (em ordem de impacto econômico)

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **video-orchestrator é um CLONE** do generate-script — mesmas 5 fases (HookGen, Draft, Refine, FactCheck, SceneBreak) usando Gemini Pro. Cobra 8 créditos. Se o usuário acionar via fluxo errado, duplica tudo | R$ 1.50 desperdiçado |
| 2 | **video-orchestrator faz SceneBreak com ~8s/cena** em vez de 40s como já corrigido no synced-prompts — inconsistência | Tokens 5x maiores |
| 3 | **generate-titles tem código morto** (linhas 68-80: unreachable code após `throw`) — não causa custo, mas é tech debt | Bug potencial |
| 4 | **refine-script sempre chama Claude** mesmo quando routing diz Gemini — precisa verificar se o routing realmente funciona | R$ 0.25 desperdiçado por chamada desnecessária |
| 5 | **Prompt do system** no generate-script tem ~6.000 tokens fixos — injeta TUDO (Hollywood Masterclass, 10 princípios, emotion map, etc.) em CADA ato do multi-act. Multiplica por 5 = 30k tokens de system prompt | R$ 0.10 desperdiçado |
| 6 | **PricingSection mostra planos desalinhados** com o que o backend implementa (Free/R$47/R$147 vs backend Starter R$97/Pro R$247/Full R$597) | Confusão de negócio |
| 7 | **api_config** tem daily_limit 150 para gemini/openai — mas usamos API direta, então esses limites nunca são verificados para chamadas diretas | Falso senso de controle |

## Plano de Otimizações (10 itens)

### 1. Eliminar video-orchestrator como pipeline duplicado
- Marcar como **deprecated** (redirecionar para generate-script + refine-script)
- Ou refatorar para ser apenas um thin orchestrator que chama as funções existentes
- Economia: ~R$ 1.50 por chamada duplicada evitada

### 2. Reduzir system prompt no multi-act (atos 2-5)
- Atos 2+ recebem system prompt ENXUTO (sem Hollywood Masterclass, sem Emotion Map, sem Anti-Slop completo)
- Manter apenas: estilo selecionado + regras de continuidade + voice DNA
- Economia: ~25k tokens/vídeo = R$ 0.08

### 3. Consolidar refine-script routing
- Verificar e corrigir a lógica de routing Claude vs Gemini Pro vs Flash
- Garantir que estilos dopaminérgico/listicle/curiosidades usem Flash (R$ 0.02 vs R$ 0.30)

### 4. TTS: Usar Standard ao invés de Neural2 no plano básico
- Neural2 = R$ 16/1M chars | Standard = R$ 4/1M chars
- Plano básico usa Standard (R$ 0.22/vídeo), Pro/Full usa Neural2
- Economia no plano básico: R$ 0.64/vídeo

### 5. Corrigir SceneBreak do video-orchestrator
- Se mantido, atualizar para 40s/cena (consistente com synced-prompts)

### 6. Limpar código morto no generate-titles
- Remover unreachable code (linhas 68-80)

### 7. Cache agressivo no smart-knowledge-retrieval
- Cachear resultados RAG por tópico+nicho por 24h (atualmente sem cache)
- Evita embedding + DB query redundantes

### 8. Nova Precificação (3 planos alinhados com custo real)

```text
┌──────────────────────────────────────────────────────────────┐
│                PRECIFICAÇÃO DEFINITIVA                       │
├──────────────┬──────────────┬──────────────┬────────────────┤
│              │  STARTER     │  CREATOR PRO │  AGENCY FULL   │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ Preço mensal │  R$ 47/mês   │  R$ 147/mês  │  R$ 397/mês    │
│ Preço anual  │  R$ 29/mês   │  R$ 97/mês   │  R$ 247/mês    │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ Vídeos/mês   │  30 (1/dia)  │  90 (3/dia)  │  300 (10/dia)  │
│ Canais       │  1           │  5           │  20            │
│ Duração máx  │  30 min      │  60 min      │  90 min        │
│ Narração     │  Standard    │  Neural2     │  Neural2       │
│ Voz TTS      │  2 vozes     │  Todas       │  Todas + 11Lab │
│ Pesquisa web │  Brave basic │  Brave+Pplx  │  Ilimitado     │
│ Webdoc style │  ❌          │  ✅          │  ✅            │
│ Veo3 prompts │  ❌          │  ✅          │  ✅            │
│ TubeBot      │  20 msgs/dia │  Ilimitado   │  Ilimitado     │
│ Multilíngue  │  ❌          │  ✅          │  ✅            │
│ White label  │  ❌          │  ❌          │  ✅            │
│ API access   │  ❌          │  ❌          │  ✅            │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ Custo/vídeo  │  ~R$ 0.55    │  ~R$ 1.47    │  ~R$ 1.80      │
│ Custo 30v/m  │  ~R$ 16.50   │  ~R$ 44.10   │  ~R$ 54.00     │
│ Margem bruta │  65%         │  70%         │  86%           │
│ Margem anual │  82%         │  84%         │  91%           │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

**Lógica de negócio:**
- **Starter R$ 47**: 1 vídeo/dia, TTS Standard, sem pesquisa profunda. Custo: R$ 16.50/mês. Margem: 65%. O usuário vê ROI quando monetiza (R$ 800+/mês no YPP). Atrai volume.
- **Creator Pro R$ 147**: 3 vídeos/dia, TTS Neural2, Webdoc + Veo3. Custo: R$ 44/mês. Margem: 70%. O upgrade natural para quem quer escalar.
- **Agency R$ 397**: 10 vídeos/dia, 20 canais, White label. Custo: R$ 54/mês. Margem: 86%. Agências pagam felizes.

### 9. Atualizar PricingSection.tsx
- Alinhar os 3 planos com a tabela acima
- Remover "Explorador" R$ 0 (sem plano grátis real — apenas trial de 7 dias)
- Preços anuais com desconto de 35-40%

### 10. Atualizar use-subscription.ts + tier-limits.ts
- Sincronizar PLAN_LIMITS com os novos valores
- Adicionar gate para TTS voice quality (Standard vs Neural2)
- Adicionar gate para duração máxima por tier

## Arquivos a Editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/video-orchestrator/index.ts` | Deprecar ou refatorar para thin orchestrator |
| `supabase/functions/generate-script/index.ts` | System prompt enxuto para atos 2+, otimizar tokens |
| `supabase/functions/refine-script/index.ts` | Verificar/corrigir routing Claude vs Gemini |
| `supabase/functions/generate-titles/index.ts` | Remover código morto (linhas 68-80) |
| `supabase/functions/google-tts/index.ts` | Tier-based voice quality (Standard vs Neural2) |
| `src/components/landing/PricingSection.tsx` | Nova precificação: Starter R$47, Pro R$147, Agency R$397 |
| `src/hooks/use-subscription.ts` | Novos PLAN_LIMITS alinhados |
| `supabase/functions/_shared/tier-limits.ts` | Novos limites sincronizados |

## Resultado Esperado
- Custo por vídeo 60min (Starter): R$ 0.55 (vs R$ 1.47 atual)
- Margem SaaS mínima: 65% (Starter) a 91% (Agency anual)
- Zero chamadas duplicadas, zero código morto
- Precificação que o usuário vê ROI claro: paga R$ 47, ganha R$ 800+ no YPP

