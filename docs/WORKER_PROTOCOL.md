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

---

## 10. Matriz de Retries — Quem é Responsável pelo Quê

Política única para evitar duplo-retry (worker repetindo o que o servidor já vai repetir).

| Cenário                                  | Quem decide  | Ação                                                                                       |
|------------------------------------------|--------------|--------------------------------------------------------------------------------------------|
| Cena Flow.io retornou erro transitório   | **Worker**   | Retry local até **3x** com backoff `2s, 8s, 30s` antes de reportar `event status=failed`. |
| Veo3 prompt rejeitado (safety/policy)    | **Worker**   | Sanitiza prompt 1x (remover violência/marca) e retenta. Se falhar de novo → `failed`.     |
| Worker crash / VPS reboot                | **Servidor** | `autopilot-recover` libera projeto após `claim_expires_at` expirar.                       |
| `event status=failed` recebido           | **Servidor** | `retry_count++`. Se `< max_retries`: volta a `ready_for_production` com backoff `30m / 2h / 8h`. |
| `retry_count >= max_retries`             | **Servidor** | `status='failed'`, slot do `channel_schedule` marcado como `cancelled`, alerta no painel. |
| Upload YouTube falhou no meio (resumable)| **Worker**   | Reusar **mesma sessão resumable** + `idempotency_key` por até 7 dias antes de reportar.   |
| YouTube retornou `quotaExceeded`         | **Worker**   | NÃO retentar. Reportar `event stage=upload status=failed reason=quota`. Servidor reagenda em +24h automaticamente. |
| ffmpeg crashou (OOM, codec)              | **Worker**   | 1 retry com `-preset ultrafast`. Se persistir → `failed`.                                 |
| Render passou de **60% do lease**        | **Worker**   | Chamar `extend_lease` proativamente (+60min). Não esperar expirar.                        |
| Storage upload falhou (rendered-videos)  | **Worker**   | Retry exponencial até 5x. Bucket é o ponto de não-retorno: sem upload → sem `complete`.   |

### Backoff de retry server-side (após `event status=failed`)

```
retry_count = 0  →  scheduled_at += 30 minutos
retry_count = 1  →  scheduled_at += 2 horas
retry_count = 2  →  scheduled_at += 8 horas
retry_count = 3  →  status = 'failed' (terminal)
```

`max_retries` default = 3, configurável por projeto via coluna `max_retries`.

---

## 11. Operações Idempotentes vs Não-Idempotentes

Tabela definitiva — leia antes de implementar qualquer retry no Python.

| Operação                          | Idempotente? | Como garantir segurança no retry                                          |
|-----------------------------------|--------------|---------------------------------------------------------------------------|
| `claim_next_project`              | ✅ Sim       | Já é `FOR UPDATE SKIP LOCKED`. Pode chamar quantas vezes quiser.          |
| `worker-callback action=heartbeat`| ✅ Sim       | UPSERT no servidor. Repetir sem medo (a cada 30s).                        |
| `worker-callback action=event`    | ⚠️ Parcial   | Cada chamada cria 1 linha em `project_events`. OK duplicar (logs ricos).  |
| `worker-callback action=extend_lease` | ✅ Sim   | Apenas atualiza `claim_expires_at`. Pode repetir.                         |
| `worker-callback action=complete` | ❌ **NÃO**   | Marca `status=published` e debita slot. **Use `idempotency_key` único do projeto** — servidor faz no-op se já estiver `published`. |
| Upload Storage `rendered-videos`  | ⚠️ Parcial   | Use `path = "{project_id}/{idempotency_key}.mp4"`. UPSERT sobrescreve.    |
| YouTube `videos.insert` resumable | ❌ **NÃO**   | Persistir `upload_session_uri` em disco local. Retomar a mesma sessão por até 7 dias. NUNCA criar nova sessão para o mesmo `idempotency_key`. |
| Flow.io geração de cena           | ❌ **NÃO**   | Cada chamada gasta crédito. Persistir `flow_job_id` em arquivo local antes de aguardar resultado, para retomar polling após crash. |

### Checklist de idempotência no worker Python

```python
# Antes de QUALQUER chamada custosa (Flow.io, YouTube), faça:
state_file = f"/var/lovable-worker/state/{project_id}.json"
if os.path.exists(state_file):
    state = json.load(open(state_file))
    # Já temos flow_job_id ou upload_session_uri? Retoma de onde parou.
else:
    state = {"project_id": project_id, "scenes_done": [], "youtube_session": None}

# Salvar a CADA passo bem-sucedido
state["scenes_done"].append(scene_id)
json.dump(state, open(state_file, "w"))

# No worker-callback action=complete, sempre passe:
{
  "action": "complete",
  "project_id": project_id,
  "idempotency_key": project["idempotency_key"],  # vem do claim
  "youtube_video_id": "...",
  "rendered_url": "..."
}
# Servidor faz no-op silencioso se já marcou published com mesma key.
```

### Limpeza do state local

Após `complete` retornar `200 OK` **e** `published=true`:
```python
os.remove(state_file)
```

Isso fecha o ciclo. Se o worker crashar entre `complete` enviado e `state_file` removido, o próximo boot tentará `complete` de novo — e o servidor responderá `{"already_published": true}` sem efeito colateral.

---

## 12. Resumo do contrato em uma frase

> **O servidor sempre tem a verdade. O worker só age sobre projetos que pegou via `claim_next_project`, reporta tudo via `worker-callback`, e nunca toca em status terminais nem retenta operações sem idempotency key.**

---

## 13. Upload no YouTube — `POST /youtube-upload`

Endpoint dedicado para o ciclo completo de upload. **Mesmo `x-worker-token`** do `worker-callback`. Todas as requisições são `POST` com `action` no body.

### 13.1 `action=init` — criar sessão resumable

Servidor: refresca token OAuth do canal (se necessário), chama `videos.insert?uploadType=resumable` no YouTube, persiste `upload_session_uri` no projeto e devolve a URI + `access_token` curto pro worker fazer os PUT chunks diretamente.

```json
// REQUEST
{
  "action": "init",
  "project_id": "uuid",
  "worker_id": "vps-abc12345",
  "file_size_bytes": 87432109,
  "mime_type": "video/mp4"
}

// RESPONSE 200 (nova sessão)
{
  "upload_session_uri": "https://www.googleapis.com/upload/youtube/v3/videos?...&upload_id=...",
  "idempotency_key": "uuid",
  "access_token": "ya29....",
  "snippet": { "title": "...", "description": "...", "tags": [...], "categoryId": "22" },
  "status": { "privacyStatus": "private", "selfDeclaredMadeForKids": false, "embeddable": true }
}

// RESPONSE 200 (já tem sessão ativa — reaproveitar)
{ "reused": true, "upload_session_uri": "...", "idempotency_key": "uuid" }

// RESPONSE 200 (já publicado — no-op)
{ "already_published": true, "youtube_video_id": "abc123" }
```

### 13.2 Worker faz o PUT direto no YouTube

Não passa pelo servidor — é byte direto VPS → Google. Permite chunks de 256KB×N, retomar do offset salvo, etc.

```python
# Pseudocode Python
headers = {"Authorization": f"Bearer {access_token}", "Content-Length": str(size),
           "Content-Type": "video/mp4"}
r = requests.put(upload_session_uri, data=open(path, "rb"), headers=headers)

if r.status_code in (200, 201):
    youtube_video_id = r.json()["id"]
    call_complete(youtube_video_id)
elif r.status_code == 308:
    # Resumable: reler "Range: bytes=0-X" e enviar restante
    resume_from(int(r.headers["Range"].split("-")[1]) + 1)
elif r.status_code in (500, 502, 503, 504):
    # Retentar com backoff (1s, 2s, 4s, 8s, 16s)
    retry_with_backoff()
elif r.status_code == 401:
    # Token expirou no meio → action=refresh, depois retomar do offset
    new_token = call_refresh(); resume_from(last_offset)
elif r.status_code == 403 and "quotaExceeded" in r.text:
    call_fail(reason="quota", http_status=403)
else:
    call_fail(reason="upload_error", error_message=r.text, http_status=r.status_code)
```

### 13.3 `action=complete` — sincronizar IDs com o projeto

Idempotente via `idempotency_key`. Se chamado 2x com mesmo `youtube_video_id`, retorna `already_published: true` sem efeito colateral.

```json
// REQUEST
{
  "action": "complete",
  "project_id": "uuid",
  "worker_id": "vps-abc12345",
  "youtube_video_id": "dQw4w9WgXcQ",
  "idempotency_key": "uuid"   // do claim
}

// RESPONSE 200
{
  "success": true,
  "youtube_video_id": "dQw4w9WgXcQ",
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "published_at": "2026-04-25T15:14:17Z"
}
```

Servidor faz tudo isso em uma transação:
- `video_projects.youtube_video_id`, `youtube_url`, `published_at`, `upload_completed_at`
- `status = 'published'` (terminal), libera `worker_id` e `claim_expires_at`
- Incrementa `user_channels.total_videos_posted` + atualiza `last_posted_at`
- Insere `youtube_upload_attempts (status='completed')` e `project_events (stage='publish', status='completed')`

### 13.4 `action=fail` — registrar falha + decidir retry

Servidor calcula backoff automaticamente: **5min → 30min → 2h → 8h → 24h** (max 5 tentativas). Quota excedida não consome retry — sempre reagenda em +24h.

```json
// REQUEST
{
  "action": "fail",
  "project_id": "uuid",
  "worker_id": "vps-abc12345",
  "reason": "upload_error" | "quota" | "session_expired" | "token_invalid" | "network",
  "error_message": "Connection reset after chunk 47",
  "http_status": 503
}

// RESPONSE 200
{
  "attempts": 2,
  "next_retry_at": "2026-04-25T17:14:17Z",
  "given_up": false,
  "backoff_minutes": 30
}

// RESPONSE 200 (esgotou)
{ "attempts": 5, "next_retry_at": null, "given_up": true, "backoff_minutes": 1440 }
```

Se `reason="session_expired"` ou `given_up=true`, o servidor limpa `upload_session_uri` para forçar criação de nova sessão na próxima tentativa.

### 13.5 `action=metadata` — atualizar título/descrição/tags pós-publicação

Útil pra A/B test de título 24h depois ou correção manual. Pega o estado atual do projeto e faz `videos.update`.

```json
// REQUEST
{ "action": "metadata", "project_id": "uuid" }

// RESPONSE 200
{ "success": true, "updated": { "id": "...", "snippet": {...}, "status": {...} } }
```

### 13.6 `action=refresh` — só refrescar token (raro)

```json
// REQUEST
{ "action": "refresh", "channel_id": "uuid" }
// RESPONSE
{ "access_token": "ya29...." }
```

### 13.7 Fluxo completo recomendado no worker Python

```python
def upload_to_youtube(project, channel):
    state_file = f"/var/lovable-worker/state/{project['id']}.json"
    state = load(state_file) or {"offset": 0, "session_uri": None, "access_token": None}

    # 1. INIT (ou reaproveitar sessão existente)
    if not state["session_uri"]:
        r = post_to_lovable("youtube-upload", {
            "action": "init", "project_id": project["id"],
            "worker_id": WORKER_ID,
            "file_size_bytes": os.path.getsize(project["rendered_video_url_local"]),
            "mime_type": "video/mp4",
        })
        if r.get("already_published"):
            return r["youtube_video_id"]  # nada a fazer
        state["session_uri"] = r["upload_session_uri"]
        state["access_token"] = r["access_token"]
        save(state_file, state)

    # 2. PUT chunks com retry/backoff
    for attempt in range(5):
        try:
            video_id = put_resumable(state["session_uri"], state["access_token"],
                                     project["rendered_video_url_local"], state["offset"])
            break
        except TokenExpired:
            state["access_token"] = post_to_lovable("youtube-upload",
                {"action": "refresh", "channel_id": channel["id"]})["access_token"]
            save(state_file, state)
        except Resumable308 as e:
            state["offset"] = e.next_offset
            save(state_file, state)
        except QuotaExceeded:
            post_to_lovable("youtube-upload", {"action": "fail", "project_id": project["id"],
                "worker_id": WORKER_ID, "reason": "quota", "http_status": 403,
                "error_message": "daily quota exceeded"})
            return None  # servidor reagenda em +24h
        except TransientError as e:
            time.sleep(2 ** attempt)  # 1, 2, 4, 8, 16
    else:
        post_to_lovable("youtube-upload", {"action": "fail", "project_id": project["id"],
            "worker_id": WORKER_ID, "reason": "upload_error",
            "error_message": "exhausted local retries"})
        return None

    # 3. COMPLETE — sincroniza IDs no banco (idempotente)
    post_to_lovable("youtube-upload", {
        "action": "complete", "project_id": project["id"],
        "worker_id": WORKER_ID, "youtube_video_id": video_id,
        "idempotency_key": project["idempotency_key"],
    })

    # 4. Limpa state local — ciclo fechado
    os.remove(state_file)
    return video_id
```

### 13.8 Auditoria

Cada chamada cria 1 linha em `youtube_upload_attempts` com `status`, `error_code`, `http_status`, `bytes_uploaded`. Use pra dashboard de "uploads que falharam nas últimas 24h":

```sql
SELECT vp.title, ya.attempt_number, ya.status, ya.error_message, ya.http_status, ya.created_at
  FROM youtube_upload_attempts ya
  JOIN video_projects vp ON vp.id = ya.project_id
 WHERE ya.status IN ('failed','quota_exceeded')
   AND ya.created_at > now() - interval '24 hours'
 ORDER BY ya.created_at DESC;
```

---

## 14. Lock por Canal — Garantia de 1 job por canal por vez

Para evitar **vídeos duplicados no YouTube** e race conditions quando você roda múltiplos workers (ou múltiplos processos Python na mesma VPS), o sistema impõe um lock atômico por canal.

### 14.1 Como funciona

A tabela `channel_locks` tem **PK = `channel_id`** — só pode existir 1 lock por canal. As RPCs `claim_next_project` e `claim_next_upload` agora fazem 3 coisas atomicamente:

1. `LEFT JOIN channel_locks` na busca do próximo projeto, filtrando por `(lock inexistente OR lock meu OR lock expirado)`.
2. `INSERT … ON CONFLICT (channel_id) DO UPDATE` no lock — se outro worker correu na frente, o `WHERE` da clause de UPDATE não casa e o lock fica intacto.
3. Verifica com `PERFORM 1 FROM channel_locks WHERE worker_id=meu` — se não pegou, retorna `claimed=false, reason='channel_locked_by_other_worker'`.

Resultado: **dois workers nunca processam o mesmo canal ao mesmo tempo**, mesmo que peguem projetos diferentes desse canal.

### 14.2 Fluxo no Python

```python
def worker_loop():
    while True:
        job = rpc("claim_next_project", {"_worker_id": WORKER_ID, "_lease_minutes": 180})

        if job is None:
            time.sleep(60); continue                    # nada na fila

        if job.get("claimed") is False:
            reason = job.get("reason")
            if reason == "channel_locked_by_other_worker":
                # outro worker está nesse canal — pula e tenta outro
                time.sleep(10); continue
            if reason == "daily_render_limit_reached":
                time.sleep(300); continue               # canal saturado
            time.sleep(30); continue

        project = job["project"]
        channel = job["channel"]
        lock_until = job["channel_lock"]["expires_at"]

        try:
            render_video(project, channel)
            upload_to_youtube(project, channel)
            mark_complete(project)
        except Exception as e:
            mark_failed(project, str(e))
        finally:
            # SEMPRE liberar o lock no final (sucesso OU falha)
            rpc("release_channel_lock", {
                "_channel_id": channel["id"],
                "_worker_id": WORKER_ID,
            })
```

### 14.3 Heartbeat para jobs longos

Render Veo3 + edição + upload pode passar de 3h. Se não renovar o lock, ele expira e outro worker pode pegar o canal. Use `extend_channel_lock` em paralelo com o heartbeat do projeto:

```python
# Thread de heartbeat (rodar em background a cada 60s)
def heartbeat_loop(channel_id, project_id):
    while not done:
        rpc("extend_channel_lock", {
            "_channel_id": channel_id,
            "_worker_id": WORKER_ID,
            "_additional_minutes": 60,
        })
        post_to_lovable("worker-callback", {
            "action": "heartbeat", "project_id": project_id, "worker_id": WORKER_ID,
        })
        time.sleep(60)
```

### 14.4 Recovery automático de locks órfãos

- **Limpeza preventiva**: cada chamada de `claim_next_*` faz `DELETE FROM channel_locks WHERE expires_at < now()` no início. Isso é barato (índice `idx_channel_locks_expires`).
- **Cron `autopilot-recover` (30min)**: pode chamar `cleanup_expired_channel_locks()` explicitamente para garantir limpeza mesmo quando ninguém está fazendo claim.

### 14.5 Stages do lock

A coluna `stage` (`'render'` | `'upload'` | `'edit'`) permite distinguir em que fase o canal está. Útil para:
- Dashboard: "Canal X — renderizando cena 7/12"
- Monitoramento: alertar se um canal fica em `'upload'` por mais de 30min
- Permitir que a VPS de upload pegue o canal logo depois do render terminar (release_channel_lock + claim_next_upload imediato)

### 14.6 Por que isso evita vídeos duplicados

Sem lock, este cenário aconteceria:
```
T=0   Worker A faz claim_next_project → projeto P1 do canal C1
T=1   Worker B faz claim_next_project → projeto P2 do canal C1
T=180 Worker A faz upload do P1 → YouTube ID = abc123
T=190 Worker B faz upload do P2 → YouTube ID = def456
      MAS: P1 e P2 podem ter títulos parecidos (gerados pelo mesmo prompt-base),
           o canal acaba postando 2 vídeos no mesmo minuto, algoritmo do YT pune.
```

Com lock:
```
T=0   Worker A faz claim_next_project → pega P1 + lock canal C1 até T=180
T=1   Worker B faz claim_next_project → vê C1 travado, retorna claimed=false → pega P3 do canal C2
T=180 Worker A termina P1, libera lock C1
T=181 Worker A ou B pode pegar P2 do canal C1 — agora com 3h de espaçamento natural
```

Combine isso com `min_interval_hours` em `user_channels` (configurável por canal) para garantir o espaçamento mínimo entre posts, mesmo com múltiplos workers correndo.

### 14.7 Query de monitoramento

```sql
-- Quem está travando o quê agora
SELECT cl.channel_id, uc.channel_name, cl.worker_id, cl.stage,
       vp.title AS current_project,
       cl.acquired_at,
       cl.expires_at,
       (cl.expires_at - now()) AS time_remaining,
       (now() - cl.heartbeat_at) AS time_since_heartbeat
  FROM channel_locks cl
  JOIN user_channels uc ON uc.id = cl.channel_id
  LEFT JOIN video_projects vp ON vp.id = cl.project_id
 ORDER BY cl.acquired_at DESC;
```
