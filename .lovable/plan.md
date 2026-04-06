
# Plano de Implementação — Melhorias Prioritárias do Monetiza27

## Resumo
11 melhorias organizadas em 4 fases de execução, priorizadas por impacto e dependência.

---

## Fase 1 — Correções Imediatas (Quick Wins)

### 1.1 Corrigir import duplicado em chat-assistant
- **Arquivo:** `supabase/functions/chat-assistant/index.ts`
- **Problema:** Linha 1 importa `callGeminiOpenAICompat, generateEmbedding`, linha 2 importa `callGeminiOpenAICompat` novamente — causa erro de deploy
- **Fix:** Remover linha 2, manter apenas linha 1

### 1.2 Thumbnail com geração de imagem real
- **Arquivo:** `supabase/functions/generate-thumbnail-prompt/index.ts` — adicionar modo `generate_image: true` que, além de retornar prompts, chama o Gemini image gen (mesmo padrão do `generate-segment-image`)
- **Arquivo:** `src/components/scripts/ThumbnailGenerator.tsx` — adicionar botão "Gerar Imagem" por variante que chama a nova função, exibe preview base64, e permite download/upload ao storage bucket `media`
- **Modelo:** `google/gemini-3.1-flash-image-preview` com `modalities: ["image", "text"]`

---

## Fase 2 — Closed-Loop (YouTube OAuth → Performance → Aprendizado)

### 2.1 Conectar YouTube OAuth → video_performance real
- **Arquivo novo:** `supabase/functions/sync-oauth-performance/index.ts`
- Usa `youtube_oauth_tokens` para buscar métricas reais via YouTube Analytics API (CTR, retenção, impressões)
- Popula a tabela `video_performance` com dados D1/D3/D7/D30 reais (campos `ctr_percent`, `avg_retention_percent`, `avg_view_duration_seconds`)
- Cruza com `script_performance_link` para vincular roteiros a resultados

### 2.2 Closed-loop: métricas → calibração de scores
- **Arquivo:** `supabase/functions/extract-user-learnings/index.ts` — estender para consumir dados OAuth reais (não apenas YouTube Data API pública)
- **Arquivo:** `supabase/functions/backtest-scores/index.ts` — alimentar `score_calibration` comparando `predicted_viral_score` vs views reais D7
- Resultado: pesos do title-score e script-score se auto-ajustam com dados reais

---

## Fase 3 — Refatoração Estrutural

### 3.1 Refazer chat-assistant em módulos
Quebrar o arquivo de 1.847 linhas em partes importáveis dentro do mesmo diretório (Edge Functions não suportam imports entre funções, mas suportam `_shared/`):
- `supabase/functions/_shared/tubebot-tools.ts` — definições dos 19 tools (TUBEBOT_TOOLS)
- `supabase/functions/_shared/tubebot-executor.ts` — função `executeTool()` com todo o switch/case
- `supabase/functions/_shared/tubebot-system-prompt.ts` — system prompt e contexto
- `supabase/functions/chat-assistant/index.ts` — reduzido a ~200 linhas: auth, context injection, AI loop

### 3.2 Consolidar edge functions similares
Fundir pares redundantes (reduzir de 100+ para ~70):
- `find-competitors` + `find-competitors-ai` → manter apenas `find-competitors-ai`
- `generate-30day-plan` + `generate-adaptive-plan` → unificar em `generate-plan` existente
- `seed-reference-channels` + `seed-elite-knowledge` + `seed-complete-knowledge` → `data-seeding-engine` (já existe)
- `generate-script` + `generate-script-short` → unificar com param `format: "short" | "long"`
- Deletar funções não utilizadas: `auto-intelligence-cron`, `daily-data-ingestion`, `evolve-patterns`, `calibrate-knowledge`

---

## Fase 4 — Fortalecimento dos Diferenciais

### 4.1 Anti-Slop Engine — documentar e expor
- Já existe no prompt do `generate-script` — extrair as 13 "Soul Signals" para `_shared/anti-slop-rules.ts`
- Reutilizar em `generate-titles`, `generate-thumbnail-prompt`, `chat-assistant`
- Adicionar badge "Anti-Slop ✓" no UI quando roteiro passa validação

### 4.2 Audio mastering pipeline — manter e ampliar
- Pipeline de 12 estágios já funciona via Web Audio API — sem mudanças necessárias
- Adicionar preset "YouTube Shorts" otimizado para mobile speakers (boost 2-4kHz)

### 4.3 Title Score statistical engine — manter
- Abordagem baseada em dados com `viral_titles_db` já é sólida — sem mudanças

### 4.4 Smart Knowledge Retrieval (RAG) — manter
- `match_knowledge` com pgvector funciona — sem mudanças

### 4.5 Channel Voice Profile — manter
- `learn-channel-voice` já persiste DNA do canal — sem mudanças

---

## Arquivos Modificados/Criados

| Ação | Arquivo |
|------|---------|
| Edit (1 linha) | `supabase/functions/chat-assistant/index.ts` |
| Edit | `supabase/functions/generate-thumbnail-prompt/index.ts` |
| Edit | `src/components/scripts/ThumbnailGenerator.tsx` |
| Create | `supabase/functions/sync-oauth-performance/index.ts` |
| Create | `supabase/functions/_shared/tubebot-tools.ts` |
| Create | `supabase/functions/_shared/tubebot-executor.ts` |
| Create | `supabase/functions/_shared/tubebot-system-prompt.ts` |
| Create | `supabase/functions/_shared/anti-slop-rules.ts` |
| Refactor | `supabase/functions/chat-assistant/index.ts` (reduce to ~200 lines) |
| Delete | ~8 redundant edge functions |
| Edit | `supabase/config.toml` (add sync-oauth-performance) |

## Ordem de Execução
1. Fix import duplicado (5 min)
2. Thumbnail com imagem real (30 min)
3. sync-oauth-performance + closed-loop (45 min)
4. Refatorar chat-assistant em módulos (40 min)
5. Consolidar/deletar edge functions redundantes (30 min)
6. Anti-Slop compartilhado (15 min)
