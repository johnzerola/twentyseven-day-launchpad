

# Monetiza27 — Correção dos 4 Problemas + Dotti Studio Completo

## Diagnóstico

### 1. Roteiros fracos e tamanho inconsistente
O prompt atual no `generate-script` edge function usa `google/gemini-3-flash-preview` que é rápido mas menos capaz para textos longos. O prompt pede palavras mínimas mas o modelo frequentemente encurta. Solução: trocar para `google/gemini-2.5-pro` (melhor para textos longos e complexos), adicionar técnicas de roteiro dopaminérgico no system prompt (open loops, pattern interrupts, curiosity gaps), e forçar contagem real com instrução mais agressiva.

### 2. Niche Explorer incompleto
Falta: filtros por RPM/faixa de subs, comparação lado a lado de nichos, sugestão de sub-nichos, estimativa de receita mensal projetada, e indicadores de saturação vs oportunidade. Adicionar esses elementos visuais e lógicos.

### 3. TubeSpy não funciona corretamente
O frontend faz fallback para mock data quando a edge function falha. O `search-videos` edge function parece correto mas o frontend não passa dados de canal corretamente quando o usuário cola um link de canal/vídeo. Precisa: detectar se é URL do YouTube (canal ou vídeo), extrair o ID, e fazer a chamada correta. Também precisa resolver handles (@username) via `resolve-channel`.

### 4. HacksLab não funciona corretamente
O `generate-branding` retorna dados da AI mas o frontend só usa `channelNames` e mantém paletas/prompts mock. Precisa usar todos os campos reais retornados (colorPalette, bannerConcepts, thumbnailStyle, seoTags, contentPillars).

### 5. Dotti Studio — fluxo completo desejado
O usuário quer: roteiro → áudio (ElevenLabs) → imagens/vídeos gerados → sincronização com áudio. Atualmente o Studio só fatia texto e simula batch. Precisa integrar ElevenLabs para TTS real e usar Lovable AI image generation para criar imagens dos segmentos.

## Mudanças Planejadas

### Edge Functions

**`generate-script/index.ts`** — Reescrever:
- Trocar modelo para `google/gemini-2.5-pro` (melhor para textos longos)
- Prompt dopaminérgico com técnicas: open loops, pattern interrupts, curiosity gaps, cliffhangers internos, regra dos 8 segundos
- Instrução explícita de contagem mínima de palavras reforçada
- Adicionar exemplos de estrutura no prompt (hook → tension → payoff)

**`search-videos/index.ts`** — Melhorar:
- Detectar URLs do YouTube (youtu.be, youtube.com/watch, youtube.com/channel, youtube.com/@handle)
- Se for URL de canal ou @handle: usar `resolve-channel` logic inline para obter channel ID, depois buscar videos do canal via `search` ou `playlistItems`
- Se for URL de vídeo: buscar dados do vídeo + canal + vídeos relacionados
- Se for texto simples: manter busca atual

**`generate-branding/index.ts`** — Melhorar:
- Garantir que retorna logo/banner prompts para Midjourney
- Adicionar campo `thumbnailStyle` com exemplos visuais
- Retornar sub-nichos relacionados

**Nova: `generate-segment-image/index.ts`**:
- Usa `google/gemini-3.1-flash-image-preview` (Nano Banana 2) para gerar imagem baseada no visual prompt do segmento
- Retorna base64 da imagem gerada
- Upload para storage bucket `segment-images`

### Frontend

**`Scripts.tsx`** — Melhorar UI:
- Adicionar contador visual em tempo real (palavras/caracteres/minutos estimados) com barra de progresso comparando ao target
- Adicionar opção "Dopaminérgico", "Cinematográfico", "MrBeast Style" nos estilos
- Preview do roteiro com seções colapsáveis (Hook, Desenvolvimento, Clímax, CTA)

**`ChannelSearch.tsx`** — Reescrever busca:
- Input inteligente que detecta se é URL ou texto
- Quando URL: mostrar card do canal no topo com stats completos + badge monetização
- Quando texto: buscar vídeos normalmente
- Remover fallback para mock data (mostrar erro real)
- Adicionar filtros funcionais: período, min views, min subs, max subs

**`NicheExplorer.tsx`** — Expandir:
- Adicionar cards de métricas: Saturação (alta/média/baixa), Dificuldade, Potencial de crescimento
- Filtros visuais por RPM range, tipo (faceless/camera), faixa de subs
- Seção "Sub-nichos recomendados" com chips clicáveis
- Gráfico de projeção de receita (Recharts) baseado em views estimadas

**`Branding.tsx`** — Usar dados reais da AI:
- Mapear `colorPalette`, `bannerConcepts`, `thumbnailStyle`, `contentPillars`, `seoTags` reais
- Cards com prompts reais gerados pela AI ao invés de mock
- Adicionar seção "Pilares de Conteúdo"

**`Studio.tsx`** — Fluxo completo:
- Integrar ElevenLabs TTS via nova edge function (requer connector)
- Botão "Gerar Imagem" em cada segmento usando `generate-segment-image`
- Preview da imagem gerada inline no card do segmento
- Sincronização visual: mostrar timeline com áudio + imagens lado a lado
- Status real ao invés de simulado

### Database

- Criar storage bucket `segment-images` para imagens geradas dos segmentos

### Dependências

- ElevenLabs connector precisa ser habilitado para TTS no Studio
- Sem ElevenLabs: usar Web Speech API como fallback gratuito no browser

## Prioridade de Implementação

1. Corrigir `generate-script` (prompt dopaminérgico + modelo melhor)
2. Corrigir `search-videos` (detecção de URL + resolver canal)
3. Corrigir `generate-branding` (usar dados reais da AI)
4. Expandir `NicheExplorer` (filtros, métricas, sub-nichos)
5. Reescrever frontends (Scripts, ChannelSearch, Branding, NicheExplorer)
6. Studio com geração de imagens real (Lovable AI image gen)
7. ElevenLabs TTS (requer connector approval)

