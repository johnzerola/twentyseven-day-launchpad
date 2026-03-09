

# Monetiza27 — Sistema 100% Funcional

## Análise do Estado Atual

O sistema já tem uma base sólida com edge functions reais (YouTube API, ElevenLabs, Gemini AI). Os principais gaps são: Narração não funciona, Studio precisa de retry/download, Planner sem persistência, Niche Explorer precisa de base de 6000+ nichos, e falta gerador de títulos virais standalone.

Sobre **Veo3**: não existe API pública do Veo3. O disparo automático de prompts no Veo3 requer automação de browser (tipo Selenium/Puppeteer) que não é viável em uma web app. O que POSSO fazer: gerar prompts otimizados para Veo3 que o usuário copia e cola, gerar imagens via Gemini AI, e sincronizar áudio + prompts visuais automaticamente.

## Mudanças Planejadas

### 1. Narração (`/narration`) — Tornar funcional
Atualmente é um stub. Reescrever para usar a edge function `elevenlabs-tts` que já existe:
- Conectar ao ElevenLabs real com vozes corretas (IDs reais)
- Player de áudio inline com download
- Contador de caracteres e estimativa de custo

### 2. Studio — Retry + Download + Sync melhorado
- **Retry falhas**: Botão "Regenerar Falhados" que filtra segmentos com `status === 'failed'` e re-envia
- **Download em lote**: Criar ZIP com todas as imagens geradas (usando JSZip no browser)
- **Prompts otimizados para Veo3**: Adicionar toggle "Modo Veo3" que gera prompts com formato específico Veo3 (consistência de personagem, referência de imagem, duração)
- **Preview sincronizado**: Player que mostra imagem + toca áudio de cada segmento em sequência

### 3. Gerador de Títulos Virais (Nova tela `/titles`)
- Edge function `generate-titles` usando Gemini 2.5 Pro
- Input: nicho + tema
- Output: 20 títulos organizados por estilo (curiosidade, urgência, números, contraintuitivo)
- CTR estimado por título
- Botão "Copiar" em cada título

### 4. Niche Explorer — Base de 6000+ Nichos
- Edge function `niche-database` que usa AI para gerar nichos completos com RPM, faceless indicator, dificuldade
- Banco de nichos no Supabase (tabela `niche_database`) com campos: nome, RPM estimado, faceless_friendly, saturação, dificuldade, sub_nichos
- Migração com seed de 100+ nichos populares
- Filtros por RPM range, faceless only, dificuldade, idioma
- Análise de canais de sucesso por nicho (já funciona via YouTube API)

### 5. Planner — Persistência no Banco
- Criar tabela `planner_cards` com: user_id, column_id, title, priority, due_date, tags, position
- Drag-and-drop atualiza posição no banco em tempo real
- Criar/editar/deletar cards reais

### 6. Channel Spy — Insights IA
- Ao clicar em um canal rastreado, gerar relatório AI com:
  - Receita mensal estimada
  - Palavras-chave SEO mais usadas
  - Frequência de upload ideal
  - Tipo de thumbnail mais eficaz
- Usar edge function `analyze-channel` existente + `emulate-channel`

### 7. TubeSpy — Canais Similares
- Após espionar um canal, botão "Encontrar Canais Similares" que busca por keywords/nicho do canal
- Usa `niche-explorer` edge function com o nicho detectado

## Database Migrations

```sql
-- Tabela de nichos
CREATE TABLE public.niche_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rpm_estimate numeric DEFAULT 0,
  faceless_friendly boolean DEFAULT false,
  saturation text DEFAULT 'média',
  difficulty text DEFAULT 'médio',
  sub_niches jsonb DEFAULT '[]',
  country text DEFAULT 'BR',
  language text DEFAULT 'pt',
  created_at timestamptz DEFAULT now()
);

-- Planner cards
CREATE TABLE public.planner_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  column_id text NOT NULL DEFAULT 'ideas',
  title text NOT NULL,
  priority text DEFAULT 'média',
  due_date text,
  tags jsonb DEFAULT '[]',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.niche_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_cards ENABLE ROW LEVEL SECURITY;

-- Niche database: public read
CREATE POLICY "Anyone can read niches" ON public.niche_database FOR SELECT TO authenticated USING (true);

-- Planner: user-scoped CRUD
CREATE POLICY "Users can manage own cards" ON public.planner_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## Edge Functions Novas

| Function | Modelo | Descrição |
|---|---|---|
| `generate-titles` | gemini-2.5-flash | Títulos virais por nicho/tema |
| `generate-veo3-prompts` | gemini-2.5-flash | Prompts otimizados para Veo3 com consistência |

## Arquivos a Criar

- `src/pages/Titles.tsx` — Gerador de títulos virais
- `supabase/functions/generate-titles/index.ts`
- `supabase/functions/generate-veo3-prompts/index.ts`

## Arquivos a Reescrever

- `src/pages/Narration.tsx` — Conectar ElevenLabs real
- `src/pages/Studio.tsx` — Retry, download, Veo3, preview sync
- `src/pages/Planner.tsx` — Persistência DB
- `src/pages/NicheExplorer.tsx` — Base de nichos + filtros avançados
- `src/pages/ChannelSearch.tsx` — Canais similares + insights expandidos
- `src/components/dashboard/DashboardLayout.tsx` — Nova rota Títulos
- `src/App.tsx` — Rota `/titles`

## Prioridade

1. DB migration (niche_database + planner_cards)
2. Narração funcional (ElevenLabs real)
3. Studio: retry + download + Veo3 prompts + preview sync
4. Gerador de títulos virais
5. Planner com persistência
6. Niche Explorer expandido
7. TubeSpy: canais similares

