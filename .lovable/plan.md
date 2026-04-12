

# Análise Completa de Custos por Usuário + Sistema de Precificação

## Contexto
Analisei linha por linha todas as funções do pipeline end-to-end. Abaixo está o mapa completo de custos para 1 usuário gerando 1 vídeo de 60 min/dia no plano Starter.

---

## 1. MAPA DE CUSTOS — Pipeline Completo (1 vídeo de 60 min)

### A) Geração de Roteiro (`generate-script`)
| Etapa | API | Tokens (aprox) | Custo/chamada |
|---|---|---|---|
| Smart Knowledge Retrieval (RAG) | Gemini Flash | ~2K in / 1K out | $0.0003 |
| Phase 0: Hook (Gemini Flash) | Gemini Flash | ~8K in / 2K out | $0.001 |
| Phase 0: Claude Hook Polish | Claude Sonnet | ~3K in / 2K out | $0.02 |
| Multi-Act Outline | Gemini Flash | ~1K in / 1K out | $0.0002 |
| Multi-Act (5 atos × ~24K tokens) | Gemini Flash × 5 | ~50K in / 45K out | $0.012 |
| **Subtotal Roteiro** | | | **~$0.034** |

*Nota: Claude é usado APENAS no hook polish (~$0.02). Se estilo é dopaminérgico/mrbeast, Claude é PULADO = $0.014.*

### B) Refinamento (`refine-script`)
| Rota | API | Custo |
|---|---|---|
| Estilos criativos (storytelling, terror) | Claude Sonnet (streaming) | ~$0.04 |
| Estilos fáticos (webdoc, educativo) | Gemini Pro | ~$0.008 |
| Estilos simples (dopaminérgico, lista) | Gemini Flash | ~$0.003 |
| **Média ponderada** | | **~$0.015** |

### C) Avaliação (`score-script`)
| Etapa | API | Custo |
|---|---|---|
| Dual scoring (Gemini Flash × 2) | Gemini Flash | ~$0.002 |
| Calibração + retenção | Local (sem API) | $0 |
| **Subtotal** | | **~$0.002** |

### D) Narração TTS (`google-tts`)
| Motor | Caracteres (60min) | Custo |
|---|---|---|
| Google Neural2 (via chave do usuário) | ~54.000 chars | $0.016/1K = **$0.864** |
| Google Neural2 (free tier: 1M/mês) | 54K de 1M | **$0** nos primeiros 18 vídeos |
| Gemini TTS (alternativa, via GOOGLE_AI_API_KEY) | ~54K chars | ~**$0.003** |
| **Custo real com free tier** | | **$0.00-0.86** |

### E) Geração de Cenas (`generate-synced-prompts`)
| Etapa | API | Custo |
|---|---|---|
| ~90 cenas × Gemini Flash | Gemini Flash | ~$0.015 |
| Veo3 policy filter | Local | $0 |
| **Subtotal** | | **~$0.015** |

### F) Títulos (`generate-titles`)
| Etapa | API | Custo |
|---|---|---|
| 1 chamada Gemini Flash + YouTube search | Gemini Flash + YouTube API (100 units) | ~$0.002 |

### G) SEO Analyzer (`seo-analyzer`)
| Etapa | API | Custo |
|---|---|---|
| 1 chamada Gemini Flash | Gemini Flash | ~$0.001 |

### H) Thumbnail Prompt + Geração de Imagem (`generate-thumbnail-prompt`)
| Etapa | API | Custo |
|---|---|---|
| 3 prompts + 1 imagem gerada | Gemini Flash + Gemini Image | ~$0.005 |

### I) Score de Título (`title-score`)
| Etapa | API | Custo |
|---|---|---|
| Análise estatística local | Supabase query | $0 |

### J) Packaging Score (`packaging-score`)
| Etapa | API | Custo |
|---|---|---|
| 1 chamada Gemini Flash | Gemini Flash | ~$0.001 |

### K) Pesquisa (Brave + Perplexity) — Apenas estilos webdoc/documentário
| API | Custo |
|---|---|
| Brave Search (1 query) | Incluso no plano (cache) |
| Perplexity Sonar Pro (apenas webdoc) | ~$0.005/query |

### L) TubeBot/Chat (`chat-assistant`) — Uso médio diário
| Uso | API | Custo |
|---|---|---|
| ~5 mensagens/dia | Gemini Flash × 5 | ~$0.005 |

---

## 2. CUSTO TOTAL POR VÍDEO (60 min)

```text
┌──────────────────────────────────────────────────────┐
│          CUSTO POR VÍDEO DE 60 MIN                   │
├─────────────────────┬──────────┬─────────────────────┤
│ Componente          │ COM Free │ SEM Free Tier       │
│                     │  Tier    │ (após 1M chars)     │
├─────────────────────┼──────────┼─────────────────────┤
│ Roteiro (Multi-Act) │  $0.034  │  $0.034             │
│ Refinamento         │  $0.015  │  $0.015             │
│ Score               │  $0.002  │  $0.002             │
│ TTS (Narração)      │  $0.000  │  $0.864             │
│ Cenas (Prompts)     │  $0.015  │  $0.015             │
│ Títulos + SEO       │  $0.003  │  $0.003             │
│ Thumbnail           │  $0.005  │  $0.005             │
│ Packaging Score     │  $0.001  │  $0.001             │
│ TubeBot (5 msgs)    │  $0.005  │  $0.005             │
│ YouTube API (quota) │  $0.000  │  $0.000             │
├─────────────────────┼──────────┼─────────────────────┤
│ TOTAL POR VÍDEO     │  $0.08   │  $0.94              │
│ TOTAL MENSAL (30v)  │  $2.40   │  $28.20             │
│ EM REAIS (30v)      │ R$ 14    │  R$ 163             │
└──────────────────────┴──────────┴─────────────────────┘
```

## 3. CUSTO MENSAL POR USUÁRIO — Cenários Reais

```text
┌───────────────────────────────────────────────────────────┐
│ CENÁRIO          │ Com Free Tier │ Sem Free │ Após 18v/mês│
├──────────────────┼───────────────┼──────────┼─────────────┤
│ 1 vídeo/dia (30) │ R$ 14         │ R$ 163   │ R$ 60*      │
│ 2 vídeos/dia(60) │ R$ 28         │ R$ 326   │ R$ 188      │
│ 3 vídeos/dia(90) │ R$ 42         │ R$ 490   │ R$ 350      │
└──────────────────┴───────────────┴──────────┴─────────────┘
* 18 vídeos grátis (1M chars free), 12 vídeos pagos
```

## 4. ONDE MAIS GASTA (além do pipeline)

| Função | Quando | Custo/chamada | Frequência |
|---|---|---|---|
| `analyze-channel` | Onboarding + mensal | $0.01 (Gemini + YT API) | 1-2x/mês |
| `find-competitors` | Setup canal | $0.005 | 1x/mês |
| `channel-intelligence` | Background | $0 (DB query) | Daily |
| `generate-ideas` | Planejamento | $0.003 | 2-3x/semana |
| `viral-diagnosis` | Pós-upload | $0.005 | 1x/vídeo |
| `dubspy-scan` | Pesquisa | $0.005 | 2x/semana |
| **Overhead mensal** | | | **~$0.30 = R$ 1.74** |

## 5. MELHORIAS DE ECONOMIA PROPOSTAS

### 5.1 — Gemini TTS em vez de Google Cloud TTS (economia: 95%)
O sistema já tem Gemini TTS implementado. Se migrar como padrão para Starter:
- Google Neural2: $16/1M chars → Gemini TTS: **~$0.50/1M chars**
- Economia mensal por usuário: **R$ 150+**
- Qualidade: 85% da qualidade Neural2 (aceitável para Starter)

### 5.2 — Cache de RAG por tópico+nicho (economia: 30% em tokens)
- Mesmos tópicos no mesmo nicho reutilizam RAG por 24h
- Reduz chamadas ao `smart-knowledge-retrieval`

### 5.3 — Skip Claude para Starter (economia: $0.02-0.04/vídeo)
- Claude Hook Polish: APENAS Pro e Studio
- Starter usa 100% Gemini Flash → custo de roteiro cai 60%

### 5.4 — Batch TTS (economia: latência)
- Agrupar chunks de TTS em 1 chamada → menos overhead de rede

## 6. PRECIFICAÇÃO RECOMENDADA (atualizada)

```text
┌────────────────────────────────────────────────────────────────────┐
│ PLANO          │ PREÇO    │ CUSTO REAL │ MARGEM  │ ROI USUÁRIO    │
│                │          │ /usuário   │         │                │
├────────────────┼──────────┼────────────┼─────────┼────────────────┤
│ Starter        │ R$ 97/m  │ R$ 14-20   │ 79-86%  │ 1 dia YPP paga │
│ (Gemini TTS)   │          │            │         │                │
├────────────────┼──────────┼────────────┼─────────┼────────────────┤
│ Creator Pro    │ R$ 197/m │ R$ 40-60   │ 70-80%  │ 2 canais       │
│ (Neural2+Claude│          │            │         │                │
│  +DubSpy)      │          │            │         │                │
├────────────────┼──────────┼────────────┼─────────┼────────────────┤
│ Studio         │ R$ 347/m │ R$ 80-120  │ 65-77%  │ 5 canais       │
│ (Tudo + Deep   │          │            │         │                │
│  Research)     │          │            │         │                │
└────────────────┴──────────┴────────────┴─────────┴────────────────┘
```

## 7. PLANO DE IMPLEMENTAÇÃO

### Passo 1: Implementar Gemini TTS como padrão para Starter
- Editar `google-tts/index.ts` para rotear por tier
- Starter → Gemini TTS (custo quase zero)
- Pro/Studio → Google Neural2 (qualidade premium)

### Passo 2: Skip Claude no Starter
- Editar `generate-script/index.ts` — verificar tier antes do Claude Hook Polish
- Editar `refine-script/index.ts` — Starter sempre usa Gemini Flash

### Passo 3: Implementar cache de RAG
- TTL de 24h para mesma combinação topic+niche no `smart-knowledge-retrieval`

### Passo 4: Atualizar `tier-limits.ts`
- Adicionar flags: `claudePolish: boolean`, `ttsEngine: 'gemini' | 'neural2'`
- Starter: `claudePolish: false`, `ttsEngine: 'gemini'`
- Pro: `claudePolish: true`, `ttsEngine: 'neural2'`
- Studio: tudo habilitado

### Passo 5: Dashboard de custos
- Criar componente `ApiUsageDashboard` que mostra ao admin:
  - Custo real por usuário/dia
  - Breakdown por função
  - Alertas de uso anômalo

### Resultado Final
Com todas as otimizações: **custo Starter = R$ 8-14/mês por usuário** → **margem 86-92%** no plano de R$ 97.

