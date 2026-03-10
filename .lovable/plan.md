# Viral Database V2 — Channel Intelligence Brain

## Problema Atual

A Viral Database é apenas uma lista estática de hooks, CTAs e títulos genéricos no código (`viralDatabase.ts`). Sem dados reais de canais, sem análise de estilos visuais, sem conexão com o Script Engine. Não serve como "cérebro" do sistema.

## Visão: Database de Inteligência de Canais Dark/Faceless

Transformar a Viral Database num sistema de inteligência que analisa canais reais do YouTube, extrai padrões de sucesso (hooks, thumbnails, estilos visuais, estruturas, titulos, tendencias, canais virais, canal que estourou a bolha monetizou rapido), e alimenta o Script Engine automaticamente, uma vez por semana faz esta pesquisa se auto alimentar.

## Arquitetura

### 1. Nova Tabela: `channel_intelligence`

Armazena dados de canais analisados pela IA — os "20K+ canais" como referência:

```
channel_intelligence:
  id, channel_name, youtube_channel_id, 
  niche (text), sub_niche (text),
  style (enum: pov, stickmen, wojak, cinematic, documentary, horror, whiteboard, animation, mrbeast, voce_sabia, fatos),
  country (text), language (text),
  subscribers (bigint), avg_views (bigint), 
  growth_rate (text: explosive, fast, steady),
  is_faceless (boolean),
  is_monetized (boolean),
  viral_patterns (jsonb: {hooks, transitions, pacing, thumbnail_style}),
  top_videos (jsonb: [{title, views, thumbnail_url, hook_text, duration}]),
  visual_style_notes (text: description of how videos look),
  upload_frequency (text),
  rpm_estimate (numeric),
  analyzed_at (timestamp)
```

### 2. Edge Function: `analyze-viral-channels`

- Recebe nicho + estilo como input
- Usa YouTube Data API para buscar canais por keywords (ex: "POV stories", "dark facts", "voce sabia", "**Stickmen/Wojak**")
- Para cada canal encontrado: busca top 5 vídeos, extrai thumbnails, analisa padrões, analisa cenas mais importantes do video
- Usa Gemini Pro para analisar: estilo visual, padrões de hook, pacing, thumbnail strategy, titulo, estilo de cenas do video
- Salva tudo em `channel_intelligence`
- Pode também receber channel URL direto para análise individual

### 3. Seed Inicial: 20000+ Canais Pré-analisados

SQL insert com dados curados de canais reais organizados por estilo:

- **POV/Storytelling**: canais tipo Reddit stories, POV dramatizações
- **Stickmen/Wojak/ ou algum personagem**: canais de animação simples viral
- **Voce Sabia/Fatos**: canais educativos faceless BR/US/espanhol
- **Dark/Horror**: mystery, true crime, creepypasta, faceless
- **Cinematográfico**: documentários faceless premium
- **MrBeast-style**: alta energia, desafios (referência procurar mais canal referencial)
- **Motivacional**: canais dark motivacionale faceless
- **Finance/Crypto**: canais faceless de finanças

Cada registro inclui: padrões virais extraídos, estilo visual, hooks mais usados, frequência de upload, e notas sobre como gravam/editam.

### 4. Frontend Redesenhado: `ViralDatabase.tsx`

Nova interface com 3 macro-seções:

**Tab 1: Channel Intelligence (NOVO)**

- Grid de canais com filtros: estilo, nicho, país, faceless, growth rate
- Card de canal: nome, subs, avg views, growth badge, estilo visual, top vídeos
- Click → expande com padrões virais detalhados, hooks extraídos, visual style notes
- Botão "Analisar Canal" para adicionar novos via URL
- Botão "Usar Padrões no Roteiro" → injeta no Script Engine

**Tab 2: Patterns Library (hooks/CTAs/titles reformulado)**

- Mesmo conteúdo atual mas agora ENRIQUECIDO com dados reais dos canais analisados com mais de 20 mil canais
- "Este hook é usado por 47 canais com média de 2M views"
- Filtros: por estilo visual (pov, wojak, canal dark sem mostra o rosto, etc), por nicho

**Tab 3: Visual Style Guide (NOVO)**

- Galeria de estilos visuais com exemplos de thumbnail
- Para cada estilo (POV, Wojak, Stickmen, etc): descrição detalhada de como produzir provutar mais nichos 
- Prompts prontos para gerar no estilo
- Referência de canais que usam aquele estilo ou canal que viralizaram sem precisar msotra o rosto usando IA

### 5. Integração com Script Engine

- `generate-script` passa a consultar `channel_intelligence` além de `youtube_knowledge`
- Quando o usuário seleciona um estilo visual, a IA recebe exemplos de canais de sucesso naquele estilo
- Os hooks e estruturas mais eficazes para aquele estilo são priorizados

## Arquivos


| Arquivo                                              | Ação                                        |
| ---------------------------------------------------- | ------------------------------------------- |
| Migration SQL                                        | Criar tabela `channel_intelligence`         |
| SQL Insert                                           | Seed 200+ canais pré-analisados             |
| `supabase/functions/analyze-viral-channels/index.ts` | Nova edge function                          |
| `src/pages/ViralDatabase.tsx`                        | Reescrever completamente                    |
| `src/lib/viralDatabase.ts`                           | Manter tipos, remover dados hardcoded       |
| `supabase/functions/generate-script/index.ts`        | Adicionar consulta a `channel_intelligence` |


## Execução

1. Criar tabela + seed de 20000 + canais
2. Reescrever ViralDatabase.tsx com as 3 tabs
3. Criar edge function analyze-viral-channels
4. Integrar channel_intelligence no generate-script