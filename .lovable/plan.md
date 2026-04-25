## Objetivo

Toda semana, para cada canal do usuário, varrer o YouTube em busca de **vídeos viralizando no nicho dele** e gerar um **dossiê de referências** com padrões consolidados (títulos, thumbnails, duração, estrutura narrativa). O dossiê:

1. Aparece em uma nova aba na UI do AutoPilot.
2. É injetado automaticamente no `generate-script` para guiar a próxima leva de roteiros.

## Por que isso (o que já existe vs. o que falta)

Já existe muita base:
- `find-outliers` (caça vídeos virais por keyword) — só roda **manual**
- `weekly-deep-research` (insights globais)
- `weekly-channel-rescan` (rescan de canais já cadastrados)
- Tabelas `emerging_videos`, `thumbnail_patterns`, `hook_patterns`

O que **não existe**:
- Job semanal que roda `find-outliers` automaticamente para cada nicho dos canais ativos do usuário
- Consolidação dos achados em um "boletim semanal" persistido e navegável
- Extração explícita de padrões de **duração** e **estrutura narrativa** (atos, hook, payoff)
- Injeção desses padrões no prompt do `generate-script` (hoje só usa canais de referência cadastrados manualmente)

## O que será construído

### 1. Tabela `niche_reference_reports`

Um relatório por canal/semana com tudo consolidado.

```text
niche_reference_reports
├── id, user_id, channel_id, niche, language
├── week_start (date)             -- segunda-feira da semana ISO
├── status (queued|running|done|failed)
├── videos_analyzed (int)
├── top_videos (jsonb)            -- [{video_id, title, thumb, views, duration_s,
│                                     channel_name, multiplier, published_at, url}]
├── title_patterns (jsonb)        -- [{pattern, examples, avg_views, why_works}]
├── thumbnail_patterns (jsonb)    -- [{style, emotion, color_scheme, text_overlay,
│                                     examples_urls, ctr_signal}]
├── duration_insights (jsonb)     -- {sweet_spot_seconds, range, distribution}
├── structure_insights (jsonb)    -- {acts:[{name, avg_seconds, beats}],
│                                     hook_styles, payoff_styles, retention_tactics}
├── ai_summary (text)             -- briefing de 1 página em PT
├── prompt_injection (text)       -- bloco compacto pronto para o generate-script
└── created_at, updated_at
```

RLS: dono lê/escreve; service_role faz tudo.

### 2. Edge function `weekly-niche-references` (nova)

Para cada `user_channels` com `autopilot_enabled = true` (ou rodada manual para um canal específico):

1. Lê niche/idioma/país do canal.
2. Chama `find-outliers` internamente (já existe) com `keywords = niche`, `publishedAfterDays = 14`, `minMultiplier = 5`, `maxResults = 30`, `extractDNA = true`.
3. Para os top 8 vídeos retornados:
   - Reaproveita `extract-content-dna` ou `reverse-engineer-video` para obter estrutura/atos/hook.
   - Calcula sweet spot de duração (mediana + p25/p75 dos top performers).
4. Roda **uma chamada Gemini Flash** que recebe os 8 dossiês e devolve via tool-call estruturado:
   - `title_patterns`, `thumbnail_patterns`, `duration_insights`, `structure_insights`, `ai_summary`, `prompt_injection`.
5. Salva em `niche_reference_reports` (upsert por `channel_id + week_start`).

Status passa por `queued → running → done` para a UI poder mostrar progresso.

### 3. Cron semanal

`pg_cron`: **toda segunda às 06:00 UTC** dispara `weekly-niche-references` em modo "all channels". O cron processa os canais em sequência (5/lote) para não estourar a quota da YouTube API.

Também adiciono cron para `detect-emerging-channels` (que está parado há 7+ dias) — **terça às 07:00 UTC**.

### 4. Integração com `generate-script` (o ponto que fecha o loop)

Em `generate-script/index.ts`, junto com o `channelLearningBrief` que já existe, adicionar:

```ts
const fetchWeeklyReferenceBrief = async () => {
  const { data } = await sb
    .from("niche_reference_reports")
    .select("prompt_injection, week_start")
    .eq("channel_id", channel_id)
    .eq("status", "done")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.prompt_injection ? `\n\n📅 REFERÊNCIAS DA SEMANA (${data.week_start}):\n${data.prompt_injection}\n` : "";
};
```

E concatena no `learningLoopInjection` existente. Mesma coisa em `generate-script-short`.

### 5. UI: aba "Referências Semanais" no AutoPilot

Novo componente `WeeklyReferencesCard.tsx`:
- Selector de canal (reaproveita o pattern dos cards já existentes).
- Card do relatório mais recente:
  - Resumo IA (1 parágrafo)
  - Grid 4×2 dos top vídeos (thumb + título + views + multiplicador + link YouTube)
  - 4 mini-blocos: **Padrões de título**, **Padrões de thumbnail**, **Duração ideal**, **Estrutura narrativa**
  - Botão "Atualizar agora" (dispara a função para esse canal)
  - Selector de semanas anteriores
- Estado vazio: "Nenhum relatório ainda — rodando primeira coleta…" com botão para disparar.

Integrado em `src/pages/AutoPilot.tsx` ao lado do `WeeklyStrategistCard` (faz par natural: este descobre referências, o outro decide os 7 temas).

## Detalhes técnicos

- **Custos**: 1 chamada Gemini Flash por relatório (~600 tokens de input, ~1500 de output). 10 canais × 1×/semana ≈ irrelevante (~$0.02/semana). Reuso do `find-outliers` evita refazer chamadas YouTube API.
- **Idempotência**: `UNIQUE (channel_id, week_start)` em `niche_reference_reports`. Re-execuções na mesma semana só atualizam.
- **Quota YouTube**: usa o helper `check_and_increment_api_usage` antes de cada lote de chamadas.
- **Schema do tool-call**: Gemini é forçado a JSON via `tool_choice` (padrão já usado em `weekly-strategy-agent`).
- **`script-learning-context`**: não muda — é complementar (aquele aprende do canal próprio; este traz referências de fora).

## Arquivos

**Criar:**
- `supabase/migrations/<ts>_weekly_niche_references.sql` — tabela + índices + RLS + cron (segunda 06:00 UTC) + cron emerging-channels (terça 07:00)
- `supabase/functions/weekly-niche-references/index.ts`
- `src/components/autopilot/WeeklyReferencesCard.tsx`

**Editar:**
- `src/pages/AutoPilot.tsx` — adicionar o novo card
- `supabase/functions/generate-script/index.ts` — adicionar `fetchWeeklyReferenceBrief` ao bloco `learningLoopInjection`
- `supabase/functions/generate-script-short/index.ts` — mesma injeção

## Fora de escopo desta sprint

- Análise frame-a-frame de thumbnails (já dá pra descobrir padrão pelo que `find-outliers` extrai + URLs).
- Comparação cross-canal entre referências semanais (ex.: "essa semana surgiu padrão novo X que não existia mês passado") — fica para sprint seguinte se você quiser.
- Tradução automática das referências para outros idiomas do canal (já trato `language` na busca, mas não traduzo título de retorno).
