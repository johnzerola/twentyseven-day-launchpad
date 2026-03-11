

# Plano de Reestruturação Completa — Fase 1 (Prioridade Máxima)

O pedido cobre ~15 áreas diferentes. Para evitar quebrar tudo de uma vez, vou dividir em 3 fases. Esta é a **Fase 1** — as mudanças mais críticas e impactantes.

---

## Escopo da Fase 1

### A. Remover Módulos Descontinuados
Marcar como deprecated e remover do sidebar/router:
- **Studio** (`/studio`)
- **Narração IA** (`/narration`)
- **Planner** (`/planner`)
- **Playbook 27D** (`/playbook`)

Manter os arquivos mas remover as rotas e links do nav. Isso limpa o app imediatamente.

### B. Meus Canais — Visão Geral + Concorrentes com IA
**Problema atual**: Concorrentes usa apenas keywords dos títulos via YouTube API. Muito superficial.

**Melhoria**:
1. **Visão Geral** — Redesenhar com cards mais visuais: gráfico de top 5 vídeos por views, mini-timeline dos vídeos recentes, badges de saúde do canal (SEO, Títulos, Monetização) como meter visual
2. **Concorrentes com IA** — Criar nova edge function `find-competitors-ai` que:
   - Pega os top vídeos do canal do usuário
   - Usa IA (Gemini Flash) para extrair keywords, estilo e nicho profundo
   - Busca no YouTube com queries geradas pela IA (não apenas keywords, mas frases contextuais)
   - IA analisa cada canal encontrado: por que é concorrente, o que está fazendo melhor, gaps de conteúdo
   - Retorna análise comparativa real

### C. DubSpy — Filtros Reais + IA nas Buscas
**Problema**: Filtros podem não estar filtrando de verdade; resultados genéricos.

**Melhoria**:
1. Verificar e corrigir `search-videos` edge function para garantir que filtros (minViews, minSubs, maxSubs, period) são aplicados corretamente na YouTube API
2. Remover aba **Thumbnail Lab** do Growth Center para economizar créditos
3. Adicionar botão "Análise IA" em cada vídeo que faz um mini deep-scan usando a IA com contexto dos bancos de dados

### D. Títulos Virais — Banco de Dados de Referência (50K+)
**Nova feature**: Criar tabela `viral_titles_db` que armazena títulos de vídeos com 350k+ views.

**Implementação**:
1. Nova tabela: `viral_titles_db` (title, channel, views, niche, why_viral, seo_analysis, created_at)
2. Nova edge function `build-viral-titles-db` que:
   - Usa YouTube API para buscar vídeos por nicho com 350k+ views
   - Filtra shorts (duração > 60s)
   - IA analisa por que cada título funcionou
   - Salva no banco
3. Modificar `generate-titles` para consultar este banco antes de gerar, usando títulos reais como referência
4. Executar uma seed inicial com ~500 títulos (crescer organicamente via auto-scan)

### E. Workflow — Reestruturação como Project Manager
**Problema**: Workflow atual é um simples checklist de 5 etapas. Inútil para quem tem 40 canais.

**Melhoria**: Transformar em um **Project Workspace** por canal/projeto:
1. Cada projeto tem etapas: Nicho → Roteiro → Títulos → Cenas → Publicação
2. Projetos ficam linkados a um canal (se existir)
3. Canais salvos, roteiros salvos, análises de nicho ficam associados ao projeto
4. Dashboard de projetos com status visual (Kanban-like usando `planner_cards`)
5. Dados transitam entre etapas: nicho escolhido → auto-preenche roteiro → auto-preenche títulos

### F. Roteiros — IA de Análise de Inteligência Reforçada
**Problema**: analyze-topic é superficial, não estuda vídeos concorrentes profundamente.

**Melhoria** na edge function `analyze-topic`:
1. Buscar no YouTube vídeos do mesmo tópico + nicho + estilo
2. IA analisa os top 5 vídeos: estrutura do título, duração, thumbnail patterns
3. IA identifica gaps de conteúdo (o que ninguém está cobrindo)
4. IA gera briefing detalhado com: "melhores hooks dos concorrentes", "elementos visuais mais usados", "duração ideal baseada nos dados"
5. Esse briefing alimenta o `generate-script` E o `generate-synced-prompts`

### G. Geração de Cenas — Dual-AI + Formato AutoFlow
**Problema**: Cenas geradas são genéricas, não estudam vídeos de referência.

**Melhoria**:
1. **IA 1 (Gemini Pro)**: Gera as cenas com base no roteiro, estilo, personagens e briefing de inteligência
2. **IA 2 (Gemini Flash)**: Revisa cada cena verificando:
   - Tempo correto vs transcrição do áudio?
   - Cena é visualmente magnética nos primeiros 3s?
   - O Veo3 consegue gerar isso? (sem texto, sem dedos complexos)
   - Personagem consistente com o prompt de referência?
3. Output final em JSON AutoFlow com: scene index, prompt visual completo, quality specs, duration, camera, VFX notes, character refs

### H. Sugestão de Temas — Contextualizada
**Problema**: `suggest-themes` não usa tópico/estilo/nicho do usuário de forma profunda.

**Melhoria**: Passar o tópico, estilo narrativo e nicho para a edge function e instruir a IA a gerar temas que complementam ou expandem o tópico específico, não apenas temas genéricos do nicho.

---

## Arquivos Editados (Fase 1)

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Remover rotas deprecated |
| `src/components/dashboard/DashboardLayout.tsx` | Remover nav items deprecated |
| `src/pages/Channels.tsx` | Redesign overview + concorrentes IA |
| `src/pages/ChannelSearch.tsx` | Verificar filtros, mini análise IA |
| `src/pages/Branding.tsx` | Remover Thumbnail Lab |
| `src/pages/Workflow.tsx` | Reescrever como Project Workspace |
| `src/pages/Titles.tsx` | Conectar ao banco viral_titles_db |
| `src/pages/Scripts.tsx` | Melhorar sugestão temas contextual |
| `supabase/functions/find-competitors-ai/index.ts` | Nova function com IA |
| `supabase/functions/analyze-topic/index.ts` | Análise profunda de concorrentes |
| `supabase/functions/generate-synced-prompts/index.ts` | Dual-AI review |
| `supabase/functions/suggest-themes/index.ts` | Contextualizar com tópico |
| `supabase/functions/build-viral-titles-db/index.ts` | Nova function |
| `supabase/functions/generate-titles/index.ts` | Consultar banco real |
| Migration | Criar `viral_titles_db` table |

---

## O Que Fica Para Fase 2
- Niche Explorer com IA profunda
- Monetização melhorada
- Banco de estilos de roteiro expandido
- Auto-scan semanal para `viral_titles_db`
- Integração total entre módulos via workflow

