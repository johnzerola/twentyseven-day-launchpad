## Diagnóstico

O feedback loop **está implementado** no `generate-script` (chama `script-learning-context`, `fetchHookPerformanceBlock` e `fetchUserCtrPatternsBlock`), mas **morre na fonte de dados**:

| Métrica | Estado real |
|---|---|
| Vídeos em `video_performance` | 28 |
| Com `channel_id` preenchido | **0** |
| Com `hook_type` extraído | **0** |
| Com `title_pattern` extraído | **0** |
| Com `niche` preenchido | **0** |
| Linhas em `hook_performance_real` | **0** |
| Linhas em `user_ctr_patterns` | **0** |

Resultado: o brief sempre retorna `has_data: false` → o LLM nunca recebe os padrões reais do canal. Há também duplicatas (cada vídeo aparece 2x).

Além disso, o `generate-script` chama `script-learning-context` apenas com `{ user_id, niche }` — nunca passa o `channel_id`, então quando o usuário tem múltiplos canais o brief mistura tudo.

## Objetivo

Fazer o feedback loop funcionar de ponta a ponta: cada `generate-script` recebe os melhores hooks/títulos **comprovados naquele canal específico** e evita os padrões fracos.

## Plano (3 frentes)

### 1. Backfill + enriquecimento dos dados (a base)
- Nova edge function **`enrich-video-performance`**: lê os 28 vídeos existentes (e os novos), e para cada um:
  - Resolve `channel_id` cruzando `youtube_video_id` → `video_projects.channel_id_ref` ou `user_channels.youtube_channel_id`
  - Resolve `niche` a partir do canal/projeto
  - Extrai `hook_type` (lista controlada: `pergunta`, `choque`, `historia`, `dado`, `polemica`, `curiosidade`, `lista`, `mistério`) via Gemini Flash analisando `title` + primeiros 200 chars do script (quando houver `script_id`)
  - Extrai `title_pattern` (template normalizado: ex. "PERGUNTA + REVELAÇÃO", "NÚMERO + CHOQUE", "NEGAÇÃO + AUTORIDADE")
  - Faz dedup por `(user_id, youtube_video_id)` mantendo o registro mais recente
- Migration: adiciona índice único `(user_id, youtube_video_id)` em `video_performance` para evitar novas duplicatas
- Cron diário: roda `enrich-video-performance` para vídeos com `hook_type IS NULL` (batch de 20)

### 2. Filtro por canal no generate-script
- `generate-script/index.ts`: aceitar `channel_id` no body (já vem do AutoPilot via `channel_id_ref`)
- Passar `channel_id` para `script-learning-context` — quando presente, brief é **só do canal**, não da conta inteira
- Mesma mudança em `generate-script-short` e `refine-script` (pequena edição de 1 chamada de fetch cada)

### 3. UI de transparência (mínima)
- Card no AutoPilot: **"Aprendizado do canal"** — mostra "X vídeos analisados, hook campeão: Y (retenção Z%)" puxando direto de `video_performance` agregado
- Na geração de roteiro, quando o brief é injetado, log estruturado `[CHANNEL-LEARNING] runId=… channel=… top_hook=… sample=…` para auditoria

## Detalhes técnicos

**Função enrich-video-performance** (Deno edge):
```
POST /enrich-video-performance
body: { user_id?, channel_id?, limit?: 20, force?: false }
→ { processed, hooks_extracted, channels_resolved, errors[] }
```
Usa `LOVABLE_API_KEY` + `google/gemini-2.5-flash-lite` com prompt JSON estruturado:
```
Classifique este vídeo:
title: "..."
script_intro: "..." (opcional)
Retorne {hook_type, title_pattern, niche_inferred}
```

**Migration:**
```sql
-- Dedup primeiro
DELETE FROM video_performance a USING video_performance b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.youtube_video_id = b.youtube_video_id;

CREATE UNIQUE INDEX IF NOT EXISTS video_performance_user_yt_unique
  ON video_performance(user_id, youtube_video_id);

CREATE INDEX IF NOT EXISTS video_performance_channel_idx
  ON video_performance(channel_id) WHERE channel_id IS NOT NULL;
```

**Cron** (pg_cron, diário 04:00 UTC) chamando `enrich-video-performance` com service role.

**Edits cirúrgicos:**
- `script-learning-context/index.ts`: já aceita `channel_id` — sem mudança
- `generate-script/index.ts` linha ~924: `body: JSON.stringify({ user_id, niche, channel_id })`
- `generate-script-short/index.ts` e `refine-script/index.ts`: adicionar mesma chamada (hoje não chamam)

## Validação

1. Rodar `enrich-video-performance` manualmente → verificar 28 vídeos com `hook_type` + `channel_id` populados
2. Chamar `script-learning-context` com `{user_id, channel_id}` → deve retornar `has_data: true, sample_size: ≥3`
3. Gerar 1 roteiro novo → conferir log `[CHANNEL-LEARNING] injected brief (n=…)` e que o roteiro segue o hook campeão

## Fora de escopo (próximas sprints)
- Análise de retention curve (drop-off por segundo)
- Análise de estrutura de atos (já mencionada na sprint anterior)
- A/B test automático de hooks
