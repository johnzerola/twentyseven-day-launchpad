

# ChannelHacker v2 — Overhaul Completo Inspirado em TubeMine + HacksLabs + DottiFlow

## Problema Principal: Busca de Canais

A API key do YouTube esta exposta no frontend (`ChannelSearch.tsx` linha 22, `Channels.tsx` linha 23). Alem do risco de seguranca, chamadas diretas do browser podem falhar por restricoes de referer/quota. A solucao e mover TODAS as chamadas YouTube para edge functions que ja tem a key configurada como secret.

---

## Arquitetura das Mudancas

```text
FRONTEND (React)          EDGE FUNCTIONS              EXTERNAL APIs
                                                       
ChannelSearch.tsx  ──►  search-videos/index.ts  ──►  YouTube Data API v3
Channels.tsx       ──►  analyze-channel (exists) ──►  YouTube Data API v3
                   ──►  niche-explorer/index.ts ──►  YouTube + Lovable AI
                   ──►  estimate-revenue/index.ts──► Lovable AI
Narration.tsx      ──►  generate-tts/index.ts   ──►  Google Cloud TTS (free tier)
```

---

## Fase 1: Corrigir Busca (Edge Function `search-videos`)

**Problema:** Chamadas YouTube feitas direto do browser com API key exposta.

- Criar edge function `search-videos` que recebe query + filtros
- Move toda logica de busca do `ChannelSearch.tsx` (linhas 86-153) para server-side
- Inclui channel stats batching e outlier detection no server
- Frontend so chama `supabase.functions.invoke('search-videos', {...})`
- Remove a constante `YOUTUBE_API_KEY` do frontend

---

## Fase 2: Niche Explorer (Inspirado HacksLabs)

Nova pagina `/niches` com funcionalidades do HacksLabs:

- **Database de nichos** com RPM estimado por pais/categoria
- **Viral Score** calculado: growth_rate, outlier_count, engagement, views_per_sub
- **Badge Faceless** automatico (detectado via AI analise de thumbnails)
- **Filtros**: RPM, idioma, tipo (faceless/camera), subs range
- **Top 100 trending** videos por nicho/pais
- Edge function `niche-explorer` que busca videos trending por nicho, agrupa por canal, calcula metricas

---

## Fase 3: Channel Spy (Inspirado DottiFlow Dotti Spy + TubeMine Tracking)

Adicionar a `Channels.tsx`:

- **Verificacao de monetizacao** (heuristica: canal tem 1000+ subs + 4000h watch time)
- **VPH** (views per hour) nos videos recentes
- **Canais similares** (busca por niche keywords)
- **Tracking/Favoritos** de canais concorrentes (nova tabela `tracked_channels`)
- **Alertas** quando canal trackeado posta video novo

---

## Fase 4: Revenue Estimator (HacksLabs-style)

Nova edge function `estimate-revenue`:

- Recebe nicho, pais, views projetadas
- Calcula RPM por pais (tabela interna de RPMs medios)
- Retorna projecao conservadora/esperada/agressiva
- Dashboard widget com grafico de projecao 27 dias (Recharts)

---

## Fase 5: AI Branding (HacksLabs-style)

Nova edge function `generate-branding`:

- Recebe nicho, estilo, idioma
- Usa Lovable AI para gerar: nome de canal, descricao, tags SEO, sugestoes de banner
- Usa `google/gemini-3-pro-image-preview` para gerar logo/thumbnail
- Nova pagina `/branding` com galeria de resultados

---

## Fase 6: Narration com Google Cloud TTS (sem ElevenLabs)

Como ElevenLabs foi recusado, usar Google Cloud TTS (gratis ate 1M chars/mes):

- Edge function `generate-tts` usando a API REST do Google Cloud TTS
- Suporta PT-BR, EN-US, DE-DE, PL-PL, ES-ES
- Retorna audio MP3 para download
- Refatorar `Narration.tsx` para chamar a edge function real
- Requer secret `GOOGLE_CLOUD_TTS_KEY`

---

## Fase 7: Dotti Titles (DottiFlow-style)

Adicionar ao Script Generator:

- Botao "Gerar Titulos" que usa AI para sugerir 10 titulos por nicho
- CTR score estimado para cada titulo
- A/B test visual (mostra 2 titulos lado a lado)
- Integrado no `Scripts.tsx` existente

---

## Fase 8: Channel Emulation (HacksLabs 1-click)

Na busca de canais, ao clicar num canal:

- Botao "Emular Canal" que analisa os top 10 videos do canal
- Gera roadmap: titulos sugeridos, formatos, frequencia, keywords
- Salva como rascunho de plano vinculado ao canal
- Edge function `emulate-channel` usando Lovable AI

---

## Fase 9: Planner Multi-Canal (DottiFlow Dotti Planner)

Expandir `Plan.tsx`:

- Suportar multiplos planos (um por canal)
- Calendario visual com dias e status
- Frequencia de posts configuravel
- Notificacoes de deadline (in-app toast)

---

## Database Changes

```sql
-- Tabela de nichos com RPM
CREATE TABLE public.niche_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL,
  country text DEFAULT 'BR',
  rpm_estimate numeric DEFAULT 0,
  faceless_friendly boolean DEFAULT false,
  trending_score numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Canais trackeados/favoritos
CREATE TABLE public.tracked_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  youtube_channel_id text NOT NULL,
  channel_name text NOT NULL,
  thumbnail text,
  subscribers bigint DEFAULT 0,
  folder text DEFAULT 'default',
  last_video_check timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, youtube_channel_id)
);

-- Branding gerado por AI
CREATE TABLE public.generated_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  niche text,
  channel_name_suggestions jsonb DEFAULT '[]',
  description text,
  seo_tags jsonb DEFAULT '[]',
  logo_url text,
  created_at timestamptz DEFAULT now()
);
```

RLS policies para todas as tabelas com `auth.uid() = user_id`.

---

## Edge Functions Novas

| Function | Descricao |
|----------|-----------|
| `search-videos` | Busca YouTube server-side com filtros e outlier detection |
| `niche-explorer` | Trending por nicho + viral score + RPM |
| `estimate-revenue` | Projecao de receita 27 dias |
| `generate-branding` | Nome, logo, descricao com AI |
| `emulate-channel` | Analise e roadmap de emulacao |
| `generate-tts` | Google Cloud TTS para narracao |

---

## Novas Paginas/Rotas

| Rota | Descricao |
|------|-----------|
| `/niches` | Niche Explorer (HacksLabs-style) |
| `/branding` | AI Branding generator |

---

## Sidebar Atualizada

```text
Dashboard
Meus Canais
Busca de Videos
Niche Explorer (NOVO)
Roteiros
Narracao
Branding AI (NOVO)
Plano 27 Dias
```

---

## Prioridade de Implementacao

1. **Corrigir busca** (mover para edge function) -- resolve o bug imediato
2. **Niche Explorer** -- feature mais diferenciadora
3. **Revenue Estimator** -- alto valor percebido
4. **Channel Spy/Tracking** -- engagement diario
5. **AI Branding** -- diferencial vs concorrentes
6. **Emulate Channel** -- funcionalidade viral
7. **Narration TTS** -- requer secret de API
8. **Planner Multi-Canal** -- melhoria incremental

