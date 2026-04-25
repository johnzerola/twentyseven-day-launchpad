
# Sincronização Lovable Cloud ↔ VPS Python (Flow.io + ffmpeg + YouTube)

## Cenário real

A VPS vai rodar um worker Python que:
1. Pergunta ao Lovable: "qual o próximo projeto pronto pra renderizar?"
2. Abre o Flow.io via Playwright (login persistente), cola cada prompt cena por cena, espera renderizar, baixa.
3. Roda ffmpeg pra montar timeline (vídeo + narração + música + crossfades).
4. Sobe pro YouTube via OAuth do dono do canal.
5. Devolve métricas e arquivo final.

O Lovable Cloud precisa expor um **contrato estável** pra esse worker rodar sozinho, sem race condition, sem custo descontrolado e sem perder o estado quando a VPS reiniciar.

---

## O que será construído nesta fase

### 1. Schema — controle de fila e telemetria

Nova migration adiciona:

- Em `public.video_projects`:
  - `worker_id text` — qual VPS pegou
  - `claimed_at timestamptz` — quando reservou
  - `claim_expires_at timestamptz` — lease (ex: 3h); se vencer, outro worker pode reivindicar
  - `idempotency_key uuid` — usado no upload do YouTube pra não duplicar
  - `rendered_video_url text` — caminho final no Storage
  - `rendered_video_sha256 text` — checksum pra detectar corrupção
  - `total_render_cost_usd numeric` — custo acumulado real (Flow.io tem cota, mas tracking ajuda no painel)

- Nova tabela `public.worker_heartbeats`:
  - `worker_id text PRIMARY KEY` — ex: "vps-sao-paulo-01"
  - `last_seen timestamptz`
  - `current_project_id uuid`
  - `current_stage text` — "flow_render", "ffmpeg_concat", "youtube_upload", "idle"
  - `progress_pct int` — 0-100
  - `meta jsonb` — { cena_atual: 3, cenas_total: 8, queue_size: 2, ip, region }

- Nova tabela `public.project_events`:
  - `project_id uuid` (FK)
  - `worker_id text`
  - `stage text` — "flow_login", "flow_scene_render", "ffmpeg_concat", "youtube_upload", etc
  - `status text` — "started", "completed", "failed"
  - `message text`
  - `cost_usd numeric` (default 0)
  - `duration_ms int`
  - `metadata jsonb`
  - `created_at timestamptz`

RLS: usuário vê seus próprios eventos via join no `project_id`; service role escreve livre.

### 2. RPC `claim_next_project`

Função SECURITY DEFINER que:
- Filtra `video_projects` com `status='ready_for_production'`, `scheduled_at <= now()`, e `(worker_id IS NULL OR claim_expires_at < now())`.
- Prioriza canais com `autopilot_enabled=true` e respeita `next_slot_at` do canal.
- Usa `FOR UPDATE SKIP LOCKED` — dois workers nunca pegam o mesmo projeto.
- Faz UPDATE atômico: `worker_id = _worker_id`, `claimed_at = now()`, `claim_expires_at = now() + lease`, `status = 'claimed'`.
- Retorna o projeto completo + DNA do canal (character, voz, visual_style_prompt, prompts Veo3 já gerados).

Bonus: antes de retornar, chama `check_budget('flow_io')` — se estourado, retorna `null`.

### 3. Edge function `worker-callback`

Endpoint único que o Python chama para tudo (heartbeat + eventos + finalização). Autenticação via header `x-worker-token` (segredo `WORKER_API_TOKEN`).

Aceita 4 actions:

```
POST /worker-callback
{
  action: "heartbeat",
  worker_id, current_project_id, stage, progress_pct, meta
}

{
  action: "event",
  worker_id, project_id, stage, status, message, cost_usd, duration_ms, metadata
}

{
  action: "extend_lease",
  worker_id, project_id, additional_minutes  // pra render demorado
}

{
  action: "complete",
  worker_id, project_id, youtube_video_id, rendered_video_url, sha256, total_cost_usd
}
```

Em `complete`:
- Marca `status='published'`, `published_at=now()`.
- Cria registro em `video_performance` com youtube_video_id.
- Atualiza `user_channels.last_posted_at`, `total_videos_posted+1`.
- Marca `channel_schedule` correspondente como `published`.

### 4. Storage bucket `rendered-videos` (privado)

- Worker faz upload via service role.
- Path: `{user_id}/{project_id}/{idempotency_key}.mp4`.
- Policies: usuário só lê o que é seu; service role escreve.
- Cron job semanal limpa vídeos com status `published` há mais de 7 dias (economia de GB).

### 5. Painel de Workers (extensão de `/autopilot/diagnostics`)

Adiciona seção "VPS conectadas":
- Lista de workers vivos (heartbeat < 2min) com estágio atual e barra de progresso.
- Workers offline (> 5min) marcados em vermelho.
- Custo acumulado das últimas 24h por worker.
- Timeline de eventos do projeto selecionado (drilldown por estágio).

### 6. Recuperação automática de claims órfãos

Atualizar `autopilot-recover` para também:
- Liberar projetos com `claim_expires_at < now()` e nenhum heartbeat recente do `worker_id`.
- Volta status pra `ready_for_production`, limpa worker_id.

### 7. Documento `docs/WORKER_PROTOCOL.md`

Contrato completo que você usa pra escrever o Python:
- Endpoints, payloads, auth, retry rules.
- Schema do projeto retornado pelo claim (estrutura dos prompts Flow.io, synced_scenes, audio_url).
- Regra de sincronização de timeline (ffprobe → tpad/trim → xfade 300ms → mix áudio -14 LUFS).
- Fluxo de erro: quando reportar `event: failed` vs quando segurar e tentar de novo localmente.
- Convenções de nome de worker, lease, idempotência.
- Snippets prontos em Python para: claim loop, heartbeat thread, event reporting, upload ao Storage, complete.

---

## Sugestões de sincronização que valem ouro

**Flow.io tem cota de geração simultânea por conta.** Se você rodar 5 workers contra a mesma conta Flow, vão dar fila ou banimento. O `claim_next_project` deve respeitar `flow_account_id` por canal — assim worker A pega projeto do canal X (conta Flow A) e worker B pega do canal Y (conta Flow B), em paralelo real.

**Detecção de duração real das cenas.** Flow.io entrega MP4 com duração ligeiramente variável (5.0s pode virar 4.87s). O Python deve rodar `ffprobe` em cada cena e ajustar a timeline com `tpad=stop_mode=clone:stop_duration=X` (estende último frame) ou `trim=end=Y` (corta), antes do `xfade` de 300ms. Isso evita áudio dessincronizado.

**Mastering padrão YouTube.** Mixar narração (canal principal) + música ambiente a -18dB, mastering final a **-14 LUFS** (loudness target oficial do YouTube). Já dá pra entregar o filtro ffmpeg pronto no protocolo.

**Idempotency-Key no upload do YouTube.** Cada projeto recebe um UUID que vai como `X-Upload-Id` na YouTube Data API. Se o worker crashar no meio do upload e tentar de novo, o YouTube reconhece e não duplica.

**Backpressure de custo.** Antes de cada claim, checa quanto Flow.io já gerou nas últimas 24h pelo `project_events`. Se passou do limite diário do canal (configurável em `user_channels.daily_render_limit`), o claim retorna null pra esse canal.

---

## Arquitetura final

```text
┌─────────────────────────┐         ┌─────────────────────────────────┐
│  Lovable Cloud (web)    │         │   VPS Python Worker             │
│                         │         │                                 │
│  - Gera roteiro + DNA   │         │  loop:                          │
│  - Gera prompts Veo3    │         │    1. POST claim_next_project   │
│  - Cron diário cria     │ ◄─────► │    2. Playwright → Flow.io      │
│    projetos queued      │  HTTPS  │    3. Baixa MP4s das cenas      │
│  - Painel workers/jobs  │         │    4. ffmpeg timeline + áudio   │
│  - Storage rendered     │         │    5. Upload Storage            │
│                         │         │    6. YouTube API upload        │
└─────────────────────────┘         │    7. POST worker-callback      │
            ▲                       │       (heartbeat a cada 30s)    │
            │                       └─────────────────────────────────┘
            │
       cron pg:
   - autopilot-scheduler-daily (cria projetos)
   - autopilot-recover-30min (libera claims órfãos)
```

---

## Entregáveis nesta fase

1. Migration: colunas de claim + tabelas `worker_heartbeats` e `project_events` + bucket `rendered-videos`.
2. RPC `claim_next_project(_worker_id, _lease_minutes)`.
3. Edge function `worker-callback` (heartbeat / event / extend_lease / complete).
4. Atualização do `autopilot-recover` para liberar claims órfãos.
5. Aba "Workers" + timeline de eventos em `/autopilot/diagnostics`.
6. `docs/WORKER_PROTOCOL.md` com contrato + snippets Python prontos.
7. Segredo novo: `WORKER_API_TOKEN` (será solicitado).

Após aprovação implemento tudo e te entrego o `WORKER_PROTOCOL.md` pra você já começar o Python sabendo exatamente o que chamar.
