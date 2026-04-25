# Roadmap de Monetização Autônoma — 3 Fases

## TL;DR

A boa notícia: **80% da infra crua já existe** (tabelas `video_performance`, `hook_performance_real`, `channel_intelligence`, `ab_tests`; funções `track-video-performance`, `sync-channel-performance`, `learn-from-ctr`, `monetiza-score`, `youtube-analytics`). Faltam **conexões, um cérebro decisor e safety nets** — não infraestrutura nova.

Plano em 3 fases, ordenadas por ROI. Cada fase é independente e entregável.

---

## FASE 1 — Faz dinheiro mais rápido (entregar primeiro)

### 1.1 — Performance Feedback Loop (fechar o circuito)

Hoje o sistema **coleta** performance (`track-video-performance`, `video_performance`, `hook_performance_real`) mas **não realimenta** o `generate-script`. Vamos fechar.

**O que fazer:**
- Refinar `youtube-analytics-collector` (já existe `youtube-analytics`, vamos elevar):
  - Cron novo: 1×/dia nas primeiras 48h (2 snapshots/vídeo). Decidido na conversa anterior.
  - Estratégia híbrida: YouTube Analytics API (CTR/AVD reais) quando há OAuth scope, Data API como fallback.
  - Popula `video_performance` (já tem todas as colunas: ctr, avg_view_duration, retention_curve, impressions).
- Nova edge function `script-learning-context`:
  - Lê top-3 hooks performers do canal via `hook_performance_real` + top-3 títulos do `video_performance`.
  - Lê 20% piores → vira lista de anti-padrões.
  - Retorna bloco pronto pra prepend no system prompt.
- Patch em `generate-script` e `generate-titles`: 3 linhas chamando `script-learning-context`, fallback gracioso se vazio.
- Patch em `generate-script`: usar embeddings em `hook_performance_real` pra RAG quando o tópico é similar a vídeos passados (similarity > 0.7).

**Impacto:** roteiros viram "estrategista" em vez de "bot". Cada novo vídeo aprende com os anteriores **do mesmo canal**.

---

### 1.2 — Weekly Strategy Agent (cérebro semanal)

Hoje o autopilot é tático (posta no horário). Falta o cérebro que **decide o que postar**.

**O que fazer:**
- Migration:
  - `weekly_strategy_plans` (user_id, channel_id, week_start unique, inputs_json, decisions_json, topics_json, project_ids[], cost_usd, status).
  - `video_projects.created_by_agent boolean`, `video_projects.strategy_plan_id uuid`.
  - `user_channels.strategist_enabled boolean default true`.
- Edge function `strategist-agent`:
  1. Lê em paralelo: performance 7d (`video_performance`), concorrência (`competitor_videos_snapshot` da Fase 2.1), tendências (Perplexity sonar 1×/canal), histórico 14 vídeos (anti-repetição).
  2. Gemini 2.5 Pro com tool calling estruturado retornando `weekly_video_target` tópicos com `{title, topic, video_type, duration_seconds, scheduled_at, mix_bucket: safe|trend|bold, reason, expected_score}`.
  3. Mix decidido na conversa anterior: usa `weekly_video_target` do canal (3-7).
  4. Pra cada tópico: chama `claim_publish_slot` (já existe!) respeitando `posting_days`+`posting_hour`+`min_interval_hours`.
  5. Cria `video_projects` com `status='ready_for_production'`, `created_by_agent=true`, `strategy_plan_id` setado. **Auto-aprovado.**
  6. Grava plano completo em `weekly_strategy_plans` pra auditoria.
- Cron domingo 23:00 UTC (encadeia depois do `competitor-scanner` da Fase 2.1).
- UI: nova página `/weekly-plan` (cards com motivo da escolha, badge mix, botões editar/pular/regenerar). Patch no AutoPilot: badge "🤖 Auto-planejado" + tooltip com `reason`.

**Impacto:** intervenção semanal sua = zero. Canal se auto-alimenta.

**Custo:** ~$0.03/canal/semana ($1.50/canal/ano).

---

### 1.3 — Monetization Safety Net (pré-publicação)

Roda automaticamente antes de qualquer upload. Já existem `monetiza-score` (242 linhas) e `originality-safety-score` — vamos consolidar e tornar bloqueante.

**O que fazer:**
- Nova edge function `pre-upload-guard`:
  - Input: `project_id`.
  - Roda em sequência (curto-circuito no primeiro fail):
    1. Chama `monetiza-score` (palavras desmonetizadas no roteiro+título+descrição).
    2. Chama `originality-safety-score` (plagio/IP).
    3. Validação extra título: clickbait extremo (>3 caps lock seguidos, palavras proibidas como "BANIDO!!!").
    4. Validação extra thumb: chama Gemini 2.5 Flash multimodal — "esta thumb tem celebridade real? violência explícita? texto enganoso?" — retorna boolean.
  - Output: `{passed: bool, score, issues: [], action: 'allow'|'regenerate'|'manual_review'}`.
- Patch no worker Python (claim_next_upload):
  - Antes de iniciar upload, chama `pre-upload-guard`.
  - Se `action='regenerate'`: marca `status='needs_regen'` + payload com issues, AutoPilot regera o componente que falhou (título/thumb/script).
  - Se `action='manual_review'`: marca `status='blocked_safety'`, alerta no WorkerMonitor.
  - Se `action='allow'`: prossegue upload.
- Tabela `pre_upload_audits` (project_id, score, issues_json, action, created_at) pra histórico.

**Impacto:** zero vídeos demonetizados ou strikados saindo no piloto automático. ROI imediato.

---

## FASE 2 — Cresce o canal mais rápido

### 2.1 — Competitor Scanner + Reference Channels Auto-Scan

Já tem `user_reference_channels` (12 linhas) e `channel_intelligence` (23k linhas) — vamos ativar.

**O que fazer:**
- Migration:
  - `competitor_videos_snapshot` (reference_channel_id, youtube_video_id, title, thumb, views, ctr_implied, duration, tags[], scanned_at, week_bucket).
  - `user_channels.competitor_benchmark_json jsonb`, `user_channels.last_competitor_scan_at`.
- Edge function `competitor-scanner`:
  - Para cada `user_reference_channels`: YouTube Data API → uploads playlist → top 10 vídeos recentes.
  - Calcula `views_per_hour`, marca top 3 como `is_top_performer`, salva snapshot.
  - Atualiza `latest_intel` em `user_reference_channels` (top título, padrão duração, frequência post).
  - Após scanear todos: calcula mediana → `user_channels.competitor_benchmark_json`.
- Cron domingo 23:00 UTC (roda **antes** do `strategist-agent`).
- UI nova página `/competitor-intelligence`:
  - Comparativo (4 cards: meu CTR/Views/Frequência/Duração vs mediana nicho).
  - Top vídeos da concorrência da semana.
  - Padrões detectados (chips: "títulos com número 8/10").
  - UI mínima em Channel Settings pra cadastrar 3-5 concorrentes (channel ID ou @handle).

**Custo:** ~$0 (~15 chamadas Data API/semana/canal, limite 10k/dia).

---

### 2.2 — CPM-Aware Topic Router

**O que fazer:**
- Migration: tabela `niche_cpm_rates` (niche, country, language, cpm_avg_usd, cpm_p75_usd, source, updated_at). Seed inicial com 50 nichos × 5 países (USA, BR, UK, CA, AU) — dados públicos do Social Blade/agências.
- Patch no `strategist-agent`:
  - Ao decidir tópicos, lê `niche_cpm_rates` filtrado por country do canal.
  - Adiciona ao prompt: "subtemas dentro deste nicho ranqueados por CPM: investimento imobiliário ($40), crypto ($25), economizar ($4) — priorize alto CPM no mix safe/trend, baixo CPM só no slot bold".
- UI: card no `/weekly-plan` mostrando "CPM esperado deste mix: $X" e "potencial vs alternativa".
- Cron mensal `cpm-rates-refresh` (Perplexity sonar busca dados atualizados).

**Impacto:** mesma audiência, 3-10× receita por mil views.

---

### 2.3 — Anti-strike Watcher

**O que fazer:**
- Edge function `anti-strike-watcher`:
  - Cron diário 04:00 UTC.
  - Para cada canal com OAuth: YouTube API `channels.list?part=status,auditDetails` + `videos.list?part=status` dos últimos 30 vídeos.
  - Detecta: strikes ativos, warnings (Community Guidelines), monetização desabilitada, age-restricted automático.
  - Se detectar:
    - `UPDATE user_channels SET autopilot_enabled=false WHERE id=X`.
    - INSERT em `alerts` (já existe? confirmar) com severity='critical'.
    - Marca todos `video_projects` `ready_for_production` daquele canal como `paused_safety`.
- UI: badge vermelho no AutoPilot dashboard quando há strike + ação "ver detalhes".

**Impacto:** zero canal queimado por automação.

---

## FASE 3 — Polimento e escala

### 3.1 — A/B Thumbnail Testing Real
Já existe `ab_tests` e `ABTestManager`. Falta:
- Integração com YouTube `videos.update` API pra rodar thumbnail rotation oficial (disponível pra canais elegíveis).
- Edge function `thumbnail-ab-runner`: 24h após upload, troca thumb pela variante B, mede CTR delta após 48h, declara vencedora, atualiza `hook_performance_real` com padrão visual vencedor.

### 3.2 — Retention Deep Analysis
Já existe `video_retention_curve`. Falta:
- Edge function `retention-pattern-detector`: identifica drops >5% em janelas de 5s, mapeia para blocos do roteiro original, marca padrão ("queda recorrente em mid-roll após CTA").
- Patch no `script-learning-context`: injeta "evite padrão X — perde 40% audiência aos 2:30".

### 3.3 — Cross-channel Cannibalization Detector
- Edge function diária: vector similarity entre tópicos agendados/postados nos últimos 14d entre canais do mesmo user. Se > 0.85, alerta + sugere reagendar.

### 3.4 — Comments AI Auto-Replier (opt-in por canal)
- Cron 30min após upload: pega 10 primeiros comentários, Gemini Flash gera resposta no tom do canal, posta via YouTube API.
- Toggle `user_channels.auto_reply_enabled` (default OFF — usuário ativa quando confia).
- Filtro automático: skip comentários com >2 emojis negativos, palavras agressivas, suspeita de bot.

---

## Arquitetura final (todos conectados)

```text
                       ┌──────────────────────────────────┐
                       │  CRON DOMINGO 23:00 UTC          │
                       └──────────────┬───────────────────┘
                                      │
                ┌─────────────────────┴─────────────────────┐
                ▼                                           ▼
    competitor-scanner (2.1)                youtube-analytics-collector (1.1)
                │                                           │
                ▼                                           ▼
    competitor_videos_snapshot              video_performance + hook_performance_real
                │                                           │
                └─────────────────────┬─────────────────────┘
                                      ▼
                              strategist-agent (1.2)
                              + cpm router (2.2)
                              + perplexity tendências
                                      │
                                      ▼
                          weekly_strategy_plans
                                      │
                                      ▼  (cria 7 projetos auto-aprovados)
                              video_projects (ready_for_production)
                                      │
                                      ▼
                              autopilot-scheduler (já existe)
                                      │
                                      ▼
                              worker Python (já existe)
                                      │
                                      ▼  (antes de upload)
                              pre-upload-guard (1.3)
                                      │
                              ┌───────┴───────┐
                            allow         regenerate / block
                              │
                              ▼
                       upload YouTube
                              │
                              ▼
                  CRON DIÁRIO 04:00: anti-strike-watcher (2.3)
                  CRON 1×/dia × 48h: youtube-analytics-collector (loop fechado)
```

---

## Detalhes técnicos

**Tabelas novas (3 só):**
- `weekly_strategy_plans` (Fase 1.2)
- `competitor_videos_snapshot` (Fase 2.1)
- `niche_cpm_rates` (Fase 2.2)
- `pre_upload_audits` (Fase 1.3)

**Colunas novas:**
- `video_projects.created_by_agent`, `strategy_plan_id`
- `user_channels.strategist_enabled`, `competitor_benchmark_json`, `last_competitor_scan_at`, `auto_reply_enabled`

**Edge functions novas:**
- `script-learning-context` (1.1)
- `strategist-agent` (1.2)
- `pre-upload-guard` (1.3)
- `competitor-scanner` (2.1)
- `anti-strike-watcher` (2.3)
- `cpm-rates-refresh` (2.2, cron mensal)
- `thumbnail-ab-runner` (3.1)
- `retention-pattern-detector` (3.2)
- `cannibalization-detector` (3.3)
- `comments-auto-replier` (3.4)

**Edge functions refinadas (já existem):**
- `youtube-analytics` → vira `youtube-analytics-collector` com cron 1×/dia × 48h
- `generate-script`, `generate-titles` → patch chamando `script-learning-context`
- `monetiza-score`, `originality-safety-score` → reusados dentro do `pre-upload-guard`

**Crons novos:**
- `youtube-analytics-collector` (1×/dia × 48h por vídeo)
- `competitor-scanner` (dom 22:30 UTC)
- `strategist-agent` (dom 23:00 UTC)
- `anti-strike-watcher` (diário 04:00 UTC)
- `cpm-rates-refresh` (mensal dia 1, 02:00 UTC)
- `cannibalization-detector` (diário 06:00 UTC)
- `comments-auto-replier` (gatilho por upload, não cron)

**UIs novas:**
- `/weekly-plan` — plano semanal por canal (Fase 1.2)
- `/competitor-intelligence` — comparativo + top vídeos rivais (Fase 2.1)
- Badge "🤖 Auto-planejado" no AutoPilot existente
- Badge vermelho de strike no dashboard

**Custo total estimado por canal/mês:**
- Performance collector: ~$0.10
- Strategist (4 semanas): ~$0.12
- Competitor scanner: $0
- Pre-upload guard: ~$0.05 × 30 vídeos = $1.50
- CPM refresh: $0 (rateado)
- Anti-strike: $0
- **~$1.80/canal/mês** — cabe folgado nos tiers Pro/Studio.

---

## Ordem de entrega proposta

Todas as fases têm pré-requisitos satisfeitos, posso entregar em qualquer ordem. Recomendação:

**Sprint 1 (semana 1):** 1.3 Safety Net + 1.1 Performance Loop (ROI imediato + para de queimar canal).
**Sprint 2 (semana 2):** 2.1 Competitor Scanner + 1.2 Strategist Agent (autonomia total — depende de 2.1).
**Sprint 3 (semana 3):** 2.2 CPM Router + 2.3 Anti-strike (cresce receita + protege).
**Sprint 4 (semana 4+):** Fase 3 sob demanda.

Posso entregar **Sprint 1 inteiro num único batch** (3 edge functions + 1 migration + 2 patches + 1 cron) porque os 3 sistemas não se sobrepõem.

---

## O que NÃO vou tocar

- `autopilot-scheduler` (funciona).
- `claim_next_project` / `claim_next_upload` (funcionam).
- Worker Python (só consumirá o novo `pre-upload-guard` via REST).
- Pipeline de render/TTS/Veo3 (funciona).
- Auth, billing, Cloud config.
