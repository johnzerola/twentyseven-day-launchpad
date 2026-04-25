# VPS Worker Protocol — Lovable Cloud ↔ Python

Contrato completo entre o **Lovable Cloud** (cérebro editorial) e o **worker Python na VPS**
(músculo: Flow.io + ffmpeg + YouTube upload).

---

## 0. Máquina de estados de `video_projects.status`

```text
                       ┌──────────────────────┐
                       │ ready_for_production │ ◄──────────────┐
                       └──────────┬───────────┘                │
                                  │ claim_next_project()        │
                                  ▼                             │
                          ┌──────────────┐                      │
                          │   claimed    │                      │
                          └──┬────────┬──┘                      │
                             │        │                          │
   worker reporta failed     │        │ worker reporta complete  │
   (retry_count < max)       │        │                          │
                             │        ▼                          │
                             │  ┌───────────┐                    │
                             │  │ published │ (terminal)         │
                             │  └───────────┘                    │
                             │                                   │
                             ▼                                   │
                     (incrementa retry_count,                    │
                      libera worker_id, volta) ───────────────────┘
                             │
              retry_count >= max_retries
                             ▼
                    ┌───────────────────┐
                    │ failed | failed_  │  (terminal — só recover --force tira)
                    │ permanent         │
                    └───────────────────┘
```

Recovery automático (`autopilot-recover`, cron 30min):
- `status='claimed' AND claim_expires_at < now()` → volta para `ready_for_production` (libera worker órfão).
- `status='ready_for_production' AND error_message IS NOT NULL AND retry_count < max` → reagenda com backoff.

**Estados ATIVOS (worker pode trabalhar):** `ready_for_production`, `claimed`.
**Estados TERMINAIS (worker NUNCA toca):** `published`, `failed`, `failed_permanent`, `cancelled`, `draft`.

> Regra de ouro: o worker **nunca** muda `status` via UPDATE direto. Toda transição passa por `claim_next_project` (entrada) ou `worker-callback` (saída). Isso garante atomicidade e auditoria via `project_events`.

---

---

## 1. Endpoints

Base URL:
```
https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1
```

### 1.1 `POST /worker-callback`
Endpoint único para heartbeat, eventos, extensão de lease e finalização.

**Headers obrigatórios:**
```
Content-Type: application/json
x-worker-token: <WORKER_API_TOKEN>
```

> O `WORKER_API_TOKEN` é o segredo configurado no Lovable Cloud. Token sugerido (gerado para você):
> `brbyWc6qPmbqF9h6B2R9EXMK79rdbVp4OkHDhzTSANLQKwZd7ltW47UyqVJkV3IY`
> Adicione esse mesmo valor em **Cloud → Secrets → WORKER_API_TOKEN** e no `.env` do Python.

### 1.2 `POST {SUPABASE_URL}/rest/v1/rpc/claim_next_project`
RPC chamado via REST com **service role key**.

**Headers:**
```
apikey: <SUPABASE_SERVICE_ROLE_KEY>
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: application/json
```

**Body:**
```json
{
  "_worker_id": "vps-sao-paulo-01",
  "_lease_minutes": 180,
  "_flow_account_id": "flow-acc-A"   // opcional; null = qualquer canal
}
```

**Response (200, projeto reservado):**
```json
{
  "claimed": true,
  "project": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "...",
    "script": "...",
    "audio_url": "https://...",
    "niche": "history",
    "video_type": "long",
    "duration_seconds": 480,
    "idempotency_key": "uuid",   // <- usar como X-Upload-Id no YouTube
    "scheduled_at": "2026-04-25T18:00:00Z",
    "claim_expires_at": "2026-04-25T21:00:00Z",
    "intelligence_json": { ... },
    "retry_count": 0
  },
  "channel": {
    "id": "uuid",
    "channel_name": "...",
    "youtube_channel_id": "UC...",
    "language": "pt-BR",
    "character_name": "...",
    "character_bio": "...",
    "tts_voice_id": "...",
    "tts_voice_style": "...",
    "visual_style_prompt": "...",
    "flow_account_id": "flow-acc-A"
  },
  "scenes": [
    {
      "id": "uuid",
      "sequence_order": 1,
      "duration_sec": 8,
      "tts_text": "...",
      "veo3_prompt": "<prompt completo p/ Flow.io>",
      "camera_movement": "...",
      "lighting": "...",
      "emotional_intent": "...",
      "style_tags": [...],
      "negative_prompt": "...",
      "character_ref": "...",
      "reference_image_url": "...",
      "media_url": null,
      "video_clip_url": null
    }
  ]
}
```

**Response possíveis:**
- `null` — não há projetos prontos (worker espera 30-60s e tenta de novo).
- `{ "claimed": false, "reason": "daily_render_limit_reached", ... }` — esse canal estourou o limite; tente outro Flow account ou aguarde.

---

## 2. Actions do `/worker-callback`

Todos os payloads incluem `worker_id`. O `action` discrimina o tipo.

### 2.1 `heartbeat` (a cada 30s, mesmo idle)
```json
{
  "action": "heartbeat",
  "worker_id": "vps-sao-paulo-01",
  "current_project_id": "uuid|null",
  "stage": "flow_render | ffmpeg_concat | youtube_upload | idle",
  "progress_pct": 42,
  "meta": {
    "scene_atual": 3,
    "scenes_total": 8,
    "queue_size": 2,
    "ip": "1.2.3.4",
    "region": "sa-east-1"
  }
}
```

### 2.2 `event` (granular, por estágio)
```json
{
  "action": "event",
  "worker_id": "vps-sao-paulo-01",
  "project_id": "uuid",
  "stage": "flow_login | flow_scene_render | scene_download | ffmpeg_concat | audio_mix | youtube_upload | ...",
  "status": "started | progress | completed | failed",
  "message": "Cena 3/8 renderizada (4.87s)",
  "cost_usd": 0,
  "duration_ms": 12340,
  "metadata": { "scene_index": 3, "duration_real": 4.87 }
}
```

> Quando `status == "failed"`, o servidor automaticamente:
> - incrementa `retry_count`,
> - libera o claim (`worker_id=null`),
> - se `retry_count >= max_retries` marca `status='failed'`, senão volta a `ready_for_production` (próximo worker pega).

### 2.3 `extend_lease` (render demorado)
```json
{
  "action": "extend_lease",
  "worker_id": "vps-sao-paulo-01",
  "project_id": "uuid",
  "additional_minutes": 60
}
```
Retorna o novo `claim_expires_at`. Só funciona se você ainda for o dono do claim.

### 2.4 `complete` (sucesso final)
```json
{
  "action": "complete",
  "worker_id": "vps-sao-paulo-01",
  "project_id": "uuid",
  "youtube_video_id": "abc123",
  "rendered_video_url": "user-uploads/{user_id}/{project_id}/{idempotency_key}.mp4",
  "sha256": "ab12...",
  "total_cost_usd": 0.42,
  "duration_seconds": 480
}
```
Marca o projeto como `published`, atualiza `last_posted_at` do canal e o slot do `channel_schedule`.

---

## 3. Storage — bucket `rendered-videos` (privado)

Path obrigatório: `{user_id}/{project_id}/{idempotency_key}.mp4`

Upload via REST com service role:
```
POST {SUPABASE_URL}/storage/v1/object/rendered-videos/{user_id}/{project_id}/{idempotency_key}.mp4
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
Content-Type: video/mp4
```

A URL retornada é o que vai no campo `rendered_video_url` do `complete`.

---

## 4. Regra de sincronização da timeline (ffmpeg)

Cada cena baixada do Flow.io tem **duração ligeiramente variável** (5.0s pode virar 4.87s).
O Python deve, **para cada cena**:

1. `ffprobe -v error -show_entries format=duration -of csv=p=0 cena_N.mp4` → `dur_real`
2. Comparar com `duration_sec` do scene payload:
   - Se `dur_real < duration_sec`: estender último frame
     `-vf "tpad=stop_mode=clone:stop_duration=${duration_sec - dur_real}"`
   - Se `dur_real > duration_sec`: cortar
     `-vf "trim=end=${duration_sec},setpts=PTS-STARTPTS"`
3. Concatenar com **xfade** de 300ms entre cenas:
   ```
   -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.3:offset=4.7[v01]; ..."
   ```
4. Mixar áudio:
   - Narração principal (do `audio_url` do projeto): canal central, 0dB
   - Música ambiente: -18dB
5. **Mastering YouTube (-14 LUFS):**
   ```
   -af "loudnorm=I=-14:LRA=11:TP=-1.5"
   ```

---

## 5. Idempotência do upload YouTube

Use o `idempotency_key` do projeto como `X-Upload-Id` na YouTube Data API
(resumable upload, header `X-Upload-Content-Length` + `Slug: {idempotency_key}`).
Se o worker crashar no meio do upload e tentar de novo com o mesmo key, o YouTube reconhece a sessão e não duplica.

---

## 6. Fluxo principal do worker (pseudocódigo Python)

```python
import os, time, threading, requests, hashlib, subprocess, uuid

WORKER_ID    = os.environ["WORKER_ID"]               # ex: "vps-sao-paulo-01"
SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_TOKEN = os.environ["WORKER_API_TOKEN"]
FN_BASE      = f"{SUPABASE_URL}/functions/v1"

CB_HEADERS = {
    "Content-Type": "application/json",
    "x-worker-token": WORKER_TOKEN,
}
RPC_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

# ---------- callback helpers ----------
def callback(payload):
    r = requests.post(f"{FN_BASE}/worker-callback", json=payload, headers=CB_HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()

def heartbeat(project_id=None, stage="idle", pct=None, meta=None):
    callback({
        "action": "heartbeat",
        "worker_id": WORKER_ID,
        "current_project_id": project_id,
        "stage": stage,
        "progress_pct": pct,
        "meta": meta or {},
    })

def event(project_id, stage, status, message=None, cost=0, dur_ms=None, metadata=None):
    callback({
        "action": "event",
        "worker_id": WORKER_ID,
        "project_id": project_id,
        "stage": stage, "status": status, "message": message,
        "cost_usd": cost, "duration_ms": dur_ms, "metadata": metadata or {},
    })

def claim():
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/claim_next_project",
        json={"_worker_id": WORKER_ID, "_lease_minutes": 180},
        headers=RPC_HEADERS, timeout=30,
    )
    r.raise_for_status()
    return r.json()

# ---------- heartbeat thread ----------
state = {"project_id": None, "stage": "idle", "pct": 0}
def heartbeat_loop():
    while True:
        try:
            heartbeat(state["project_id"], state["stage"], state["pct"])
        except Exception as e:
            print("heartbeat err", e)
        time.sleep(30)
threading.Thread(target=heartbeat_loop, daemon=True).start()

# ---------- main loop ----------
while True:
    job = claim()
    if not job or job.get("claimed") is False:
        time.sleep(60)
        continue

    project = job["project"]
    channel = job["channel"]
    scenes  = job["scenes"]
    pid     = project["id"]

    state.update({"project_id": pid, "stage": "flow_render", "pct": 0})

    try:
        # 1) Render cada cena no Flow.io (Playwright)
        for i, sc in enumerate(scenes):
            t0 = time.time()
            event(pid, "flow_scene_render", "started", f"scene {i+1}/{len(scenes)}",
                  metadata={"scene_index": sc["sequence_order"]})
            # ... abre Flow.io, cola sc["veo3_prompt"], espera, baixa para /tmp/scene_{i}.mp4 ...
            event(pid, "flow_scene_render", "completed", dur_ms=int((time.time()-t0)*1000),
                  metadata={"scene_index": sc["sequence_order"]})
            state["pct"] = int(60 * (i+1) / len(scenes))

        # 2) ffmpeg concat + audio
        state["stage"] = "ffmpeg_concat"; state["pct"] = 70
        out = f"/tmp/{pid}.mp4"
        # ffprobe → tpad/trim → xfade → loudnorm (ver seção 4)
        # subprocess.run(["ffmpeg", ...], check=True)

        # 3) Upload para storage
        state["stage"] = "storage_upload"; state["pct"] = 80
        sha = hashlib.sha256(open(out, "rb").read()).hexdigest()
        path = f"{project['user_id']}/{pid}/{project['idempotency_key']}.mp4"
        with open(out, "rb") as f:
            requests.post(
                f"{SUPABASE_URL}/storage/v1/object/rendered-videos/{path}",
                data=f, headers={**RPC_HEADERS, "Content-Type": "video/mp4"},
                timeout=600,
            ).raise_for_status()

        # 4) Upload YouTube (resumable, com idempotency_key como Slug)
        state["stage"] = "youtube_upload"; state["pct"] = 90
        # ... youtube_video_id = upload_to_youtube(out, channel, project) ...
        youtube_video_id = "TODO"

        # 5) Complete
        callback({
            "action": "complete",
            "worker_id": WORKER_ID,
            "project_id": pid,
            "youtube_video_id": youtube_video_id,
            "rendered_video_url": path,
            "sha256": sha,
            "total_cost_usd": 0.0,
            "duration_seconds": project["duration_seconds"],
        })
        state.update({"project_id": None, "stage": "idle", "pct": 100})

    except Exception as e:
        event(pid, state["stage"], "failed", str(e))
        state.update({"project_id": None, "stage": "idle", "pct": 0})
        time.sleep(10)
```

---

## 7. Convenções

- **worker_id**: identificador estável da VPS, ex: `vps-{region}-{n}`. Não mude entre restarts.
- **Lease padrão**: 180 minutos. Para vídeos longos (>10min) chame `extend_lease` quando passar de 60% do tempo.
- **Backoff entre falhas**: o servidor decide (30min, 2h, 8h via `next_retry_at`). Worker só precisa reportar `failed` e seguir.
- **Múltiplas VPS na mesma conta Flow.io**: passe `_flow_account_id` no claim para evitar conflito de quota.
- **Daily render cap**: configurável por canal via `user_channels.daily_render_limit`. Quando estoura, `claim` retorna `{ claimed: false, reason: "daily_render_limit_reached" }`.

---

## 8. Variáveis de ambiente do worker (`.env`)

```
WORKER_ID=vps-sao-paulo-01
SUPABASE_URL=https://nwnjopqxcqpvcelswvyt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<copiar da Cloud → Connectors → Service Role>
WORKER_API_TOKEN=<mesmo valor que está no segredo da Cloud>

# Flow.io / Playwright
FLOW_EMAIL=...
FLOW_PASSWORD=...
PLAYWRIGHT_USER_DATA=/var/lib/worker/playwright-profile

# YouTube OAuth (já trocado pelo dono do canal via /channels)
# O worker lê os tokens diretamente da tabela channel_youtube_oauth do Supabase.
```

---

## 9. Checklist de saúde (rodar 1x antes de subir em produção)

- [ ] `claim_next_project` retorna `null` quando não há projeto.
- [ ] Dois workers em paralelo nunca pegam o mesmo `project_id`.
- [ ] `heartbeat` aparece no painel `/autopilot/diagnostics` em < 30s.
- [ ] `event` com `status=failed` libera o projeto e incrementa `retry_count`.
- [ ] `extend_lease` funciona apenas para o worker dono.
- [ ] `complete` marca o projeto como `published` e cria `video_performance`.
- [ ] Reupload com mesmo `idempotency_key` no YouTube não duplica.
- [ ] ffmpeg final tem `loudnorm` aplicado (verificar com `ffmpeg-normalize` ou medidor LUFS).
