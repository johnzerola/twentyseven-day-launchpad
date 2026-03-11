

# Auditoria Completa do Sistema — Diálogo das 3 Personas

---

## PERSONA 1: Rafael (Ex-CEO YouTube, 15k+ canais monetizados)

"Vou direto ao ponto. Analisei cada tela, cada função, cada tabela."

### Estado Atual — O que está EXCELENTE:

- **29 Edge Functions** em produção — cobertura completa do pipeline
- **Pipeline Dual-AI** (GPT-5 → Gemini Pro com scorecard) — superior a 99% das ferramentas no mercado
- **132 registros em scene_prompt_knowledge** — cobertura massiva: 9 hooks visuais, 12 transições, 5 anti-AI, nichos especializados (underwater, mythology, war documentary, reddit, conspiracy)
- **72 registros em script_knowledge** — 26 templates, 19 técnicas, 10 hooks, 10 estruturas
- **653 canais em channel_intelligence** — base viral robusta
- **46 registros em youtube_knowledge** — cobertura de algoritmo, retenção, monetização, SEO
- **13 telas completas** no sidebar: Dashboard, DubSpy, Growth Center, Niche Explorer, Roteiros, Títulos, Viral Database, Workflow, Monetização, Studio, Narração, Playbook, Meus Canais
- **Persistência implementada** em: NicheExplorer, Titles, MonetizationPlanner, Characters, DubSpy, Playbook, Workflow ✅

### Problemas Críticos que Identifiquei:

| # | Problema | Impacto | Onde |
|---|---------|---------|------|
| 1 | **Studio desconectado do Scripts** — não carrega projetos existentes | CRÍTICO | Studio.tsx usa useState puro, não puxa video_projects |
| 2 | **Narração não persiste áudios** — base64 no state, perde ao sair | ALTO | Narration.tsx, sem storage bucket |
| 3 | **0 scenes, 0 prompts, 0 video_segments** no banco | ALTO | Tabelas criadas mas nunca populadas pelo fluxo |
| 4 | **Tabelas duplicadas**: `scenes` e `video_segments` fazem a mesma coisa | MÉDIO | Confusão de schema |
| 5 | **Script → Studio pipeline quebrado**: sem botão "Abrir no Studio" | ALTO | Scripts.tsx não navega para Studio com project_id |
| 6 | **Nenhum storage bucket criado** | ALTO | Áudios, imagens geradas = volatilidade total |
| 7 | **Dashboard sem ROI/métricas de progresso reais** | MÉDIO | Apenas contadores básicos |

---

## PERSONA 2: André (Engenheiro Senior, ex-Google)

"A arquitetura é sólida para MVP, mas precisa de consolidação para V3."

### Diagnóstico do Banco de Dados:

```text
┌─────────────────────────┬──────────┬──────────────────────────────────────┐
│ Tabela                  │ Registros│ Status                               │
├─────────────────────────┼──────────┼──────────────────────────────────────┤
│ scene_prompt_knowledge  │ 132      │ ✅ Excelente (50 categorias)         │
│ script_knowledge        │ 72       │ ✅ Sólido (26 templates, 19 técnicas)│
│ youtube_knowledge       │ 46       │ ✅ Bom                               │
│ channel_intelligence    │ 653      │ ✅ Robusto                           │
│ niche_database          │ 32       │ ✅ Populado                          │
│ video_projects          │ 1        │ ⚠️ Mínimo (pipeline pouco usado)     │
│ characters              │ 6        │ ⚠️ Funcional                        │
│ scenes                  │ 0        │ ❌ Nunca populada                    │
│ video_segments          │ 0        │ ❌ Nunca populada                    │
│ prompts                 │ 0        │ ❌ Nunca populada                    │
│ saved_searches          │ 0        │ ⚠️ Recém-criada, sem uso ainda       │
└─────────────────────────┴──────────┴──────────────────────────────────────┘
```

### Problemas de Arquitetura:

1. **`scenes` vs `video_segments` — DUPLICAÇÃO**: Ambas têm project_id, sequence/index, prompt visual, audio_url, status. Devem ser **unificadas em `scenes`** (mais completa: tem camera_movement, lighting, emotional_intent, character_ref).

2. **Studio não persiste nada ao DB**: O Studio trabalha 100% em memória (useState). Segmentos gerados, prompts, áudios, vídeos — tudo se perde ao recarregar. Deveria salvar em `scenes` a cada operação.

3. **Sem storage bucket**: Áudios TTS são base64 no state. Imagens geradas ficam em URLs temporárias. Vídeos Veo3 ficam em operationName temporário. Precisa de bucket `media` para áudios + imagens + vídeos.

4. **Scripts → Studio desconectado**: Scripts.tsx cria `video_projects` e `characters`, mas não há botão "Abrir no Studio". Studio.tsx não aceita `project_id` na URL para carregar projeto existente.

5. **RLS correto em 100% das tabelas** ✅ — sem vulnerabilidades.

6. **Edge Functions robustas**: 29 funções, todas com CORS, error handling, rate limiting ✅.

### O que falta para V3 — Infra:

- **Storage bucket `media`** com pastas: `audio/`, `images/`, `videos/`
- **Unificar `scenes` + `video_segments`** → manter apenas `scenes`, dropar `video_segments`
- **Studio persistir em `scenes`** — auto-save a cada operação
- **Botão "Abrir no Studio"** no Scripts que passa project_id na URL
- **Studio ler project_id da URL** e carregar video_project + characters + scenes

---

## PERSONA 3: Carlos (Roteirista Senior, MrBeast/Dark/Docs/Animação)

"O motor de prompts Veo3 está 9.5/10. Mas vou deixar 10/10."

### Avaliação do Prompt Engine:

**generate-synced-prompts** (9.5/10):
- ✅ Fórmula Netflix de 5 partes perfeita
- ✅ Anti-text enforcement rigoroso (anti-text block + negativePrompt)
- ✅ 10 estilos visuais (cinematográfico, 2D, 3D, anime, wojak, etc.)
- ✅ Character sheets com referência de imagem verbatim
- ✅ Dynamic scene duration (5-8s)
- ✅ Knowledge base de 132 registros integrada (top 20 por viral_score)
- ✅ Negative prompt agressivo contra artefatos
- ✅ Políticas Veo3 documentadas (3 registros de policy)
- ✅ Técnicas de consistência (4 registros de consistency)
- ✅ Fórmulas por gênero (dark, epic, animation, documentary)

**O que falta para 10/10:**

1. **Knowledge base subutilizada**: Busca apenas top 20 por viral_score. Com 132 registros e 50 categorias, deveria filtrar por **nicho/estilo do vídeo** para prompts mais relevantes.

2. **Falta script knowledge no pipeline de synced-prompts**: O `generate-synced-prompts` consome `scene_prompt_knowledge` mas NÃO consome `script_knowledge`. As 72 técnicas de retenção (cold open, last 10 seconds, dual timeline) não influenciam os prompts visuais.

3. **Roteiros multi-parte**: Sem suporte a "Parte 1, 2, 3" — séries que geram subscriber retention.

4. **Falta integração Viral DB → Prompts**: Os 653 canais em channel_intelligence têm `visual_style_notes` e `viral_patterns`, mas o gerador de prompts não consulta isso para adaptar o estilo visual.

---

## Plano de Implementação V3 (Consenso das 3 Personas)

### Fase 1: Consolidação do Banco de Dados
1. **Unificar `scenes` + `video_segments`** — migrar dados de video_segments para scenes, adicionar campos faltantes (segment_index, video_clip_url), dropar video_segments
2. **Criar storage bucket `media`** com pastas audio/, images/, videos/
3. **Studio persistir em `scenes`** — auto-save segmentos, prompts, áudios, vídeos no banco

### Fase 2: Integração Scripts ↔ Studio
4. **Botão "Abrir no Studio"** no Scripts → navega com `?project=UUID`
5. **Studio carregar projeto existente** — ler project_id da URL, carregar video_project + characters + scenes
6. **Narração salvar áudios no storage bucket** em vez de base64

### Fase 3: Inteligência dos Prompts
7. **Filtrar scene_prompt_knowledge por nicho/estilo** no generate-synced-prompts (em vez de top 20 genérico)
8. **Integrar script_knowledge** no pipeline de prompts visuais (técnicas de retenção → prompts mais magnéticos)
9. **Consultar viral_patterns de channel_intelligence** para adaptar estilo visual ao que funciona no nicho

### Fase 4: Features V3
10. **Dashboard com ROI estimado** — agregar dados de niche_database + projetos para projeção
11. **Suporte a roteiros multi-parte** (Parte 1/2/3) com continuidade de personagens
12. **Shorts Extractor** — extrair 3-5 shorts de cada long-form automaticamente

