

# Análise de Custos e Precificação — 27-Day Launchpad

## PARTE 1: Custo Real por Usuário/Mês

### Consumo de IA por vídeo (3 vídeos/semana = ~12-15/mês)

O pipeline por vídeo usa estas chamadas Gemini (via `GOOGLE_AI_API_KEY` direto):

| Etapa | Modelo Gemini | Input tokens (est.) | Output tokens (est.) | Custo/vídeo |
|-------|---------------|---------------------|----------------------|-------------|
| Phase 0: Hook (gpt-5 → gemini-2.5-pro) | 2.5 Pro | ~4K in / ~2K out | | $0.025 |
| Phase 1: Draft (gemini-2.5-flash) | 2.5 Flash | ~8K in / ~6K out | | $0.017 |
| Phase 2: Refine (gemini-2.5-pro) | 2.5 Pro | ~12K in / ~8K out | | $0.095 |
| Phase 3: Fact-check (gpt-5-mini → flash) | 2.5 Flash | ~10K in / ~3K out | | $0.010 |
| Phase 4: Scene breakdown (flash-lite) | 2.5 Flash-Lite | ~6K in / ~4K out | | $0.002 |
| RAG search (Brave) | — | — | — | ~$0.003 |
| Score-script | 2.5 Flash | ~8K in / ~2K out | | $0.007 |
| Generate-titles (5 títulos) | 2.5 Flash | ~4K in / ~3K out | | $0.009 |
| Thumbnail prompt | 2.5 Flash | ~3K in / ~2K out | | $0.006 |
| Veo3 prompts (10 cenas) | 2.5 Pro | ~6K in / ~5K out | | $0.058 |
| **Subtotal IA/vídeo** | | | | **~$0.23** |

### TTS (narração por vídeo de ~10-15 min)

| Serviço | Caracteres (~15 min narração) | Custo |
|---------|-------------------------------|-------|
| Gemini TTS (primário) | ~15.000 chars | ~$0.06 |
| ElevenLabs (fallback) | ~15.000 chars | ~$0.18 |
| **Custo TTS médio** | | **~$0.08** |

### Dotti (chat-assistant) — média 20 interações/mês

| Item | Custo |
|------|-------|
| 20 conversas × ~5K in + 2K out (2.5 Pro) | ~$0.50 |
| Tool calls (5 por conversa avg) | ~$0.30 |
| **Subtotal Dotti/mês** | **~$0.80** |

### Outros consumos mensais

| Item | Custo/mês |
|------|-----------|
| Busca de canais/nichos (~10 scans) | ~$0.15 |
| Viral diagnosis, packaging-score | ~$0.10 |
| Self-learning/cron jobs | ~$0.05 |
| **Subtotal outros** | **~$0.30** |

### CUSTO TOTAL POR USUÁRIO/MÊS

```text
┌─────────────────────────────────────────────┐
│ 12 vídeos × $0.31 (IA + TTS)  = $3.72      │
│ Dotti (20 conversas)           = $0.80      │
│ Outros (scans, crons)          = $0.30      │
│ Supabase Edge (invocações)     = ~$0.10     │
│ Supabase DB (storage/bandwidth)= ~$0.50     │
│ Lovable Cloud hosting          = ~$1.00     │
│─────────────────────────────────────────────│
│ CUSTO TOTAL/USUÁRIO/MÊS       ≈ $6.42      │
│ EM REAIS (câmbio ~5.5)        ≈ R$ 35.30   │
└─────────────────────────────────────────────┘
```

Usuário pesado (15 vídeos + 40 conversas Dotti + Veo3 geração real): ~$12-15/mês (~R$ 66-82).

---

## PARTE 2: Precificação Recomendada

### Modelo sem tier grátis — direto ao ponto

| Plano | Preço BRL | Preço USD | Margem bruta | LTV 6 meses |
|-------|-----------|-----------|--------------|-------------|
| **Starter** | R$ 67/mês | $12/mês | ~47% | R$ 402 |
| **Pro** | R$ 127/mês | $23/mês | ~72% | R$ 762 |
| **Full** | R$ 197/mês | $36/mês | ~82% | R$ 1.182 |

### Justificativa

- **Starter (R$ 67)**: Cobre custo (~R$ 35) + margem saudável. Compete com ferramentas de IA genéricas (ChatGPT Plus R$ 100+). Inclui 12 vídeos, 20 conversas Dotti, busca básica.
- **Pro (R$ 127)**: Para quem produz 3+/semana com TTS ilimitado, análise de concorrentes, 3 canais. Margem de ~72% absorve usuários pesados.
- **Full (R$ 197)**: Canais ilimitados, API, white-label. Margem >80%.

### CAC Estimado (mercado BR YouTube faceless)

- CAC orgânico (YouTube/Instagram sobre o produto): R$ 15-30
- CAC pago (Meta Ads BR, nicho criadores): R$ 40-80
- **LTV/CAC ratio mínimo aceitável**: 3:1
- Com Starter (LTV R$ 402) e CAC R$ 60: ratio = 6.7:1 — excelente

### Churn esperado: 15-20%/mês (mercado BR de ferramentas creator)

Com 15% churn: lifetime médio = 6.7 meses → LTV Starter = R$ 449, Pro = R$ 851.

---

## PARTE 3: Monetização em 1 mês (12-15 vídeos) — É Realista?

### Resposta curta: **NÃO para AdSense. SIM para validação.**

### Os números reais

```text
Requisitos YPP (monetização):
  Tier 1: 500 subs + 3.000h watch time (12 meses)
  Tier 2: 1.000 subs + 4.000h watch time (12 meses)
  Shorts: 10M views em 90 dias

Canal novo postando 12-15 vídeos no primeiro mês:
  Cenário conservador: 500-2.000 views/vídeo → 6K-30K views totais
  Cenário otimista: 5.000-20.000 views/vídeo → 60K-300K views totais
  
  Subs ganhos (conservador): 30-150
  Subs ganhos (otimista): 300-1.500
  
  Watch time (15 vídeos × 10 min × 1.000 views avg × 40% retenção):
  = 1.000 horas (conservador)
  = 25% do necessário para Tier 2
```

### Cronograma realista

| Marco | Tempo estimado | Condição |
|-------|---------------|----------|
| Primeiros 1.000 subs | 2-4 meses | 3 vídeos/semana consistente |
| 4.000h watch time | 3-6 meses | Retenção >50%, vídeos 10-20 min |
| **Monetização Tier 2** | **3-6 meses** | Nicho bem escolhido + execução |
| Alternativa Shorts (10M views) | 1-3 meses | Se 1+ short viralizar (>500K) |

### O que a plataforma PODE entregar em 1 mês

A plataforma não garante monetização em 30 dias, mas entrega:
1. **12-15 roteiros otimizados** com hooks testados e anti-AI-slop
2. **Validação de nicho** com dados reais de saturação e RPM
3. **Base sólida** para o mês 2-3 onde o crescimento exponencial começa
4. **Vantagem competitiva** sobre quem produz sem análise (90% dos novos canais)

O cenário mais provável para um usuário disciplinado é monetizar entre o mês 3 e 6.

---

## Implementação proposta

Atualizar a `PricingSection.tsx` e `translations.ts` com os novos preços (remover tier grátis, ajustar para R$ 67 / R$ 127 / R$ 197) e adicionar uma seção "Quanto tempo para monetizar?" com o cronograma realista acima.

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/i18n/translations.ts` | Novos preços (R$ 67/127/197, $12/23/36, etc.) |
| `src/components/landing/PricingSection.tsx` | Features atualizados por tier, remover CTA "grátis", adicionar timeline de monetização |
| `src/components/landing/MonetizationSimulator.tsx` | Verificar se reflete dados reais |

