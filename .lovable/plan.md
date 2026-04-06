

# Plano: Remediação Sistêmica — Fase 2 (Gaps Restantes da Auditoria)

## O que JA FOI CORRIGIDO (não repetir)
- Epistemic honesty nos scores (confidence_source, calibration_status) ✅
- Dotti memory entre sessões (conversation_summary) ✅
- Dotti active script context ✅
- Dotti data_reliability: "FAILED" em tool errors ✅
- Hook taxonomy (HOOK_MECHANISMS constant) ✅
- YPP directive rewrite (3 tiers) ✅
- Thumbnail script_context ✅
- extract-user-learnings hook feedback loop ✅

## GAPS RESTANTES (7 itens priorizados)

### 1. Dotti Persona Rewrite — De "Gênio Universal" para "Sistema de Decisão"
O system prompt atual em `chat-assistant` (linha 1587) diz: "o consultor estratégico mais poderoso do mundo", "conselho de 3 experts: ex-CEO do YouTube, ex-diretor da Netflix, ex-diretor do Google". Isso gera overclaim.

**Acao:** Reescrever persona para "sistema operacional de decisão baseado em dados", remover hipérboles, adicionar framework decisório explícito: diagnosticar → buscar sinal → recomendar → validar. Reduzir instruções de "26 FERRAMENTAS" para hierarquia de prioridade (Tier 1: dados reais YouTube API, Tier 2: análise AI, Tier 3: pesquisa externa).

### 2. Audio Mastering — Remover Claims Falsos
`src/lib/audioMastering.ts` linha 2: "Superior to Adobe Podcast". Claim não comprovado.

**Acao:** Renomear para "Audio Processing Pipeline v5" e remover comparações com produtos comerciais. Adicionar disclaimer: "Processamento via Web Audio API — para áudios >10min, recomendamos processamento server-side."

### 3. Backtest Engine — Fix Bug de `AI_URL` Indefinido
`supabase/functions/backtest-scores/index.ts` linha ~120 usa `AI_URL` que nunca é declarado. Isso crasharia a meta-analysis.

**Acao:** Substituir `AI_URL` pela URL correta do Gemini OpenAI compat (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`).

### 4. Análise Pareada — Vencedores vs Perdedores
O find-outliers encontra vencedores mas não contrasta com perdedores equivalentes do mesmo canal.

**Acao:** No `find-outliers`, após identificar outliers, buscar 3-5 vídeos do MESMO canal com performance abaixo da média. Retornar campo `paired_losers` com título, views e delta. Isso separa correlação de causalidade.

### 5. Smart Knowledge Retrieval — Threshold Mínimo + Decay Temporal
O `match_knowledge` RPC usa threshold 0.25 (muito baixo) e não penaliza conhecimento antigo.

**Acao:** No `chat-assistant` (linha 1457), aumentar `match_threshold` de 0.25 para 0.40. Adicionar filtro de recência: priorizar embeddings dos últimos 6 meses no re-ranking.

### 6. Niche Saturation Detection
O sistema recomenda nichos virais sem detectar saturação (50 canais novos/semana).

**Acao:** No `analyze_niche` tool do chat-assistant (linhas 624-674), adicionar query de contagem de canais criados nos últimos 90 dias no mesmo nicho. Retornar `saturation_velocity: X novos canais/mês` e flag `saturating: true/false`.

### 7. Dotti Tool Dedup — Merge Ferramentas Redundantes
`claude_deep_analysis` e `gpt_expert_analysis` são quase idênticos na prática. `find_competitors` e `find_competitors_ai` fazem a mesma coisa.

**Acao:** Manter `expert_analysis` (uma ferramenta) que usa Gemini internamente com os 4 estilos (strategic, creative, analytical, diagnostic). Remover `claude_deep_analysis` como tool separado (Claude continua acessível internamente se necessário). Manter `find_competitors` e remover `find_competitors_ai` da lista de tools.

---

## Resumo de Implementacao

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/chat-assistant/index.ts` | Rewrite persona, merge tools (26→22), threshold 0.25→0.40, saturation query no analyze_niche |
| `src/lib/audioMastering.ts` | Remover claim "Superior to Adobe Podcast", disclaimer |
| `supabase/functions/backtest-scores/index.ts` | Fix AI_URL bug |
| `supabase/functions/find-outliers/index.ts` | Adicionar paired_losers |

## Detalhes Tecnicos
- 4 arquivos editados (1 client-side, 3 edge functions)
- 0 database migrations
- Todas as mudancas sao aditivas ou de refinamento — zero risco de quebra

