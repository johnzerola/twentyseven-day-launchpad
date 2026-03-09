

# Monetiza27 — Overhaul Completo (6 Telas Premium com Mock Data)

## Resumo

Reescrever as telas principais com dados simulados realistas, criar as telas novas (Dotti Sync Studio, Dotti Planner Kanban), e adicionar o chatbot flutuante. As edge functions existentes continuam funcionando — o mock data serve como fallback visual e para demonstração.

## Database Changes

Novas tabelas necessárias:

```sql
-- Projetos de vídeo
CREATE TABLE public.video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  script text DEFAULT '',
  status text DEFAULT 'draft',
  niche text,
  duration_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Segmentos de 8 segundos (coração da plataforma)
CREATE TABLE public.video_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.video_projects(id) ON DELETE CASCADE NOT NULL,
  segment_index integer NOT NULL,
  text_content text DEFAULT '',
  visual_prompt text DEFAULT '',
  reference_image_url text,
  status text DEFAULT 'pending',
  audio_url text,
  video_clip_url text,
  duration_ms integer DEFAULT 8000,
  created_at timestamptz DEFAULT now()
);
```

RLS policies para ambas com `auth.uid() = user_id` (video_projects) e join via project (video_segments).

## Telas a Construir/Reescrever

### 1. Dashboard Principal (Rewrite `/dashboard`)
- Card de progresso visual: "Dia 5 de 27 — Fase de Roteirização" com barra circular
- Checklist interativo com tarefas do dia atual (mock: 4 tarefas)
- Widget "Estimativa de Ganhos" com RPM/CPM por nicho (tabela mock: Finanças $15, Histórias $12, Gaming $4, Tech $8)
- **Chatbot flutuante** no canto inferior direito (balão expansível, usa Lovable AI `openai/gpt-5-mini` via edge function para responder sobre retenção e algoritmo YouTube)

### 2. TubeSpy & Radar de Outliers (Rewrite `/search`)
- Barra de busca chamativa: "Cole o link de um canal ou vídeo concorrente"
- Badge "Monetização: ATIVADA/DESATIVADA" no topo do canal (mock + TODO comment para web scraping)
- Data Table shadcn com colunas: Thumbnail, Título, VPH, Views Totais, Data Publicação, Outlier Score
- Badge/Tag "Outlier 10x" para vídeos com score alto
- Mock data: 15 vídeos realistas com métricas variadas

### 3. HacksLab — Identidade & Emulação (Rewrite `/branding`)
- Formulário de passo único: nicho input
- 3 cards de "Identidade Visual Gerada por IA" com: Nome do Canal, Paleta de Cores, Prompts para Midjourney/Canva (logo + banner)
- Seção "Keywords SEO" com tags de alta conversão
- Mock data: 3 identidades completas por nicho

### 4. Dotti Sync & Studio (Nova tela `/studio`)
- **Área 1:** Editor de texto (Textarea) para roteiro completo
- **Área 2:** Dropdown de vozes ElevenLabs + botão "Gerar Áudio e Sincronizar" (TODO: integração real)
- **Área 3: Timeline de Sincronia** — O diferencial:
  - Fatiamento automático do roteiro em blocos de 8 segundos
  - Cada card mostra: trecho de texto, input "Prompt Visual da Cena", botão upload "Imagem de Referência", badge de Status (Pendente/Gerando/Falhou/Sucesso)
  - Layout horizontal scrollável ou vertical com cards
  - Mock: 12 segmentos de exemplo com status variados

### 5. Dotti Sender & Grab (Integrado no `/studio`)
- Botões master no topo: "Disparar Prompts em Lote" + "Baixar Todos os Clipes"
- Log de terminal falso: "Renderizando cena 4 de 50 no Veo 3..."
- Barra de progresso animada com contagem de cenas

### 6. Dotti Planner — Kanban (Nova tela `/planner`)
- Colunas: Ideias | Escrevendo Roteiro | Gerando Mídia | Editando | Agendado no YouTube
- Cards draggáveis (drag-and-drop com estado local)
- Mock: 8 cards distribuídos nas colunas
- Cada card: título, thumbnail placeholder, badge de prioridade, data estimada

## Sidebar Atualizada

```
Dashboard (Blueprint 27 Dias)
TubeSpy (Outliers)
HacksLab (Branding)
Dotti Studio (Criar Vídeo)
Dotti Planner (Kanban)
Niche Explorer
Roteiros
Narração
Meus Canais
Plano 27 Dias
```

## Chatbot Flutuante (Componente global)

- Botão circular no canto inferior direito com ícone Bot
- Expande para chat com histórico local
- Chama edge function `chat-assistant` que usa Lovable AI (`openai/gpt-5-mini`)
- System prompt: "Você é um especialista em YouTube com 10+ anos de experiência no algoritmo. Responda sobre retenção, CTR, SEO, monetização."
- Visível em todas as telas do dashboard

## Edge Functions Novas

| Function | Descrição |
|----------|-----------|
| `chat-assistant` | Chatbot de dúvidas YouTube via Lovable AI |

## Arquivos a Criar

- `src/pages/Studio.tsx` — Dotti Sync & Studio + Sender/Grab
- `src/pages/Planner.tsx` — Kanban board
- `src/components/dashboard/ChatbotWidget.tsx` — Chat flutuante
- `supabase/functions/chat-assistant/index.ts` — Edge function do chatbot

## Arquivos a Reescrever

- `src/pages/Dashboard.tsx` — Blueprint visual com checklist + estimativas
- `src/pages/ChannelSearch.tsx` — TubeSpy com Data Table
- `src/pages/Branding.tsx` — HacksLab com 3 cards de identidade
- `src/components/dashboard/DashboardLayout.tsx` — Nova sidebar
- `src/App.tsx` — Novas rotas `/studio`, `/planner`

## Prioridade de Implementação

1. Database migration (video_projects + video_segments)
2. Dashboard Blueprint com mock data + chatbot
3. TubeSpy com Data Table e mock data
4. HacksLab com 3 cards de identidade
5. Dotti Studio com Timeline de 8s (feature principal)
6. Dotti Planner Kanban
7. Edge function chat-assistant
8. Sidebar e rotas atualizadas

