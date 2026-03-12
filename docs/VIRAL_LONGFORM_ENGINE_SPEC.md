# Viral Long-Form Engine — Especificação Técnica Completa

**Versão:** 1.0 | **Data:** 2026-03-12

---

## 1. RESUMO EXECUTIVO

O Viral Long-Form Engine é um sistema automatizado de produção de vídeos long-form (20–60min) para YouTube, projetado para detectar nichos emergentes, reverse-engineer vídeos virais, gerar roteiros otimizados para retenção e monetização, e produzir scene prompts prontos para AutoFlow/Veo3. O pipeline Ensemble utiliza 5 modelos de IA em cascata (GPT-5 → Gemini Flash → Gemini Pro → GPT-5-mini → Gemini Flash-Lite) com RAG via Brave Search, atingindo um custo-alvo de ~R$10/vídeo de 30min. O resultado esperado é a monetização de canais em ≈30 dias com escala para 50+ canais simultâneos.

---

## 2. ESPECIFICAÇÃO TÉCNICA

### 2.1 Arquitetura de Alto Nível

```
┌────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                       │
│  Dashboard ─ Scripts ─ Channels ─ ViralDB ─ Workflow          │
└──────────┬─────────────────────────────────────────────────────┘
           │ Supabase SDK
┌──────────▼─────────────────────────────────────────────────────┐
│                    SUPABASE LAYER                              │
│  Auth ─ RLS ─ Realtime ─ Storage (media bucket)               │
│                                                                │
│  ┌─── Edge Functions (39+) ──────────────────────────────┐    │
│  │ video-orchestrator     → Ensemble Pipeline (5 fases)   │    │
│  │ reverse-engineer-video → Análise reversa de virais     │    │
│  │ task-worker            → Queue processor + retry       │    │
│  │ api-proxy              → Rate-limit + quota control    │    │
│  │ daily-data-ingestion   → Cron: nichos + emergentes     │    │
│  │ weekly-deep-research   → Cron: Perplexity Sonar-Pro    │    │
│  │ detect-emerging-channels → Scanner de canais novos     │    │
│  │ generate-synced-prompts  → AutoFlow format [V#-S#]     │    │
│  │ generate-veo3-video      → Veo3 API executor           │    │
│  │ chat-assistant           → Onboarding + suporte        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌─── Database (30+ tables) ─────────────────────────────┐    │
│  │ INFRAESTRUTURA: api_usage, task_queue, execution_logs  │    │
│  │ PRODUÇÃO: video_projects, scenes, characters, prompts  │    │
│  │ INTELIGÊNCIA: viral_titles_db, emerging_channels       │    │
│  │ CONHECIMENTO: script_knowledge, youtube_knowledge      │    │
│  │ ANÁLISE: reverse_engineering_analyses, video_blueprints │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────────────┐
│                    EXTERNAL APIS                               │
│  Lovable AI Gateway (GPT-5, Gemini) ─ Brave Search            │
│  YouTube Data API v3 ─ Perplexity Sonar-Pro ─ Claude API      │
│  ElevenLabs TTS ─ Google Veo3 ─ Web Speech API (fallback)     │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 APIs Utilizadas

| API | Uso | Prioridade | Fallback |
|-----|-----|-----------|----------|
| Lovable AI Gateway | Ensemble LLM (GPT-5, Gemini) | Obrigatória | — |
| Brave Search | RAG contexto web | Obrigatória | Cache only |
| YouTube Data API v3 | Métricas factuais | Obrigatória | research_cache |
| Perplexity Sonar-Pro | Deep Research semanal | Recomendada | Brave + Gemini |
| Claude API | Análise avançada roteiros | Recomendada | Gemini Pro |
| ElevenLabs | TTS premium | Opcional | Web Speech API |
| Google Veo3 | Geração vídeo | Opcional | Image + Ken Burns |

### 2.3 Fórmula Viral Score

```
viral_score = (
  0.35 × (video_views / avg_views_channel) +
  0.25 × min(1, views_per_hour / median_vph_niche) +
  0.15 × (comments / views) × 1000 +
  0.15 × (likes / views) × 100 +
  0.10 × upload_frequency_score
) × 100

Thresholds:
  ≥ 85 → BREAKOUT (investigar imediatamente)
  70-84 → FORTE CANDIDATO (monitorar, clonar estrutura)
  50-69 → MONITORAR (acompanhar evolução)
  < 50 → IGNORAR
```

### 2.4 Ensemble LLM Pipeline

```
FASE 0: HookGen (GPT-5)
  Input: RAG context + viral_patterns + psychology_triggers
  Output: 10 hooks [{hook_text, hook_type, retention_score, predicted_ctr}]
  Custo: ~$0.01

FASE 1: DraftScript (Gemini Flash)
  Input: best_hook + RAG + script_knowledge
  Output: Roteiro rascunho com [INTRO][DEV1][DEV2][CLIMAX][CONCLUSION]
  Custo: ~$0.005

FASE 2: RefineScript (Gemini Pro)
  Input: draft + viral_patterns + characters
  Output: {title, script, scene_blueprint[], characters[]}
  Custo: ~$0.02

FASE 3: FactCheck (GPT-5-mini)
  Input: refined_script
  Output: {corrected_script, issues_found, corrections[]}
  Custo: ~$0.005

FASE 4: SceneBreak (Gemini Flash-Lite)
  Input: final_script + autoflow_rules + characters
  Output: scenes[] com AutoFlow format [V1-S#]
  Custo: ~$0.003

TOTAL ENSEMBLE: ~$0.043/execução (~R$0.22)
```

### 2.5 Jobs & Cron

| Job | Frequência | Edge Function | Descrição |
|-----|-----------|---------------|-----------|
| daily_ingestion | Diário 03:00 UTC | daily-data-ingestion | Varredura nichos + canais emergentes |
| weekly_research | Dom 04:00 UTC | weekly-deep-research | Deep research via Perplexity |
| task_worker | A cada 5 min | task-worker | Processa task_queue pendentes |
| auto_enrich | Diário 05:00 UTC | auto-enrich-worker | Enriquece vídeos com NLP |
| viral_score_recalc | Semanal Seg 02:00 | monetiza-score | Recalcula scores com novos dados |

### 2.6 Estratégia de Cache

```
research_cache TTL:
  - Brave Search: 24h
  - YouTube metrics: 12h
  - Deep Research (Perplexity): 7 dias
  - Viral patterns: 30 dias

Regras de economia:
  1. Sempre consultar cache ANTES de API externa
  2. Deduplicar queries por cache_key normalizado
  3. Batch inserts (não 1-a-1)
  4. Debounce 2s em UI para evitar chamadas duplicadas
  5. Throttle: max 1 orchestrator/minuto por usuário
```

### 2.7 Métricas (KPIs)

| KPI | Meta 30 dias | Meta 90 dias |
|-----|-------------|-------------|
| Custo por vídeo 30min | ≤ R$10 | ≤ R$5 |
| Taxa de monetização | 30% canais | 60% canais |
| Retenção média | ≥ 40% | ≥ 55% |
| CTR thumbnails | ≥ 5% | ≥ 8% |
| Scripts gerados/dia | 10 | 50 |
| Canais gerenciados | 3-5 | 20-50 |

### 2.8 Segurança & Ética

1. **Não copiar conteúdo literal** — apenas estruturas e padrões
2. **TOS YouTube** — sem clickbait enganoso, sem spam de tags
3. **Vozes clonadas** — proibido sem consentimento explícito
4. **Rate limiting** — respeitar quotas de todas as APIs
5. **RLS** — todas as tabelas protegidas por user_id
6. **Dados pessoais** — não armazenar dados de terceiros sem consentimento

---

## 3. PROMPTS ENSEMBLE

### 3.1 HookGen Prompt (GPT-5)

```
SYSTEM: You are an elite YouTube hook generator and retention strategist.
Create 10 viral hooks in {{lang}}. Each must:
- Grab attention in first 3 seconds
- Use psychological triggers (curiosity gap, shock, authority, FOMO)
- Include retention loop hints (what keeps viewer watching)
- Predict CTR based on pattern analysis

USER: Generate 10 hooks for niche "{{niche}}" inspired by "{{title}}".

WEB CONTEXT:
{{rag_summary}}

TOP PERFORMING HOOKS IN THIS NICHE:
{{existing_hooks}}

PSYCHOLOGICAL TRIGGERS DATABASE:
{{psychology_triggers}}

Output: JSON array [{hook_text, hook_type, retention_score (1-10), predicted_ctr (0.0-1.0), retention_loop_hint}]
```

### 3.2 LongForm Draft Prompt (Gemini Flash)

```
SYSTEM: Generate a {{duration_minutes}}-minute YouTube script draft in {{lang}}.
Start with the hook. Include segment markers [INTRO], [DEV1], [DEV2], [CLIMAX], [CONCLUSION].
Write naturally, not AI-sounding. Include mini-cliffhangers every 10-15 seconds.

USER: Draft script for "{{title}}" in "{{niche}}".
Duration: ~{{duration_minutes}} min
HOOK: "{{hook_text}}"

CONTEXT:
{{rag_summary}}

KNOWLEDGE:
{{script_knowledge}}
```

### 3.3 Refine Prompt (Gemini Pro)

```
SYSTEM: You are a senior Netflix screenwriter + YouTube algorithm expert.
Refine this draft into a polished, viral-optimized script.

Requirements:
1. Maintain hook power in first 5 seconds
2. Add curiosity loops every 30-60 seconds
3. Include character_consistency_blocks for each character
4. Generate scene_blueprint JSON array for visual production
5. Optimize for {{duration_minutes}}-minute runtime
6. Title must be SEO-optimized and clickable

USER: DRAFT SCRIPT:
{{draft}}

VIRAL PATTERNS:
{{patterns}}

EXISTING CHARACTERS:
{{characters}}

Output the refined script followed by:
- title (string)
- scene_blueprint (JSON array of segments)
- characters (JSON array with character_consistency_block)
```

### 3.4 SceneBreak Prompt (Gemini Flash-Lite)

```
SYSTEM: Break YouTube scripts into ~8-second cinematic scenes for AutoFlow/Veo3.
Each scene MUST use format: [V1-S{{scene_number}}]
Include: camera angle, lens, lighting, environment, character refs, action.

USER: Break this script into scenes:
{{final_script}}

CHARACTER REFERENCES:
{{characters_with_consistency_blocks}}

AUTOFLOW RULES:
{{autoflow_templates}}

Output: JSON array [{
  scene_id: number,
  autoflow_tag: "[V1-S#]",
  duration_seconds: 8,
  character_consistency_block: string,
  visual_style: string,
  camera_details: string,
  lighting_details: string,
  environment_details: string,
  action_description: string,
  eight_second_clip_intent: string,
  tts_text: string,
  negative_prompt: string
}]
```

---

## 4. ONBOARDING AGENT UX

### 4.1 Texto da Bolinha de Ajuda

> "👋 Olá! Sou seu assistente de crescimento no YouTube. Posso te ajudar a encontrar seu nicho ideal, analisar seus concorrentes e criar um plano de monetização em 30 dias. Vamos começar?"

### 4.2 Fluxo de Conversa Condicional

```
1. "Você já tem um canal no YouTube?"
   → SIM: "Cole o link do canal" → analyze-channel → extrair nicho/subs/views
   → NÃO: "Qual tipo de conteúdo te interessa?"

2. "Quanto tempo por dia você pode dedicar?"
   → < 1h: plano_lite (3 vídeos/semana, shorts + 1 long)
   → 1-3h: plano_standard (5 vídeos/semana)
   → 3h+: plano_intensivo (daily + long-form)

3. "Qual seu objetivo principal?"
   → MONETIZAÇÃO: foco em RPM alto, nichos lucrativos
   → PAIXÃO: foco em engajamento e comunidade
   → AMBOS: balanceado

4. "Idioma principal dos vídeos?"
   → pt/en/es/pl/de → configura language padrão

5. Gerar plano personalizado → salvar em onboarding_plans
```

### 4.3 Check Semanal (7-day review)

```
Procedimento automático (dom 10:00 UTC via chat-assistant):

1. Coletar métricas:
   - "Quantos vídeos você publicou esta semana?"
   - "Qual foi o vídeo com mais views? (compartilhe print ou link)"

2. Avaliar progresso:
   - Se views > meta: "Excelente! Vamos dobrar a aposta nesse formato."
   - Se views < meta: "Vamos pivotar. Analisei seus dados e sugiro..."

3. Ações de pivô:
   - CTR < 3%: sugerir novos títulos/thumbnails
   - Retenção < 30%: analisar hook e pacing
   - Views estagnadas: sugerir nicho adjacente

4. Próximos passos: gerar 3 ideias de vídeo para a semana
```

---

## 5. ROADMAP 90 DIAS

### Fase 1: Fundação (Dias 0–7)
- [x] ~~DB schema + indexes~~
- [x] ~~video-orchestrator ensemble pipeline~~
- [x] ~~reverse-engineer-video function~~
- [x] ~~task-worker com todos os task types~~
- [ ] Teste end-to-end com 3 vídeos piloto
- [ ] Botão "Gerar Projeto" na UI Scripts

### Fase 2: Inteligência (Semanas 1–4)
- [ ] Cron jobs ativados (daily_ingestion, weekly_research)
- [ ] Dashboard de pipeline com logs em tempo real
- [ ] Reverse engineering batch (top 50 virais por nicho)
- [ ] A/B testing de hooks (2 variantes por título)
- [ ] Onboarding agent conversacional ativo

### Fase 3: Escala (Meses 1–3)
- [ ] Scale Mode: gerenciar 10+ canais simultâneos
- [ ] AutoFlow executor automatizado (queue → generate → download)
- [ ] ML recalibration do viral_score (XGBoost)
- [ ] Multi-language pipeline (pt/en/es/pl/de)
- [ ] Analytics avançado: ROI por canal, custo/vídeo, retention heatmaps

---

## 6. CHECKLIST DE VALIDAÇÃO (30 dias)

### Canais Piloto (3 canais)
1. **Canal A** — Nicho existente do usuário (controle)
2. **Canal B** — Nicho sugerido pela IA (alta oportunidade)
3. **Canal C** — Nicho faceless + alto RPM (teste de escala)

### Métricas de Sucesso

| Métrica | Sucesso | Parcial | Falha |
|---------|---------|---------|-------|
| Vídeos publicados | ≥12 | 6-11 | <6 |
| Views totais | ≥10k | 3k-10k | <3k |
| Inscritos ganhos | ≥500 | 100-500 | <100 |
| CTR médio | ≥5% | 3-5% | <3% |
| Retenção média | ≥40% | 25-40% | <25% |
| Monetização ativa | SIM | Pendente | NÃO |
| Custo total IA | ≤R$120 | R$120-300 | >R$300 |

---

## 7. EXEMPLOS DE OUTPUTS

### 7.1 Sample Hook List

```json
[
  {"hook_text": "Ninguém te contou que o YouTube mudou TUDO em 2026...", "hook_type": "curiosity", "retention_score": 9, "predicted_ctr": 0.12},
  {"hook_text": "Eu analisei 10.000 canais e descobri o padrão que separa os que explodem dos que morrem", "hook_type": "authority", "retention_score": 8, "predicted_ctr": 0.11},
  {"hook_text": "Este nicho está gerando R$50.000/mês e NINGUÉM está falando sobre ele", "hook_type": "shock", "retention_score": 9, "predicted_ctr": 0.14},
  {"hook_text": "Se você não fizer isso nos próximos 7 dias, vai perder a maior janela do YouTube", "hook_type": "urgency", "retention_score": 7, "predicted_ctr": 0.09}
]
```

### 7.2 Sample Script Intro (60s)

```
[INTRO]
[HOOK - 0:00-0:05]
Ninguém te contou que o YouTube mudou TUDO em 2026... e o que eu vou te mostrar nos próximos 20 minutos pode ser a diferença entre você ganhar R$50 mil por mês ou continuar no zero.

[SETUP - 0:05-0:30]
Eu passei as últimas 72 horas analisando os dados de mais de 10 mil canais que monetizaram nos últimos 90 dias. E o padrão que eu encontrei... vai contra tudo que os "gurus" ensinam.

[RETENTION LOOP 1 - 0:30-0:45]
Mas antes de te mostrar o padrão exato, preciso te explicar POR QUE o algoritmo de 2026 funciona de um jeito completamente diferente. E isso começa com uma mudança que o YouTube fez em silêncio no dia 15 de janeiro...

[CLIFFHANGER - 0:45-1:00]
O mais assustador? 99% dos criadores nem perceberam essa mudança. E os que perceberam... estão explodindo. Vou te mostrar os números exatos daqui a pouco.
```

### 7.3 Sample Scene Prompts (3 scenes)

```json
[
  {
    "scene_id": 1,
    "autoflow_tag": "[V1-S1]",
    "duration_seconds": 8,
    "character_consistency_block": "Male narrator, 30s, dark hair, wearing black turtleneck, confident posture",
    "visual_style": "Cinematic dark studio, moody blue-orange grading",
    "camera_details": "Medium close-up, 85mm f/1.4, slight push-in dolly",
    "lighting_details": "Key light camera-left, dramatic rim light, dark background",
    "environment_details": "Modern dark studio with floating holographic data screens",
    "action_description": "Narrator looks directly at camera, slight head tilt, begins speaking with intensity",
    "eight_second_clip_intent": "Hook delivery — immediate attention grab with eye contact",
    "tts_text": "Ninguém te contou que o YouTube mudou TUDO em 2026...",
    "negative_prompt": "blurry, low quality, cartoon, anime, text overlay"
  },
  {
    "scene_id": 2,
    "autoflow_tag": "[V1-S2]",
    "duration_seconds": 8,
    "character_consistency_block": "Same male narrator, black turtleneck, now gesturing with hands",
    "visual_style": "Data visualization overlay, clean modern graphics",
    "camera_details": "Wide shot transitioning to medium, 35mm, steady tracking",
    "lighting_details": "Ambient blue-teal lighting, screens providing fill",
    "environment_details": "Same studio, now showing large screen with chart of 10,000 channels",
    "action_description": "Narrator walks towards large display, gestures at growing graph",
    "eight_second_clip_intent": "Authority establishment — showing data scale",
    "tts_text": "Eu passei as últimas 72 horas analisando os dados de mais de 10 mil canais",
    "negative_prompt": "blurry, watermark, text, cartoon"
  },
  {
    "scene_id": 3,
    "autoflow_tag": "[V1-S3]",
    "duration_seconds": 8,
    "character_consistency_block": "Same male narrator, leaning forward slightly, conspiratorial expression",
    "visual_style": "Tight dramatic framing, shallow depth of field",
    "camera_details": "Close-up, 135mm f/2, static with subtle breathing movement",
    "lighting_details": "Single key light narrowed, face half in shadow",
    "environment_details": "Blurred dark background, sense of intimacy",
    "action_description": "Narrator leans in, lowers voice slightly, as if sharing a secret",
    "eight_second_clip_intent": "Curiosity gap — creating anticipation for the revelation",
    "tts_text": "E o padrão que eu encontrei... vai contra tudo que os gurus ensinam.",
    "negative_prompt": "bright, overexposed, cartoon, anime"
  }
]
```

---

## 8. INSTRUÇÕES DE TUNING (XGBoost)

### Recalibração do Viral Score com ML

```python
# Após 28 dias de dados coletados:

import xgboost as xgb
import pandas as pd

# 1. Coletar features da tabela reverse_engineering_analyses + métricas reais
features = [
    'hook_retention_score',      # score do hook usado
    'script_quality_score',       # quality_score do ensemble
    'scene_count',                # número de cenas geradas
    'duration_minutes',           # duração do vídeo
    'niche_saturation',           # saturação do nicho (0-1)
    'upload_hour_utc',            # hora de publicação
    'thumbnail_ctr_estimate',     # CTR estimado da thumbnail
    'channel_subscriber_count',   # inscritos do canal
    'is_faceless',                # 0 ou 1
    'language_code',              # one-hot encoded
]

# 2. Target: views reais após 7 dias / média do canal
target = 'actual_viral_multiplier'  # views / avg_channel_views

# 3. Train XGBoost
model = xgb.XGBRegressor(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
)
model.fit(X_train, y_train)

# 4. Extrair feature importance → recalibrar pesos do viral_score
importance = model.feature_importances_
# Mapear importance de volta para os 5 componentes do viral_score
# Atualizar pesos na fórmula (0.35, 0.25, 0.15, 0.15, 0.10)

# 5. Salvar modelo e pesos atualizados
# Persistir em research_cache com TTL de 30 dias
```

### Cronograma de Recalibração
- **Dia 14**: Primeira calibração (dados mínimos viáveis)
- **Dia 28**: Calibração completa com XGBoost
- **Mensal**: Re-treinamento automático via cron

---

## 9. JSON OPERACIONAL — Endpoints para Implementação

```json
{
  "api_endpoints": [
    {
      "route": "POST /functions/v1/video-orchestrator",
      "description": "Pipeline ensemble completo: RAG → Hook → Script → Scenes",
      "payload": {"video_title": "string", "niche": "string", "language": "pt", "duration_minutes": 20, "user_id": "uuid"},
      "credits": 8,
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/reverse-engineer-video",
      "description": "Reverse-engineering de vídeo viral para extrair padrões",
      "payload": {"video_id": "string", "video_title": "string", "channel_name": "string", "niche": "string", "views": 0, "user_id": "uuid"},
      "credits": 5,
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/task-worker",
      "description": "Processa task_queue (orchestrate_video, reverse_engineer, autoflow_execute, etc.)",
      "payload": {},
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/daily-data-ingestion",
      "description": "Varredura diária de nichos e canais emergentes",
      "payload": {"niches": ["tech", "finance"]},
      "cron": "0 3 * * *",
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/weekly-deep-research",
      "description": "Pesquisa profunda semanal via Perplexity",
      "payload": {},
      "cron": "0 4 * * 0",
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/detect-emerging-channels",
      "description": "Detecta canais emergentes por nicho",
      "payload": {"niche": "string", "min_viral_score": 50},
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/generate-synced-prompts",
      "description": "Gera prompts sincronizados no formato AutoFlow [V#-S#]",
      "payload": {"project_id": "uuid"},
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/generate-veo3-video",
      "description": "Gera vídeo via Veo3 API com cooldown automático",
      "payload": {"scene_id": "uuid", "prompt": "string"},
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/chat-assistant",
      "description": "Assistente de onboarding e suporte com contexto do usuário",
      "payload": {"messages": [], "context": {}},
      "status": "IMPLEMENTED"
    },
    {
      "route": "POST /functions/v1/monetiza-score",
      "description": "Calcula/recalcula viral_score para canais e vídeos",
      "payload": {"action": "recalculate_batch", "niche": "string"},
      "status": "IMPLEMENTED"
    }
  ],
  "task_types": [
    {"type": "orchestrate_video", "handler": "video-orchestrator", "max_attempts": 3},
    {"type": "reverse_engineer", "handler": "reverse-engineer-video", "max_attempts": 3},
    {"type": "generate_prompts", "handler": "generate-synced-prompts", "max_attempts": 3},
    {"type": "autoflow_execute", "handler": "generate-veo3-video", "max_attempts": 2},
    {"type": "viral_score_recalc", "handler": "monetiza-score", "max_attempts": 2},
    {"type": "daily_ingestion", "handler": "daily-data-ingestion", "max_attempts": 2},
    {"type": "weekly_deep_research", "handler": "weekly-deep-research", "max_attempts": 2},
    {"type": "detect_emerging_channels", "handler": "detect-emerging-channels", "max_attempts": 3},
    {"type": "auto_enrich_videos", "handler": "auto-enrich-worker", "max_attempts": 2},
    {"type": "self_learning", "handler": "self-learning-engine", "max_attempts": 2}
  ],
  "cron_jobs": [
    {"name": "daily_ingestion", "schedule": "0 3 * * *", "function": "daily-data-ingestion"},
    {"name": "weekly_research", "schedule": "0 4 * * 0", "function": "weekly-deep-research"},
    {"name": "task_worker_poll", "schedule": "*/5 * * * *", "function": "task-worker"},
    {"name": "auto_enrich", "schedule": "0 5 * * *", "function": "auto-enrich-worker"},
    {"name": "viral_score_recalc", "schedule": "0 2 * * 1", "function": "monetiza-score"}
  ]
}
```
