## Objetivo

Criar um **agente estratégico semanal por canal** que toda semana:

1. Lê performance dos últimos 7 dias do canal (CTR, retenção, top hooks/títulos do `video_performance` já alimentado pelo coletor da sprint anterior).
2. Lê referências do nicho (canais em `user_reference_channels` + `channel_intelligence` + `emerging_videos` + `competitor_benchmark_json` + curadoria de `niche_database`).
3. Pede ao LLM (Gemini 2.5 Pro) para decidir os **N temas da próxima semana** (N = `user_channels.weekly_video_target`, 1–7), com ângulo, hook sugerido, título, duração, justificativa baseada em dados.
4. Persiste o plano em `weekly_strategy_plans` (auditoria).
5. Cria N rows em `video_projects` com `created_by_agent=true` + `strategy_plan_id`, agendando os slots futuros via o já-existente `autopilot-scheduler` (mesmo `posting_days`/`posting_hour`/`min_interval_hours` do canal).

## O que já existe (não duplicar)

- `user_channels.strategist_enabled` (todos os 10 canais já estão `true`) e `weekly_video_target`.
- `user_channels.competitor_benchmark_json`.
- `video_projects.created_by_agent` + `strategy_plan_id`.
- `youtube-analytics-collector` (sprint anterior) já popula `video_performance` em tempo real.
- `script-learning-context` já gera o brief de top hooks/títulos por canal.
- `weekly-deep-research` puxa tendências GLOBAIS do nicho (já roda Dom 02:00).
- `find-competitors-ai` + `channel_intelligence` já guardam padrões dos concorrentes.
- `autopilot-scheduler` já sabe distribuir slots novos respeitando `posting_days`/`posting_hour`/`min_interval_hours`/`weekly_video_target` para uma janela de 14 dias.
- `suggest-themes` existe mas é interativa (sem persistência, sem schedule).

## O que falta — esta sprint

### 1. Migration

Tabela nova `weekly_strategy_plans`:
- `id`, `user_id`, `channel_id`, `week_start` (date, segunda da semana-alvo), `created_at`.
- `performance_summary jsonb` — snapshot do que o agente leu (top 5 vídeos, deltas vs semana anterior, baselines CTR/AVD).
- `niche_signals jsonb` — top emerging videos, padrões de concorrentes, format_shift detectado.
- `themes jsonb` — array de N decisões: `{ title, topic, angle, hook, duration_seconds, video_type, reasoning, suggested_scheduled_at }`.
- `model_used text`, `tokens_used int`, `cost_usd numeric`.
- `status text` — `draft | applied | failed`.
- `applied_project_ids uuid[]`.
- Unique constraint `(channel_id, week_start)` para idempotência.
- RLS: dono do canal lê; service-role escreve.

Coluna nova `user_channels.strategist_last_run_at timestamptz` para visibilidade.

### 2. Edge Function `weekly-strategy-agent`

Service-role only. Aceita `{ channel_id?, dry_run?, force? }`:
- Sem `channel_id` → varre todos os canais com `strategist_enabled = true` e `weekly_video_target >= 1`.
- Para cada canal, em paralelo (com cap de concorrência=3):
  - **Calcula `week_start`** = próxima segunda UTC.
  - **Idempotência**: pula se já existe plano `applied` para esse `(channel_id, week_start)` salvo se `force=true`.
  - **Coleta performance** (últimos 7 dias) via SQL direto em `video_performance` filtrado por `channel_id`: top 5 por `views_current`, médias CTR/AVD/retention, hooks/títulos vencedores.
  - **Coleta sinais do nicho**: `user_reference_channels.latest_intel`, `emerging_videos` por niche (top 10 últimas 7 dias), `competitor_benchmark_json` do canal, `niche_database` para saturação/RPM.
  - **Monta prompt único para Gemini 2.5 Pro** com 4 blocos: (a) identidade do canal (`character_name`, `niche`, `language`, `visual_style_prompt`), (b) performance, (c) sinais de nicho, (d) instruções para escolher N temas com tom/duração ajustados ao que está performando.
  - **Resposta JSON estruturada**: `{ themes: [{ title, topic, angle, hook, video_type, duration_seconds, reasoning }] }`.
  - Persiste em `weekly_strategy_plans` com `status='draft'`.
  - **Se `dry_run` for false** (default): cria N rows em `video_projects` com `status='draft'` (não `ready_for_production` — deixa o `autopilot-scheduler` decidir o slot e o usuário/autopilot promover quando pronto), `created_by_agent=true`, `strategy_plan_id=plan.id`, e copia `niche`/`channel_id_ref`/`video_type`/`duration_seconds`/intelligence_json com hook+angle+reasoning.
  - Atualiza plan para `status='applied'` + `applied_project_ids`.
  - Atualiza `user_channels.strategist_last_run_at = now()`.
- Loga cada execução em `function_traces` para auditoria.

### 3. Cron semanal

Via `pg_cron` (insert, não migration, pois usa anon key) — **Domingo 23:00 UTC**, depois do `weekly-deep-research` (02:00) e do competitor scan (`weekly-channel-rescan` 03:00) que rodaram na manhã do mesmo domingo. Agenda para próxima segunda em diante.

```
nome: weekly-strategy-agent
cron: 0 23 * * 0
body: {}  (varre todos os canais elegíveis)
```

### 4. UI — visibilidade

Em `src/pages/AutoPilot.tsx`, novo card **"Agente Estratégico Semanal"** abaixo do `AnalyticsCollectorCard`:
- Mostra última execução (`strategist_last_run_at` do canal selecionado), próxima `week_start` planejada, contagem de temas decididos.
- Lista os N temas da semana atual em accordion: título, ângulo, hook, justificativa, link para o `video_project` criado.
- Botão "Rodar agora" (chama com `force=true` para o canal selecionado).
- Toggle on/off ligado a `user_channels.strategist_enabled`.

Tag visual nos cards de projeto em `AutoPilot` quando `created_by_agent=true` → badge "Agente Semanal" (cor primária, ícone de sparkles).

### 5. Sem alterações em

- `weekly-deep-research`, `suggest-themes`, `autopilot-scheduler`, `youtube-analytics-collector`, `script-learning-context` — todos consumidos como estão.
- Os projetos criados pelo agente passam pelo mesmo fluxo de produção (`task-worker`, `pre-upload-guard`, upload).

## Decisões já implícitas no contexto da sprint anterior

- **Auto-aprovar**: cria os 7 projetos já agendados (sprint anterior aprovou).
- **Quando rodar**: Domingo 23:00 UTC.
- **Volume**: usa `weekly_video_target` do canal (já default 1, podendo ser 3–7).
- **Visibilidade**: dashboard + tag no AutoPilot.

## Detalhes técnicos

```
┌─────────────────────────────────────────────────────────────┐
│ Domingo 02:00 UTC → weekly-deep-research (knowledge global) │
│ Domingo 03:00 UTC → weekly-channel-rescan (concorrentes)    │
│ Domingo 06:00 UTC → auto-intelligence-weekly (refs canais)  │
│ Domingo 23:00 UTC → weekly-strategy-agent ← NOVO            │
└──────────────────────┬──────────────────────────────────────┘
                       │ para cada canal com strategist_enabled
                       ▼
   ┌─────────────────────────────────────────┐
   │ READ                                    │
   │  • video_performance (últimos 7d)       │
   │  • user_reference_channels.latest_intel │
   │  • emerging_videos por niche            │
   │  • competitor_benchmark_json            │
   │  • niche_database                       │
   └────────────────┬────────────────────────┘
                    ▼
            Gemini 2.5 Pro
            (1 chamada/canal)
                    ▼
   ┌─────────────────────────────────────────┐
   │ WRITE                                   │
   │  • weekly_strategy_plans (auditoria)    │
   │  • N × video_projects (status=draft,    │
   │    created_by_agent=true,               │
   │    strategy_plan_id=plan.id)            │
   │  • user_channels.strategist_last_run_at │
   └────────────────┬────────────────────────┘
                    ▼
        autopilot-scheduler (já existe)
        distribui N slots em channel_schedule
                    ▼
        task-worker pega normalmente
```

Custo estimado por execução: 10 canais × ~6k tokens prompt + 2k resposta com gemini-2.5-pro ≈ $0.40/semana total.

Quotas/concorrência: cap de 3 canais simultâneos para não estourar quota Gemini.

## Arquivos

- **Migration**: `weekly_strategy_plans` (com RLS e unique constraint), coluna `user_channels.strategist_last_run_at`.
- **Insert (cron)**: `pg_cron` job `weekly-strategy-agent` em `0 23 * * 0`.
- **Nova edge function**: `supabase/functions/weekly-strategy-agent/index.ts` (~400 linhas).
- **Novo componente**: `src/components/autopilot/WeeklyStrategistCard.tsx`.
- **Edit**: `src/pages/AutoPilot.tsx` — montar o card e badge "Agente Semanal" nos cards de projeto.

## Resultado esperado

Toda segunda-feira de manhã, cada canal acorda com 1–7 projetos novos prontos no pipeline, com temas escolhidos com base no que está bombando no nicho e no que vem performando bem dentro do próprio canal. Usuário não precisa "alimentar" tema nenhum — o canal se auto-alimenta. No dashboard, vê em 1 clique o raciocínio do agente para cada vídeo da semana.
