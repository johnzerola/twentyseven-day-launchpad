

# Diagnóstico V4.0 Completo — Estado Real do Sistema

## Números Reais do Banco de Dados (agora)

```text
╔═══════════════════════════╦═══════╦══════════╦═══════════════════════════════╗
║ Base de Dados             ║ Atual ║ Ideal    ║ Status                        ║
╠═══════════════════════════╬═══════╬══════════╬═══════════════════════════════╣
║ Knowledge Embeddings      ║    76 ║ 2.000+   ║ CRÍTICO — RAG quase inútil    ║
║ Content DNA               ║   146 ║ 1.000+   ║ FRACO                         ║
║ Prompt Library            ║    15 ║ 100+     ║ FRACO — só hooks              ║
║ Script Skill Scores       ║     2 ║ 50+      ║ FRACO — quase sem dados       ║
║ Channel Classification    ║   0/711║ 711/711  ║ CRÍTICO — 100% "general"      ║
║ Rejection Learnings       ║    26 ║ OK       ║ ✅ Funcional                   ║
║ Script Knowledge          ║   260 ║ OK       ║ ✅ Bom                         ║
║ Content Models            ║    48 ║ OK       ║ ✅ Bom (Hollywood DNA seeded)  ║
║ Hook Library              ║   343 ║ OK       ║ ✅ Bom                         ║
║ Hook Patterns             ║   210 ║ OK       ║ ✅ Bom                         ║
║ Scene Prompts             ║   430 ║ OK       ║ ✅ Bom                         ║
║ Attention Engineering     ║    72 ║ OK       ║ ✅ Bom                         ║
╚═══════════════════════════╩═══════╩══════════╩═══════════════════════════════╝
```

## O Motor de Roteiros — Está Bom?

**SIM, o código está excelente.** O pipeline é:
- **Phase 0**: Hook via Claude Sonnet 4 (60s, non-streaming)
- **Phase 1**: Rascunho completo via Claude Sonnet 4 (streaming)
- **Phase 2**: Refinamento via Claude Sonnet 4 (reescrita do hook + coerência lógica + emotion map)
- **Phase 3**: Avaliação dual GPT + Gemini (score mínimo 14/20)

O system prompt tem 900+ linhas com:
- Hollywood Masterclass (10 princípios de Breaking Bad, Chernobyl, etc.)
- Niche-to-Reference Mapping (true_crime → MrBallen, horror → Hitchcock, etc.)
- Anti-Slop Engine (30+ frases proibidas)
- Emotion Map (alternância emocional obrigatória)
- Protocolo de Coerência Lógica (resolve o problema do cartório/banco)
- Chekhov's Gun, Inner Monologue, Emotional Whiplash, Rule of Three
- Voice DNA injection + Rejection Learning Loop

**O problema NÃO é o código — é que o código depende de dados que não existem.**

## 3 Problemas Críticos que Impedem Qualidade Netflix/MrBeast

### 1. RAG Quebrado (76 embeddings de 2.000+ necessários)
O `smart-knowledge-retrieval` busca contexto semântico para o Claude. Com apenas 76 vetores (51 do youtube_knowledge, 19 do content_dna, 5 do script_knowledge), o Claude recebe contexto genérico ou NADA. Os 260 registros de script_knowledge e 48 content_models NÃO estão no RAG.

### 2. Taxonomia Inexistente (711/711 canais = "general")
O `classify-channels` existe mas NUNCA foi executado. Sem classificação, o sistema não pode fazer benchmarks por nicho, não pode recomendar referências dark vs educational, e o Dotti não sabe a diferença entre true crime e restoration.

### 3. Prompt Library Rasa (15 templates, só hooks)
Existem 9 hooks, 2 CTAs, 2 transitions, 1 tension, 1 escalation. Faltam templates de: character_intro, emotional_peak, cliffhanger, resolution, cold_open, pattern_interrupt — que o Claude poderia usar como referência.

## Sobre Descoberta de Canais
Você tem razão — o sistema tem 711 canais mas a maioria foi adicionada em lote. O `discover-viral-channels` usa a API do YouTube que retorna resultados baseados em relevância/popularidade, NÃO no padrão "incógnito" que revela canais emergentes. Para simular o comportamento que você descreveu (navegar → assistir → voltar → receber recomendações), seria necessário usar a YouTube Data API com parâmetros `relatedToVideoId` em cadeia — isso é possível mas consome muita quota.

## Plano V4.0 — 3 Ações de Alto Impacto

### Ação 1: Backfill Massivo de Embeddings
Executar `backfill-embeddings` expandido para indexar TODOS os registros das tabelas: `script_knowledge` (260), `content_models` (48), `attention_engineering` (72), `hook_library` (343 — top 100), `content_dna` (146). Meta: de 76 → 800+ vetores.

**Impacto**: RAG funcional — o Claude recebe contexto PRECISAMENTE relevante ao tópico/nicho.

### Ação 2: Executar classify-channels
Rodar o `classify-channels` nos 711 canais para eliminar o label "general". Classificar em: `dark_storytelling`, `true_crime_dark`, `restoration`, `animal_survival`, `horror_dark`, `educational`, `entertainment`, `curiosity`, etc.

**Impacto**: Benchmarks por nicho + recomendações de referência + Dotti contextual.

### Ação 3: Expandir Prompt Library (de 15 → 80+)
Adicionar templates para: `cold_open` (5 por nicho), `character_intro` (10), `emotional_peak` (10), `cliffhanger` (10), `resolution` (5), `pattern_interrupt` (10), `tension_build` (10), `reveal` (5).

**Impacto**: O Claude tem exemplos concretos de cada técnica para cada nicho.

### Ação Bônus: Discovery Chain (Simulador Incógnito)
Upgrade do `discover-viral-channels`: em vez de buscar por keyword, usar `relatedToVideoId` em cadeia (pegar um vídeo viral → buscar relacionados → filtrar canais <50k subs com vídeos >100k views). Simula exatamente o padrão incógnito que você descreveu.

## Arquivos a Modificar

1. `supabase/functions/seed-elite-knowledge/index.ts` — adicionar 65+ templates à prompt_library
2. `supabase/functions/discover-viral-channels/index.ts` — adicionar modo "chain discovery" via relatedToVideoId
3. Executar `backfill-embeddings` e `classify-channels` (já existem, só precisam rodar)

## Ordem de Execução

| # | Ação | Impacto | Complexidade |
|---|------|---------|-------------|
| 1 | Expandir prompt_library (15→80+) | ALTO | Baixa |
| 2 | Backfill embeddings (76→800+) | CRÍTICO | Média (precisa executar) |
| 3 | Classify channels (0→711) | ALTO | Baixa (precisa executar) |
| 4 | Discovery Chain (incógnito) | MÉDIO | Média |

