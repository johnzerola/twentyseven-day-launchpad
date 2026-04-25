## Objetivo

Tornar o coletor de métricas reais do YouTube (CTR, AVD, retenção, comentários, impressões, watch time) **totalmente automático**, rodando em background a cada algumas horas e alimentando `video_performance` para que o resto da inteligência (script-learning-context, weekly strategy agent, viral diagnosis) consuma dados reais.

## Diagnóstico do que já existe

Já implementado e deployado:
- `supabase/functions/youtube-analytics-collector/index.ts` (397 linhas) — refresh OAuth, busca YouTube Data API + Analytics API + curva de retenção, atualiza `video_performance` com `ctr_percent`, `avg_view_duration_seconds`, `avg_retention_percent`, `impressions`, `subscribers_gained`, `watch_time_minutes`, `retention_curve` (jsonb), buckets `views_day1/3/7/30` e `performance_grade`.
- 3 canais OAuth conectados (`youtube_oauth_tokens`).
- Tabela `video_performance` com todas as colunas necessárias.
- `worker-callback` e `sync-oauth-performance` já fazem `upsert` na tabela quando vídeos são publicados.

O que **falta** (gap real):
1. **Não existe cron** chamando `youtube-analytics-collector`. Só existe `sync-channel-performance-weekly` (semanal, função diferente).
2. **Sem visibilidade** — não há painel mostrando última coleta nem indicador de saúde no AutoPilot.
3. **Sem dead-letter** — se OAuth de um canal expirar, erro fica apenas no JSON de retorno.

## Mudanças

### 1. Agendar 2 crons via `pg_cron` (executar SQL no banco — não migration)

- **`yt-analytics-fast`** — a cada **4 horas**, modo `incremental` (vídeos com < 48h de upload, throttle 4h entre checagens). Captura a janela viral.
- **`yt-analytics-daily`** — todo dia às **05:00 UTC**, modo `daily` (vídeos com até 30 dias, throttle 12h). Captura curva de maturação.

Ambos chamam `POST` para `/functions/v1/youtube-analytics-collector` com `{ mode, max_videos_per_channel: 50 }` usando `service_role` no header.

### 2. Pequena resiliência na função existente

Patches em `youtube-analytics-collector/index.ts`:
- Quando `refreshToken` falhar com `invalid_grant`, marcar `youtube_oauth_tokens.needs_reauth = true` (adicionar coluna se não existir) e seguir para o próximo canal em vez de explodir.
- Persistir cada execução em uma nova tabela leve `analytics_collector_runs (id, started_at, finished_at, mode, stats jsonb, errors jsonb)` para histórico/observabilidade.
- Corrigir `check_count` (hoje sobrescreve com 1 em vez de incrementar) — usar `rpc` ou query SQL direto via `update ... set check_count = check_count + 1`.

### 3. Migration mínima

Criar:
- Coluna `youtube_oauth_tokens.needs_reauth boolean default false` + `last_oauth_error text`.
- Tabela `analytics_collector_runs` (RLS: somente service-role escreve; admins leem).
- Índice `video_performance(user_id, last_checked_at)` para o coletor escalar.

### 4. Visibilidade no Dashboard (mínima)

Card "Coletor de Métricas" em `src/pages/AutoPilot.tsx` (ou criar `src/components/autopilot/AnalyticsCollectorCard.tsx`):
- Última run (timestamp, duração, vídeos atualizados/falhados).
- Botão "Coletar agora" (chama a função manualmente para o usuário logado, passando `user_id`).
- Aviso vermelho se algum canal estiver com `needs_reauth = true` (CTA para reconectar OAuth).

Lê de `analytics_collector_runs` (top 1) e `youtube_oauth_tokens` (count where needs_reauth).

## Decisões já implícitas pelo contexto da sprint

- **Volume**: até 50 vídeos por canal por execução (já é o default).
- **Quem chama**: cron com `service_role`, não usuário.
- **Aprovação**: nenhuma — coleta é sempre automática.

## Sem alterações em

- `script-learning-context` — já consome `video_performance`, vai pegar dados frescos sozinho.
- `weekly-deep-research` / weekly strategy agent — idem.
- Quotas YouTube API — função já tem `setTimeout(120ms)` entre vídeos; com 3 canais × 50 vídeos a cada 4h = ~900 chamadas/dia, bem dentro da cota de 10k/dia.

## Detalhes técnicos para implementação

```
┌────────────────────────────────────────────────────┐
│ pg_cron                                            │
│  ├─ yt-analytics-fast    (*/4 * * * *  → 4h)       │ mode=incremental
│  └─ yt-analytics-daily   (0 5 * * *)               │ mode=daily
└────────────────┬───────────────────────────────────┘
                 │ net.http_post
                 ▼
   youtube-analytics-collector (já existe)
                 │
       ┌─────────┼──────────────┐
       ▼         ▼              ▼
   YT Data   YT Analytics   Retention curve
       │         │              │
       └─────────┴──────────────┘
                 ▼
          video_performance  ──►  script-learning-context
                                  weekly strategy agent
                                  viral diagnosis
                 ▼
       analytics_collector_runs (novo, observabilidade)
```

Arquivos a tocar:
- **Insert SQL** (não migration, pois usa anon key no header): cria os 2 cron jobs.
- **Migration**: `youtube_oauth_tokens.needs_reauth`, `last_oauth_error`, tabela `analytics_collector_runs`, índice em `video_performance`.
- **Edit**: `supabase/functions/youtube-analytics-collector/index.ts` — handle `invalid_grant`, persist run, fix `check_count`.
- **New component**: `src/components/autopilot/AnalyticsCollectorCard.tsx`.
- **Edit**: `src/pages/AutoPilot.tsx` — montar o card.
- **Deploy**: `youtube-analytics-collector`.

## Resultado esperado

- A cada 4h o sistema puxa CTR/AVD/retenção reais sem ninguém clicar em nada.
- Dashboard mostra "Última coleta: há 12 min — 23 vídeos atualizados".
- Se OAuth expira, usuário vê alerta e botão para reconectar.
- Inteligência do canal (script-learning-context, weekly agent) passa a operar sobre dados reais e atualizados.
