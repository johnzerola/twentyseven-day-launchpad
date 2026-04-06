
# Plano: Correções Críticas do Sistema — Auditoria de Qualidade

## Diagnóstico

O sistema tem engenharia sofisticada mas sofre de 5 falhas estruturais identificadas na auditoria. Este plano aborda as correções de maior impacto, priorizando o que muda a confiabilidade real do produto.

---

## PRIORIDADE 1: Honestidade Epistêmica nos Scores (FALHA CRÍTICA)

### Problema
CTR estimado, boost de thumbnail, packaging score e viral_score são apresentados como previsões mas são opiniões de LLM sem calibração. O usuário confia em números que não têm base empírica.

### Solução
**Arquivo: `supabase/functions/score-script/index.ts`**
- Adicionar campo `confidence_source` em cada score retornado: `"real"` (calibrado por backtest), `"heuristic"` (baseado em regra), `"ai_estimate"` (opinião do modelo)
- Incluir `calibration_status` no JSON de resposta: `"calibrated"` (se existe dado em `score_calibration` para o nicho), `"uncalibrated"` (se não)
- Se uncalibrated, adicionar disclaimer no `verdict`: "⚠️ Score sem calibração real — use como referência, não como previsão"

**Arquivo: `supabase/functions/generate-thumbnail-prompt/index.ts`**
- Mudar `expected_ctr_boost` para `estimated_ctr_boost_ai` e adicionar nota: `"source": "ai_estimate_uncalibrated"`

**Arquivo: `supabase/functions/packaging-score/index.ts`**
- Mesma mudança: adicionar `confidence_source: "ai_estimate"` e `calibration_note` ao response

**Arquivo: `supabase/functions/generate-titles/index.ts`**
- Adicionar `ctr_source: "ai_estimate"` em cada título gerado

**Arquivo: `src/components/scripts/ThumbnailGenerator.tsx`**
- Exibir badge "Estimativa IA" ao lado do CTR boost em vez de apresentar como dado real

---

## PRIORIDADE 2: Dotti — Memória Persistente e Contexto do Projeto Ativo

### Problema
A Dotti não tem memória entre sessões. Não sabe o que o usuário está editando. Quando uma ferramenta falha, pode gerar dados fictícios.

### Solução
**Arquivo: `supabase/functions/chat-assistant/index.ts`**
- **Memória entre sessões**: Já carrega `user_content_memory`, `video_performance`, `saved_scripts`, `onboarding_plans` etc. O gap real é que NÃO salva resumos de conversa. Adicionar: ao final de cada conversa (quando `conversationId` muda ou após 10+ mensagens), salvar um `conversation_summary` na tabela `ai_learning` com topic, decisões tomadas, e próximos passos acordados. Na próxima sessão, carregar os últimos 3 summaries como contexto.
- **Contexto do projeto ativo**: O `currentPage` já é enviado. Expandir: quando `currentPage === '/scripts'`, buscar o roteiro em edição mais recente (`saved_scripts` ORDER BY updated_at DESC LIMIT 1) e injetar título + primeiros 500 chars no system prompt
- **Proteção contra dados fictícios**: No `executeTool`, quando o resultado contém `error: "YouTube API quota exceeded"` ou timeout, a Dotti deve receber explicitamente `{ error: "...", data_reliability: "FAILED" }` em vez de resultado parcial. Adicionar instrução no system prompt: "Se uma ferramenta retornar `data_reliability: FAILED`, DIGA AO USUÁRIO que a busca falhou e NÃO invente dados."

**Migração de banco**: Nenhuma necessária — usar `ai_learning` existente com `source: "conversation_summary"`.

---

## PRIORIDADE 3: Taxonomia de Hooks por Mecanismo Psicológico

### Problema
O `hook_library` tem hooks por nicho mas sem classificação pelo mecanismo psicológico (curiosidade, ameaça, prova, contradição, identidade, timing, confissão, transformação).

### Solução
**Arquivo: `src/lib/viralDatabase.ts`**
- Adicionar constante `HOOK_MECHANISMS` com 8 categorias: `curiosity_gap`, `threat_warning`, `social_proof`, `contradiction`, `identity_trigger`, `time_pressure`, `confession`, `transformation`
- Cada mecanismo com: nome, descrição psicológica, exemplo de hook, quando usar, nicho ideal

**Arquivo: `supabase/functions/generate-script/index.ts`**
- No Phase 0 (Hook Generation), injetar a taxonomia de mecanismos no prompt e pedir que a IA identifique qual mecanismo está usando
- Adicionar no output do hook: `hook_mechanism: string` para que o score-script possa validar

**Arquivo: `supabase/functions/score-script/index.ts`**
- Adicionar no JSON de resposta: `hook_mechanism_detected: string` e `hook_mechanism_strength: number (1-10)`

---

## PRIORIDADE 4: Algoritmo do YouTube — Separar Oficial de Inferência

### Problema
O `YPP_2025_DIRECTIVE` mistura regras oficiais com folklore. "70% de retenção no primeiro meio minuto" não é política oficial do YouTube.

### Solução
**Arquivo: `supabase/functions/generate-script/index.ts`**
- Reescrever `YPP_2025_DIRECTIVE` separando em 3 blocos etiquetados:
  - `📋 OFICIAL (YouTube Help Center / Creator Academy)`: Tier 1 (500 subs + 3K horas), Tier 2 (1K subs + 4K horas), disclosure de IA obrigatório, políticas de conteúdo repetitivo
  - `📊 BENCHMARK OBSERVÁVEL (dados de canal)`: "Canais com retenção >60% nos primeiros 30s tendem a receber mais impressões" (linguagem probabilística)
  - `🔬 HIPÓTESE (inferência do sistema)`: "Teoria do Jenga — quebras de padrão a cada 20-30s podem melhorar retenção" (linguagem condicional)
- Cada regra no prompt marcada com seu nível de confiança

**Arquivo: `supabase/functions/chat-assistant/index.ts`**
- No bloco de monetização do system prompt, mesma separação: oficial vs benchmark vs hipótese
- Substituir "CTR > 4% após ajuste" por "CTR acima da média do nicho (benchmark: 4-6% para curiosidades, 3-5% para true crime)"

---

## PRIORIDADE 5: Quebras End-to-End — Fechar os 3 Gaps Mais Críticos

### Quebra 1: Nicho validado → Script Generator
**Arquivo: `src/components/dashboard/MicroNicheFinder.tsx`** (ou componente equivalente)
- Adicionar botão "Usar este nicho" que navega para `/scripts` com query param `?niche=X&subniche=Y`

**Arquivo: `src/pages/Scripts.tsx`**
- Ler query params e pré-preencher os campos de nicho no ScriptGenerator

### Quebra 2: Roteiro completo → Thumbnail Generator
**Arquivo: `src/components/scripts/ThumbnailGenerator.tsx`**
- Expandir props para aceitar `scriptSummary?: string` (primeiros 500 chars do roteiro + clímax)
- Quando disponível, enviar ao `generate-thumbnail-prompt` para que a thumbnail reflita o momento mais impactante, não só o título

**Arquivo: `supabase/functions/generate-thumbnail-prompt/index.ts`**
- Aceitar campo opcional `script_context` no body e usá-lo para melhorar a composição da thumbnail

### Quebra 5: Performance real → Retroalimenta hook_library
**Arquivo: `supabase/functions/extract-user-learnings/index.ts`**
- Após processar `script_performance_link`, se o vídeo teve retenção >60% no primeiro bloco, extrair o hook usado e fazer upsert no `hook_library` com `retention_score` real e `source: "user_real_data"`
- Se retenção <30%, marcar o hook_type como `underperforming` na `ai_learning`

---

## Resumo de Implementação

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/lib/viralDatabase.ts` | +1 constante (HOOK_MECHANISMS) |
| `src/components/scripts/ThumbnailGenerator.tsx` | Badge "Estimativa IA" + aceitar scriptSummary |
| `src/pages/Scripts.tsx` | Ler query params de nicho |
| `supabase/functions/score-script/index.ts` | confidence_source + hook_mechanism |
| `supabase/functions/generate-script/index.ts` | YPP reescrito + hook_mechanism no Phase 0 |
| `supabase/functions/generate-thumbnail-prompt/index.ts` | source labels + script_context |
| `supabase/functions/generate-titles/index.ts` | ctr_source label |
| `supabase/functions/packaging-score/index.ts` | confidence_source |
| `supabase/functions/chat-assistant/index.ts` | Memória de conversa + proteção contra dados fictícios + oficial vs inferência |
| `supabase/functions/extract-user-learnings/index.ts` | Retroalimentar hook_library com dados reais |
| Dashboard niche component | Botão "Usar este nicho" |

**Total: 11 arquivos, 0 migrações de banco, 7 edge functions**
