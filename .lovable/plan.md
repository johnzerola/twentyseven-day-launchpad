

# Auditoria Técnica Completa + Plano de Ação Avançado

---

## RELATÓRIO DE AUDITORIA — 4 PILARES

---

### PILAR 1: Banco de Dados e Performance

**Estado Atual:**
- ~40+ tabelas bem estruturadas com RLS policies aplicadas
- Knowledge base distribuída em 15+ tabelas (viral_titles_db, hook_library, script_knowledge, scene_prompt_knowledge, attention_engineering, etc.)
- Função `match_knowledge()` usando pgvector para busca semântica
- Cache via tabela `research_cache` com expiração por timestamp

**Problemas Identificados:**

1. **Queries sem índices otimizados** — `generate-script` faz 13 queries paralelas ao banco no início de cada geração. Tabelas como `viral_titles_db`, `script_knowledge`, `hook_library` são consultadas com ORDER BY em colunas como `effectiveness_score`, `retention_score`, `views` — provavelmente sem índices dedicados.

2. **Payload excessivo nas queries** — `generate-script` carrega 150 registros de `scene_prompt_knowledge`, depois filtra/ranqueia em memória no edge function. Isso deveria ser feito no Postgres com queries mais inteligentes.

3. **Sem connection pooling visível** — cada edge function cria um novo `createClient()` a cada request, sem reutilização.

4. **Cache naive** — `research_cache` é uma tabela simples com busca por `cache_key` exato. Sem TTL automático (cleanup manual), sem invalidação inteligente.

5. **Auto-learn sem deduplicação** — `deep-scan-video` insere em `script_knowledge`, `viral_content_library`, `scene_prompt_knowledge` sem verificar se entradas similares já existem, causando acúmulo de dados redundantes.

**Ações Recomendadas:**

- Criar índices compostos nas tabelas de knowledge (ex: `CREATE INDEX idx_script_knowledge_cat_score ON script_knowledge(category, effectiveness_score DESC)`)
- Migrar a filtragem de `scene_prompt_knowledge` para uma query SQL com scoring em vez de carregar 150 rows e filtrar em JS
- Implementar cleanup automático do `research_cache` via pg_cron ou trigger
- Adicionar constraint UNIQUE ou lógica de upsert no auto-learn para evitar duplicatas
- Criar materialized views para os "top hooks by niche" e "top titles by views" que já existem mas podem não estar atualizados

---

### PILAR 2: Mecanismos de Busca e Pesquisa

**Estado Atual:**
- Brave Search API com cache por `cache_key` exato
- pgvector com `match_knowledge()` para busca semântica (threshold 0.3, top 20)
- `knowledge_embeddings` para RAG
- Perplexity API disponível mas uso limitado
- YouTube Data API v3 para métricas reais

**Problemas Identificados:**

1. **RAG subutilizado** — a função `match_knowledge()` existe mas NÃO é chamada no pipeline principal de `generate-script`. O script usa queries diretas por tabela em vez de busca semântica unificada.

2. **Brave Search sem enriquecimento** — os resultados do Brave são cacheados como JSON bruto, sem extração de entidades, facts ou embeddings para alimentar o knowledge base.

3. **Sem re-ranking** — os resultados de busca não passam por um re-ranker que considere relevância ao tópico específico do roteiro.

4. **Embeddings possivelmente desatualizados** — não há mecanismo visível de atualização periódica dos embeddings quando novos dados entram nas tabelas fonte.

**Ações Recomendadas:**

- Integrar `match_knowledge()` no pipeline de `generate-script` como fonte complementar — buscar embeddings semanticamente próximos ao tópico
- Criar um pipeline de enriquecimento pós-Brave: extrair fatos → gerar embedding → inserir em `knowledge_embeddings`
- Adicionar re-ranking com Gemini Flash (barato/rápido) para selecionar os top-5 resultados mais relevantes ao tópico
- Implementar trigger que gera embedding automaticamente ao inserir em tabelas de knowledge

---

### PILAR 3: Motor de Geração de Roteiros e Prompts de Cenas

**Estado Atual:**
- `generate-script` usa Claude Sonnet 4 com streaming, system prompt de ~10K+ caracteres
- Pipeline de 2 fases: Phase 0 (Hook via Claude) → Phase 1 (Draft completo via Claude streaming)
- Anti-Slop Engine com lista de frases proibidas e "sinais de alma"
- Técnicas avançadas: Inner Monologue, Cliffhangers, Emotional Whiplash, Rule of Three, Chekhov's Gun
- Feedback absorption de avaliações anteriores (`ai_learning` table)
- 13 tabelas de knowledge alimentam o system prompt
- `generate-synced-prompts` e `generate-veo3-prompts` para cenas visuais
- `_shared/veo3-policy-filter.ts` para compliance com Veo3

**Problemas Identificados:**

1. **System prompt GIGANTE** — o prompt final pode ultrapassar 15-20K tokens com todo o knowledge injetado. Isso desperdiça contexto do Claude e pode diluir instruções críticas. O modelo pode "perder" regras importantes no meio de tanta informação.

2. **Sem priorização dinâmica de knowledge** — todas as 13 tabelas são carregadas independente do tópico. Se o roteiro é sobre "mitologia grega", carregar hooks de "finanças" é desperdício.

3. **`errResp` declarada duas vezes** — bug menor, a função está definida na linha 9 e novamente na linha 942.

4. **Policy filter com regex escapados incorretamente** — no arquivo `veo3-policy-filter.ts`, os regex usam `\\b` em vez de `\b` (double-escaped), o que pode não funcionar como esperado dependendo do contexto de parsing.

5. **Prompt de cenas sem sincronização temporal rigorosa** — `generate-synced-prompts` gera cenas mas a validação de coverage (sem gaps temporais) é superficial.

**Ações Recomendadas:**

- Implementar "Smart Context Selection" — usar embedding do tópico para selecionar apenas knowledge relevante (top-10 por similaridade) em vez de carregar tudo
- Reduzir o system prompt dividindo em seções priorizadas: CORE (sempre), RELEVANT (por tópico), SUPPLEMENTARY (se cabe no contexto)
- Corrigir a duplicação de `errResp`
- Adicionar Phase 2 de auto-revisão: após o draft, um segundo pass rápido com Gemini Flash para detectar violações das regras e sugerir fixes

---

### PILAR 4: Módulo de Clonagem e Processamento de Vídeos

**Estado Atual:**
- `deep-scan-video` faz engenharia reversa completa usando YouTube API + transcrição + thumbnail
- Usa Gemini Flash para análise rápida com tool calling
- Auto-learn: salva insights em 5+ tabelas (script_knowledge, viral_content_library, scene_prompt_knowledge, viral_titles_db, video_blueprints)
- Limite de 1 frame (thumbnail) para evitar timeouts
- Blocos de 20s para análise

**Problemas Identificados:**

1. **Timeout risk** — edge functions têm limite de ~60s. Com transcrições longas + AI call + auto-learn writes, vídeos >30min podem estourar o timeout.

2. **Sem fila de processamento** — cada clique dispara o pipeline completo síncrono. Se o usuário clica 3x, são 3 chamadas simultâneas à API do YouTube + AI.

3. **Transcrição limitada** — `extractTranscript` corta em 4000 chars e `timedBlocks` em 200 chars por bloco. Para vídeos longos, perde-se contexto narrativo importante.

4. **Sem fallback de transcrição** — se a API de legendas do YouTube falha (vídeos sem legenda), a análise fica muito pobre.

5. **Auto-learn sem validação de qualidade** — qualquer insight com `powerScore >= 7` é salvo. Não há verificação se o insight é realmente útil ou se é duplicata de algo existente.

**Ações Recomendadas:**

- Implementar processamento em 2 etapas: Etapa 1 (rápida, ~10s) retorna dados básicos do vídeo + thumbnail analysis. Etapa 2 (background) faz deep analysis com transcrição completa e salva resultado para consulta posterior.
- Adicionar debounce no frontend para evitar múltiplas chamadas
- Aumentar o limite de transcrição para 8000 chars com resumo inteligente (Gemini Flash resume em 2000 chars)
- Adicionar deduplicação no auto-learn: verificar se `video_id` já foi analisado antes de processar

---

## 3 SUGESTÕES DE ARQUITETURA AVANÇADA

### 1. RAG Inteligente com Re-Ranking Semântico

Em vez de carregar knowledge de 13 tabelas fixas, implementar um pipeline RAG unificado:

```text
Tópico do usuário
    → Gerar embedding do tópico
    → match_knowledge() com threshold 0.4
    → Re-rank com Gemini Flash (custo: ~$0.001)
    → Top-15 resultados mais relevantes
    → Injetar no system prompt de forma compacta
```

Benefício: System prompt 60% menor, knowledge 3x mais relevante, custo menor por request.

Implementação: 1 nova edge function `smart-knowledge-retrieval` que centraliza a busca, reutilizável por todos os pipelines.

### 2. Pipeline Assíncrono com Status em Tempo Real

Transformar os processos pesados (deep-scan, geração de cenas, auto-learn) em jobs assíncronos:

```text
Usuário clica "Clonar"
    → Edge function cria job na tabela `processing_jobs`
    → Retorna job_id imediatamente
    → Frontend mostra progress bar
    → Background: task-worker processa em etapas
    → Cada etapa atualiza status via Realtime
    → Frontend recebe updates em tempo real
```

Benefício: Zero timeouts, UX fluida, retry automático em falhas, processamento de vídeos de qualquer duração.

Implementação: Nova tabela `processing_jobs` + upgrade do `task-worker` existente + Supabase Realtime no frontend.

### 3. Auto-Evolução do Knowledge Base com Feedback Loop

Criar um ciclo fechado de aprendizado:

```text
Roteiro gerado → Avaliado (score-script) → Resultado real do vídeo (tracker)
    → Comparar previsão vs realidade
    → Identificar quais técnicas/hooks realmente funcionaram
    → Atualizar effectiveness_score das técnicas no knowledge base
    → Próximo roteiro usa scores calibrados pela realidade
```

Benefício: O sistema fica mais inteligente a cada vídeo publicado. Após 50 vídeos, as previsões de retenção e viralidade serão significativamente mais precisas.

Implementação: Upgrade do `backtest-scores` + novo campo `real_performance` nas tabelas de knowledge + job semanal de recalibração.

---

## Plano de Implementação (Priorizado)

| Prioridade | Ação | Impacto | Esforço |
|-----------|------|---------|---------|
| 1 | Criar índices nas tabelas de knowledge | Alto | Baixo |
| 2 | Corrigir bug `errResp` duplicado | Baixo | Mínimo |
| 3 | Smart Context Selection (RAG no generate-script) | Alto | Médio |
| 4 | Debounce + deduplicação no deep-scan | Médio | Baixo |
| 5 | Pipeline assíncrono para deep-scan | Alto | Alto |
| 6 | Auto-learn com deduplicação | Médio | Médio |
| 7 | Feedback loop de auto-evolução | Muito Alto | Alto |

Deseja que eu implemente algum desses itens agora?

