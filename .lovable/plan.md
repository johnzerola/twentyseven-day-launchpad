

# Pipeline Inteligente: Análise → Roteiro → Cenas

## Visão Geral

Hoje o pipeline é linear: o usuário digita um tópico e o sistema gera o roteiro diretamente. O novo fluxo adiciona uma **Fase 0 de Inteligência** que analisa o banco de dados antes de gerar qualquer coisa, e uma **passagem de contexto** que conecta roteiro → narração → cenas em uma cadeia contínua.

```text
FLUXO ATUAL:
  Tópico → [generate-script] → Roteiro → [generate-synced-prompts] → Cenas

FLUXO NOVO:
  Tópico → [FASE 0: analyze-topic] → Briefing de Inteligência
         → [FASE 1: GPT-5 + Briefing] → Roteiro Draft
         → [FASE 2: Gemini Review] → Roteiro Final + scene_blueprint (JSON)
         → Narração (TTS)
         → [generate-synced-prompts + scene_blueprint + narração] → Cenas Completas
```

## Mudanças Técnicas

### 1. Nova Edge Function: `analyze-topic`
Recebe `{ topic, niche, style, language }` e retorna um **briefing de inteligência** em JSON:
- Busca `channel_intelligence` filtrando por nicho/estilo, extrai `viral_patterns`, `top_videos`, `visual_style_notes` dos 10 canais mais relevantes
- Busca `scene_prompt_knowledge` filtrando por nicho/estilo (mesma lógica já existente no `generate-synced-prompts`)
- Busca `script_knowledge` filtrando por categoria relevante
- Usa Gemini Flash para analisar os padrões e gerar um briefing estruturado:
  - `competitive_analysis`: o que funciona nesse nicho (hooks, duração, estilo visual)
  - `recommended_hooks`: 3 hooks baseados nos padrões virais reais
  - `visual_blueprint`: sugestões de estilo visual, câmera e iluminação para as cenas
  - `retention_techniques`: técnicas específicas recomendadas
  - `what_to_avoid`: o que NÃO fazer baseado em padrões de baixo desempenho

### 2. Atualizar `generate-script` 
- Recebe o campo opcional `intelligenceBriefing` (o JSON da Fase 0)
- Injeta o briefing no system prompt da Fase 1 (GPT-5) como contexto obrigatório
- Na Fase 2 (Gemini), pede que o roteiro inclua **anotações de cena inline** (`---SCENE_BLUEPRINT---` no final):
  - Para cada bloco narrativo: `mood`, `visual_hint`, `camera_suggestion`, `characters_present`
  - Este blueprint será passado ao gerador de prompts visuais

### 3. Atualizar `generate-synced-prompts`
- Recebe campo opcional `sceneBlueprintFromScript` (JSON do blueprint gerado pelo roteiro)
- Usa o blueprint para gerar prompts alinhados com a intenção narrativa de cada cena
- Combina com os dados de `channel_intelligence.visual_style_notes` do nicho

### 4. Atualizar `Scripts.tsx` (Frontend)
- Ao clicar "Gerar Roteiro":
  1. Chama `analyze-topic` → mostra mini-painel com o briefing (canais analisados, hooks sugeridos)
  2. Chama `generate-script` passando o briefing
  3. Parseia o `---SCENE_BLUEPRINT---` do roteiro e armazena em state
- Ao gerar prompts visuais: passa o blueprint como parâmetro ao `generate-synced-prompts`
- Novo componente: painel colapsável "📊 Análise de Inteligência" mostrando os canais referência, padrões encontrados e recomendações

### 5. Persistência do Briefing
- Salva o `intelligence_briefing` e `scene_blueprint` no `video_projects` (campos JSONB já comportam isso via o campo existente ou adicionando coluna)
- Adicionar colunas `intelligence_json` e `scene_blueprint_json` ao `video_projects`

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/analyze-topic/index.ts` | **Criar** — Fase 0 de inteligência |
| `supabase/functions/generate-script/index.ts` | **Editar** — receber briefing, gerar blueprint |
| `supabase/functions/generate-synced-prompts/index.ts` | **Editar** — receber blueprint |
| `src/pages/Scripts.tsx` | **Editar** — orquestrar 3 fases, mostrar painel de análise |
| `supabase/config.toml` | **Editar** — registrar `analyze-topic` |
| Migration SQL | **Criar** — adicionar colunas ao `video_projects` |

