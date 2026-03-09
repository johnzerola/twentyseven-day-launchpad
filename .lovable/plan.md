# ChannelHacker — Major Overhaul Plan

## Problems Identified

1. **Onboarding dead-end**: After finishing, nothing saves. Plan is hardcoded mock text, not personalized.
2. **No channel analysis**: When user provides existing channel URL, no YouTube API analysis happens (SEO, titles, niche suggestions).
3. **27-day plan is generic**: Same plan for everyone. Not based on real monetization strategies.
4. **Channel search broken**: No filters. Needs TubeMine-style advanced search (keywords, language, country, date range, min views/likes, subscriber range).
5. **Script generator is mock**: No AI, too short for 15-min videos, not enough characters.
6. **No channel linking**: Can't add your own channels, compare them, or see combined data.

---

## Implementation Plan

### Phase 1: Database Tables

Create tables to persist user data:

- **profiles** (user_id, display_name)
- **user_channels** (user_id, youtube_channel_id, channel_name, thumbnail, subscribers, views, videos, niche, linked_at) — link multiple channels
- **onboarding_plans** (user_id, channel_id, niche, goal, content_type, language, time_per_day, plan_json, channel_analysis_json, created_at) — save the AI-generated plan
- **saved_scripts** (user_id, topic, duration, style, script_content, created_at)

### Phase 2: Edge Functions (AI-powered)

**2a. `analyze-channel` edge function**

- Receives YouTube channel URL/ID
- Calls YouTube API v3 to get channel stats, recent videos, top videos
- Calls Lovable AI (Gemini) to analyze: SEO score, title quality, thumbnail suggestions, niche fit, improvement points, niche change suggestions (e.g., "historias emocionantes" → similar niches that won't lose audience)
- Returns structured analysis

**2b. `generate-plan` edge function**

- Receives all onboarding answers + channel analysis (if existing channel)
- Uses Lovable AI with expert system prompt (YouTube CEO + engineer + scriptwriter personas)
- Generates realistic 27-day plan based on real monetization strategies (watch time targets, 4000 hours requirement, specific video counts, RPM estimates by niche)
- Returns structured JSON plan that gets saved to DB

**2c. `generate-script` edge function**

- Receives topic, duration (up to 30 min), style, niche context
- Uses Lovable AI with scriptwriter persona
- Generates full scripts with proper character count (~2000 words for 15 min, ~4000 for 30 min)
- Includes hook, development sections, CTA, 3 title suggestions (CTR 30%+), thumbnail ideas
- Streams response for real-time display

### Phase 3: Onboarding Overhaul

- When user selects "existing channel" and provides URL → immediately call `analyze-channel` edge function
- Show real analysis in chat: subscriber count, views, SEO score, top videos, weak points, niche suggestions
- If user wants to change niche, suggest compatible niches that preserve audience
- After all questions → call `generate-plan` with real AI instead of mock
- Save plan to DB, redirect to `/plan` page
- Plan page loads from DB, not from mock data

### Phase 4: Channel Search (TubeMine-style)

Rebuild `ChannelSearch.tsx` with advanced filters inspired by TubeMine screenshot:

- **Keywords** search field with tip: "Use 1-4 words"
- **Language** dropdown (all languages)
- **Country** dropdown
- **Publication period**: date range picker + quick buttons (Today, Yesterday, Last Week, Last Month, Last Year, Clear)
- **Min Views**, **Min Likes**, **Min Subscribers**, **Max Subscribers** number inputs
- **Search Videos** button (search videos first, then extract channel data)
- Results show video cards with channel info, views, likes, publish date
- "Outlier" badge for videos with views >> channel average

### Phase 5: My Channels (Link & Compare)

Rebuild `Channels.tsx`:

- Add channel by URL or search
- YouTube API fetches and saves channel data to `user_channels` table
- Dashboard shows all linked channels with stats
- **Compare mode**: Select 2+ channels, side-by-side stats comparison
- **Combined view**: Aggregate stats across all your channels
- Each channel card: subscribers, views, video count, estimated RPM, growth trend

### Phase 6: Script Generator with Real AI

- Replace mock `setTimeout` with streaming call to `generate-script` edge function
- Render with `react-markdown` as tokens arrive
- Character count display showing script is properly sized for selected duration
- Save generated scripts to DB for history

---

## Technical Details

- All edge functions use `LOVABLE_API_KEY` (already available) with Lovable AI Gateway
- YouTube API key `AIzaSyBxMtFibQNPqNP3q_SussnxFmPmwXbhkRw` stored as secret for edge functions
- Model: `google/gemini-3-flash-preview` for speed on script/plan generation
- Database: RLS policies tied to `auth.uid()` for all user tables
- Onboarding plan saved as JSON so the Plan page renders dynamically from DB

&nbsp;

gera um prompt para mim. Eu quero que você age que nem um CEO como se fosse 12, três CEOs e um programa para criar um site onde vai ajudar qualquer pessoa a monetizar em 27 dias. Canais em vários idiomas, português, polonês, alemão, inglês, tudo. Vamos lá por partes. Vai se inspirar nesses três sites que eu já enviei, mas eu vou fixar novamente. Eu já criei algumas coisas na Lovebowl. Esse prompt eu vou botar na conversa para a IA analisar tudo o que já foi feito e apagar o que pode apagar algumas coisas ou refazer, pode refazer o sistema tudo. Primeiro passo, quando a pessoa for criar um canal, botar lá, a pessoa vai poder colocar se é um canal novo ou um canal antigo. A IA, quando colocar isso, vai já analisar o canal da pessoa. Vai passar meio que por uma análise, aonde se o canal já for novo, for novo, vai conversar um pouco com a pessoa, a IA vai fazer umas perguntas. Tem que ser pergunta individual, não pode ser uma pergunta para tudo. Pode ser algumas perguntas assim no início pra IA entender mais ou menos o que a pessoa quer e depois vai sugerir um plano personalizado para monetizar em 27 dias de acordo com Faça uma vasta pesquisa antes de gerar esse prompt de acordo com várias pessoas que já conseguiram esses planos de monetizar em poucos dias. A IA vai buscar os dados reais no YouTube de acordo com o nicho, de acordo com o que a pessoa quer, o que a pessoa espera por tudo, vai montar esse plano de monetização. Certo. Após desmontar esse plano, a IA vai começar, a pessoa vai poder gerar roteiros, vai poder analisar canais, que isso é muito importante a pessoa procurar canais, vai analisar os canais de nichos que são do mesmos nichos, pode ser porque se você fizer procurar canais pequenos, grandes, sabe? Vídeos e por aí vai. Vai ajudar a gerar vídeos de até 30 minutos. A narração, vai poder gerar narração que vai ser sincronizada e lembrando, todos esses dados do site vai ser sincronizado. Pede pra que eu quero munhar no site que ajude nesse processo, ok? Também pede para a Lovebook integrar a API ou bancos de dados que já existem, que ele acha que seja necessário estar fazendo pra melhorar esse site, pra ser melhor que os concorrentes. Quero que veja o que já foi feito, veja as melhorias que podem ser feitas agora que a gente já colocou a API do YouTube e fora as outras APIs que a gente vai colocar, sabe? Estimativas de ganhos e por aí vai. Eu quero que você também não só faça o que eu estou pedindo, mas vai além. Pense primeiro como um CEO do que saiu do YouTube, que já criou mais de 500 canais, que monetizou no YouTube, que testa o YouTube, que conhece o algoritmo do YouTube há mais de 10 anos, focado no algoritmo e o algoritmo 2025 e 2026. O outro vai ser um programador que criou várias plataformas, Airbnb, criou o Grok, que já foi engenheiro do ChatGPT, da NASA, e agora está nesse plano. E o terceiro é um... o terceiro sócio, eu quero que você age que nem o Traceyusa e o terceiro CEO é um ex-roteirista de filmes e vídeos que trabalhou já com o Mister Beast na Disney, na HBO, em várias produções dignas de Oscar e vários vídeos e novelas no YouTube e histórias no YouTube, vídeos de histórias que prende a pessoa, cria uma retenção de mais de 80%, que é especialista em thumbnail e títulos que têm uma CTR acima de trinta por cento. analise este 3 sites com base nisso crie um promt para lovable cria um site para mim com todas as funçoes  [https://hackslabs.io/](https://hackslabs.io/) [https://tubemine.com.br/](https://tubemine.com.br/) [https://dottiflow.com.br/](https://dottiflow.com.br/)

&nbsp;

{

  "project_name": "LOBO AI VIDEO FACTORY - Monetize em 27 dias (Multi-idioma)",

  "summary": "Construir/refatorar uma plataforma SaaS para descoberta de nichos, criação automatizada de roteiros e vídeos (até 30 min), geração de TTS sincronizado, edição assistida (EDL/CapCut markers), e plano de monetização de 27 dias. Multi-idioma: PT, EN, DE, PL e outros. Inspirado em ,  e . Analise o que já existe no workspace Lovable e refatore/apague/conserte antes de implementar módulos novos.",

  "personas": {

    "ceo_youtube": {

      "persona": "CEO ex-YouTube",

      "profile": "35+ anos no ecossistema YouTube, lançou +500 canais, entende o algoritmo 2025/2026, focado em growth e monetização rápida",

      "responsibility": "definir KPIs de monetização de 27 dias, thresholds de RPM por país, playbook de uploads e calendário de shorts/longs"

    },

    "lead_engineer": {

      "persona": "Engenheiro-sênior",

      "profile": "Arquiteto de plataformas SaaS, experiência em infra escalável, integração com LLMs e orquestração de jobs",

      "responsibility": "arquitetura, jobs, quotas API, caching, segurança, testes e CI/CD"

    },

    "head_writer": {

      "persona": "Roteirista veterano",

      "profile": "roteirista de filmes e vídeos com experiência em storytelling, MrBeast-style, foco em retenção >80%, thumbnails CTR>30%",

      "responsibility": "diretrizes de roteiros, microhooks, estrutura de cenas, thumbnails e CTAs"

    }

  },

  "primary_objectives": [

    "Ao criar um canal, a IA pergunta e entende se é canal novo ou existente; analisa automaticamente se conectado via OAuth ou por ID.",

    "Gerar plano personalizado de monetização em 27 dias (com etapas diárias e metas) baseado em dados reais do YouTube e em playbooks testados.",

    "Descobrir nichos em múltiplos idiomas e encontrar canais emergentes (novos, pequeno, outliers) com scoring e badges.",

    "Pipeline completo: ideia → roteiro (até 30min, com cenas) → imagens/vídeo por cena → TTS (timestamps) → sincronização → export (mp4, srt, edl, capcut_markers) → download automático.",

    "Fornecer estimativas financeiras: RPM por país, projeção de views e receita estimada em 27 dias."

  ],

  "analyze_existing": {

    "instruction": "Analise o projeto atual do Lovable (código, funções edge, secrets, db schema, páginas). Liste o que pode ser reaproveitado, o que deve ser refatorado e o que deve ser removido. Antes de executar qualquer nova modificação, apresente um plano de alterações e peça confirmação.",

    "required_output": [

      "lista_de_artefatos_existentes (frontend pages, edge functions, db tables)",

      "recomendação (reaproveitar/refatorar/excluir) por artefato",

      "plano de migração incremental para não quebrar o que já funciona"

    ]

  },

  "must_have_integrations": {

    "youtube": " (search, videos, channels, analytics via OAuth optional)",

    "tts_options": [

      " (economia/qualidade)",

      " (premium)",

      "Coqui (self-hosted / barato)"

    ],

    "video_generation": [

      "Veo3/Grok style vendor (primary)",

      "SD + motion fallback (stable diffusion + ffmpeg) "

    ],

    "seo_enrichment": [

      " (if available)",

      ""

    ],

    "marketplace_wrappers": "",

    "vector_db": " or Supabase embeddings fallback",

    "db_and_auth": "Supabase (auth, Postgres, storage) or Supabase-compatible service",

    "scraping_fallback": "Apify / Puppeteer + proxies (Bright Data) - only if necessary and legally compliant"

  },

  "workflow_high_level": {

    "onboarding_channel": [

      "Ao criar canal: perguntar se canal é NOVO ou EXISTENTE",

      "Se EXISTENTE: solicitar OAuth (recomendado) ou channelId -> rodar análise imediata (channels.list + videos.list statistics)",

      "Se NOVO: diálogo interativo com perguntas individuais (não um formulário massivo): ex: 'Qual tema principal?', 'Qual idioma alvo?', 'Você quer personagens recorrentes?', 'Quantos uploads por semana?'",

      "Gerar plano de 27 dias com metas diárias, recursos necessários e KPIs"

    ],

    "niche_discovery": [

      "User inputs keyword + idioma + país",

      "Search via search.list -> dedupe channelIds -> channels.list (batch 50)",

      "Compute metrics: growth_rate, outliers, engagement, vph",

      "Return Channels tab (default) + Videos tab + Outliers"

    ],

    "content_pipeline": [

      "Idea -> LLM few-shot (Gemini/ChatGPT) -> long-form draft",

      "Split script into scenes and microhooks (timestamps)",

      "Generate TTS audio with word/phrase timestamps",

      "For each scene: generate visual (vendor) or fallback image+motion",

      "Sync audio timestamps to visuals -> assemble via FFmpeg worker",

      "Produce export artifacts (mp4, srt, edl, capcut_markers.json) and signed-URL zip for download"

    ],

    "monetization_plan": [

      "Estimate RPM by country (use SocialBlade/VidIQ data or internal estimator)",

      "Simulate views projection (conservative/expected/aggressive) using viral_score multipliers",

      "Output: expectativa de receita em 27 dias + tarefas diárias para o criador"

    ]

  },

  "data_model_minimal": {

    "users": ["id","email","role","billing","settings","created_at"],

    "channels": ["id","user_id","youtube_channel_id","title","language","created_at","settings"],

    "channel_snapshots": ["channel_id","date","subs","views","videos_count"],

    "videos": ["id","channel_id","youtube_video_id","title","duration","status","created_at"],

    "scenes": ["id","video_id","index","start","end","narration","visual_prompt","asset_url"],

    "assets": ["id","type","url","meta","size","created_at"],

    "ideas": ["id","channel_id","prompt","score","created_at"],

    "jobs": ["id","type","status","estimated_cost","started_at","finished_at"]

  },

  "api_endpoints_examples": [

    {"path":"/api/v1/onboard/channel","method":"POST","desc":"recebe novo canal, inicia análise (OAuth or ID)"},

    {"path":"/api/v1/niche/search","method":"POST","desc":"retorna channels/videos/outliers com scoring"},

    {"path":"/api/v1/generate/script","method":"POST","desc":"gera roteiro long-form + scenes"},

    {"path":"/api/v1/generate/tts","method":"POST","desc":"gera áudio e timestamps com provider escolhido"},

    {"path":"/api/v1/visual/generate","method":"POST","desc":"gera cena (vendor) ou fallback"},

    {"path":"/api/v1/video/assemble","method":"POST","desc":"job: sincroniza e monta video final (ffmpeg worker)"},

    {"path":"/api/v1/estimate/revenue","method":"POST","desc":"retorna projeção 27 dias"}

  ],

  "algorithm_viral_score": {

    "metrics_required": ["V7","V30","growth_rate","outlier_count","engagement","upload_freq","subs","age_days"],

    "score_formula_doc": "score = 0.30*norm(growth_rate) + 0.25*norm(outlier_count) + 0.15*norm(engagement) + 0.15*norm(views_per_sub) + 0.10*norm(upload_freq) - 0.15*norm(age_days) - 0.10*norm(subs)",

    "badges_rules": {

      "New": "age_days <= 180",

      "Small": "subs <= 50000",

      "FastGrowth": "growth_rate > 0.5 AND outlier_count>=1",

      "Outlier": "video_views >= 5 * channel_avg"

    }

  },

  "multilanguage_support": {

    "ui": "i18n keys, language selector; default: detect browser then ask user preference",

    "content_generation": "LLM prompt templates por idioma; assets naming/export metadata por idioma",

    "tts_localization": "map provider voices por idioma (ex: PT-BR, EN-US, PL-PL, DE-DE)",

    "search_behavior": "quando idioma definido, priorizar vídeos/canais do idioma/região"

  },

  "ux_onboarding_questions_template": {

    "if_new_channel": [

      "Qual o tema principal do canal?",

      "Qual idioma e país alvo?",

      "Qual estilo de vídeo prefere? (narrative / documentary / listicle / shorts)",

      "Quantos vídeos por semana pretende publicar?",

      "Você tem voz própria para narração ou prefere TTS?"

    ],

    "if_existing_channel": [

      "Deseja conectar via YouTube OAuth para análise completa?",

      "Qual seu objetivo em 27 dias (monetizar/alcance/assinantes)?",

      "Quais formatos já testou? (long/short/listicle/narrativa)",

      "Quais recursos quer priorizar (thumbnails, roteiro, SEO, edição)?"

    ]

  },

  "integrations_recommendation_and_keys": {

    "priority_list": [

      "YouTube Data API v3 (Google Cloud) - search, videos, channels, analytics",

      "Google TTS (Cloud) and/or ElevenLabs - TTS with timestamps",

      "Vendor video generation (Veo3/Grok) or Stable Diffusion + motion fallback",

      "Pinecone or Supabase embeddings",

      "SerpAPI or Google Trends provider",

      "VidIQ / SocialBlade (enrichment) via paid integrations",

      "RapidAPI marketplace for niche endpoints",

      "Apify for controlled scraping fallback (legal review)"

    ],

    "note": "Solicitar que Lovable gere instruções passo-a-passo para obter cada chave e onde salvá-las em secrets (no ambiente Lovable)."

  },

  "cost_and_quota_controls": {

    "job_estimation": "Antes de executar job pesado, calcular tokens LLM, minutos de vídeo vendor, custo TTS, armazenamento e mostrar estimativa USD ao usuário com opção de confirmar.",

    "budget_block": "Bloquear job se ultrapassar orçamento mensal do usuário",

    "tiering": "presets: economico / balanceado / premium"

  },

  "requirements_for_lovable_task": {

    "actions": [

      "1) Analise todo o projeto atual no workspace e produza relatório (reaproveitar/refatorar/excluir).",

      "2) Implementar correções de agregação por channelId (channels.list), filtros de subs e idade e badges.",

      "3) Implementar onboarding conversacional para novo/antigo canal com prompts individuais.",

      "4) Construa pipeline de geração (script->tts->visual->sync->export) com jobs containerizados (Docker) e templates ffmpeg.",

      "5) Adicione módulos de estimativa de monetização 27 dias (RPM por país + simulação views).",

      "6) Entregáveis: schema.sql, workers docker templates, endpoints example, UI pages (Channels, Videos, Niche Discovery, Create Video, Planner 27 dias), README com passo-a-passo das chaves."

    ],

    "deliverables_expected": [

      "Relatório de análise do workspace",

      "Branch de desenvolvimento com commits claros",

      "DB schema e policies (Supabase)",

      "Edge function patches e tests unitários",

      "E2E test script para pipeline completo (gerar 1 short via fallback)"

    ]

  },

  "qa_and_test_plan": [

    "Test: criar canal NEW -> gerar plano 27 dias -> validar tarefas diárias",

    "Test: criar canal EXISTING via OAuth -> validar que subs e idade filtram resultados",

    "Test: buscar nicho em PL/DE/EN/PT e validar idioma local",

    "Test: gerar roteiro 20-30min + TTS timestamps + sync -> baixar ZIP com mp4+srt+edl",

    "Test: cost estimation blocks job when over budget"

  ],

  "security_and_compliance": {

    "notes": [

      "Não expor API keys no frontend. Salvar em secrets.",

      "Rever política de scraping para conformidade legal (YouTube TOS).",

      "GDPR/Lei Geral de Proteção: permitir exclusão completa de dados do usuário."

    ]

  },

  "next_steps_and_execution": {

    "immediate": [

      "1) Lovable deve analisar e reportar artefatos existentes.",

      "2) Confirmar quais integrações já configuradas (YouTube key ok, TTS ok, vendors ok).",

      "3) Implementar patches prioritários: agregação por channelId, filtros, onboarding conversacional."

    ],

    "ask_user": "Se concordar, execute as alterações no ambiente de staging do Lovable e me envie o relatório com lista de arquivos alterados e scripts de teste automatizados."

  }

}