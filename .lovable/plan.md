

# Auditoria Completa + Plano de Escala do Sistema

## Diagnóstico Atual

### Dados na Base (PROBLEMA CRITICO: Volume Baixo)
| Recurso | Atual | Meta |
|---------|-------|------|
| Canais analisados | 715 | 5.000+ |
| Títulos virais | 2.142 | 50.000+ |
| Hooks | 375 | 5.000+ |
| Padrões virais | 34 | 500+ |
| Content DNA | 146 | 2.000+ |
| Keywords SEO | 25 | 10.000+ |
| Thumbnails patterns | 15 | 500+ |
| Scene patterns | 0 | 300+ |
| Ref channels | 12 | 200+ |
| Calibração scores | 92 | 500+ |

### 402 "Créditos Insuficientes" — 69 funções ainda quebradas
**69 edge functions** ainda usam `ai.gateway.lovable.dev` com `LOVABLE_API_KEY`. Isso inclui funções críticas como `chat-assistant` (Dotti), `find-competitors`, `emulate-channel`, `reverse-engineer-video`, `extract-content-dna`, `self-learning-engine`, e mais. Todas vão retornar **402** ao serem chamadas.

### Sidebar Sobrecarregada (13 itens)
O menu lateral tem 13 itens incluindo "Knowledge Admin" (técnico demais para usuários), rotas redundantes (Growth Tools vs Power Tools), e funcionalidades que poderiam ser consolidadas.

### Voz sem Seletor de Estilo na UI
O backend do TTS já suporta `voiceStyle` (dopaminergico, misterioso, energetico, calmo), mas a UI do `VoiceGeneratorStep` **não envia** esse parâmetro — a voz sempre sai no modo padrão.

---

## PLANO DE EXECUÇÃO (8 Partes)

### PARTE 1: Migrar as 69 Funções Restantes para Gemini Direto
**Prioridade: CRITICA — tudo quebra sem isso**

Criar um helper reutilizável `_shared/gemini-direct.ts` (já existe parcialmente) e migrar em lotes:

**Lote A — Funções do Usuário (mais usadas):**
- `chat-assistant` (Dotti) — maior e mais complexa, ~1900 linhas
- `find-competitors`, `find-competitors-ai`
- `emulate-channel`
- `reverse-engineer-video`
- `packaging-score`

**Lote B — Motores de Inteligência:**
- `extract-content-dna`, `self-learning-engine`
- `channel-intelligence`, `learn-channel-voice`
- `viral-diagnosis`, `monetization-coach`
- `next-best-action`, `audience-psychology-engine`

**Lote C — Crons e Workers:**
- `auto-scan-channels`, `analyze-viral-channels`
- `viral-score-worker`, `evolve-patterns`
- `data-seeding-engine`, `seed-elite-knowledge`
- Todas as demais 50+ funções

**Abordagem:** Substituição mecânica — trocar URL + headers + formato de mensagem em cada função. Usar `responseMimeType: "application/json"` onde `tool_choice` era usado.

### PARTE 2: Escalar Base de Dados (de 715 canais para 5.000+)
**Problema:** O auto-scan está limitado a 1 execução/dia, 2 nichos, 3 canais/nicho = máximo 6 canais/dia.

**Solução:**
1. Aumentar `MAX_RUNS_PER_DAY` de 1 → 3
2. Aumentar `MAX_NICHES_PER_RUN` de 2 → 5
3. Aumentar `MAX_CHANNELS_PER_NICHE` de 3 → 8
4. Expandir `SCAN_CONFIGS` de 12 → 25 nichos (adicionar: psychology, history, animals, survival, restoration, ASMR, gaming lore, conspiracy, ancient civilizations, science, health, cooking, DIY, relationship)
5. Criar uma função `bulk-data-seeder` que pode ser chamada manualmente para popular a base com 500+ canais de uma vez via queries especializadas
6. Alimentar automaticamente `viral_titles_db`, `hook_library`, `scene_patterns` e `youtube_keywords` a partir de cada canal analisado

### PARTE 3: Simplificar a Sidebar (de 13 → 8 itens)
**Consolidações:**
- Fundir **Power Tools** dentro de **Growth Tools** como aba extra
- Fundir **Shorts Trends** dentro de **Viral Database**
- Remover **Knowledge Admin** do menu (mover para settings ou acesso via Dotti)
- Resultado: Dashboard, Tracker, Roteiros, Títulos, DubSpy, Canais, Viral DB, Growth Tools

### PARTE 4: Conectar Seletor de Estilo de Voz na UI
**Bug atual:** `VoiceGeneratorStep` não passa `voiceStyle` ao chamar `google-tts`.

**Correção:**
1. Adicionar seletor de cards com 4 estilos (Dopaminérgico, Misterioso, Calmo, Energético) no componente
2. Cada card com ícone, nome e descrição curta do tom
3. Enviar `voiceStyle` no body da request ao gerar áudio
4. Adicionar botão "Preview 5s" que gera amostra curta da voz no estilo selecionado

### PARTE 5: Melhorar Qualidade do Áudio (Nível Adobe Podcast)
**Estado atual:** O `AudioMasteringPanel` já tem um pipeline de 12 estágios (noise gate, EQ, compressor, limiter, LUFS). Mas:
- O processamento é **client-side** com Web Audio API — funcional mas limitado
- Falta **auto-apply** após gerar voz — o usuário tem que manualmente ir para o painel

**Melhoria:**
1. Após gerar voz no TTS, automaticamente aplicar preset "YouTube Narration" do mastering
2. Adicionar preset "Adobe Podcast Style" (agressivo de-noise + clarity boost + warmth)
3. Mostrar waveform antes/depois inline no VoiceGeneratorStep
4. Integrar o de-noise como primeiro passo automático pós-geração

### PARTE 6: Consolidar Rotas Redundantes e Corrigir Links Mortos
**Problemas encontrados:**
- Dashboard tem "Quick Action" apontando para `/branding` que redireciona para `/growth-tools` (link indireto)
- Dashboard tem "Quick Action" para `/workflow` que redireciona para `/tracker` (link indireto)
- `PowerTools` mostra resultados como JSON bruto (`<pre>`) — precisa de formatação visual

**Correções:**
- Atualizar QUICK_ACTIONS para apontar diretamente às rotas certas
- Criar `ResultDisplay` formatado para cada tool do PowerTools (cards, badges, scores visuais)

### PARTE 7: Otimizar o Dotti (Chat Assistant)
**Problemas:**
- Usa `ai.gateway.lovable.dev` em ~10 pontos do código (vai dar 402)
- Arquivo com ~1900 linhas — monolítico, difícil de manter
- Função `generateQueryEmbedding` usa o gateway para embeddings

**Solução:**
- Migrar todas as chamadas para Gemini direto
- Para embeddings, usar `text-embedding-004` do Google diretamente
- Manter streaming via SSE com formato OpenAI-compatible para o frontend

### PARTE 8: Criar Pipeline de Enriquecimento Massivo
**Para atingir as metas de volume (50k títulos, 5k hooks, 10k keywords):**

1. Criar `mass-enrichment-pipeline` edge function que:
   - Recebe uma lista de video IDs do YouTube
   - Extrai títulos, tags, descrições, thumbnails
   - Classifica com Gemini Flash-lite (barato e rápido)
   - Popula `viral_titles_db`, `hook_library`, `youtube_keywords`, `thumbnail_patterns`

2. Criar um "botão de admin" no dashboard para disparar enriquecimento manual por nicho

3. Expandir o cron `auto-scan-channels` para também extrair dados dos vídeos top de cada canal (não apenas metadata do canal)

---

## Resumo de Arquivos a Editar

**Backend (69+ edge functions):**
- Todas as 69 funções listadas no grep `ai.gateway.lovable.dev` — migrar para Gemini direto
- Criar `mass-enrichment-pipeline/index.ts`
- Atualizar `auto-scan-channels/index.ts` (limites + nichos)

**Frontend:**
- `src/components/dashboard/DashboardLayout.tsx` — Simplificar sidebar de 13 → 8
- `src/components/scripts/VoiceGeneratorStep.tsx` — Adicionar seletor de estilo de voz + auto-mastering
- `src/pages/Dashboard.tsx` — Corrigir links mortos em QUICK_ACTIONS
- `src/pages/PowerTools.tsx` — Mover conteúdo para dentro de GrowthTools
- `src/pages/GrowthTools.tsx` — Absorver Power Tools como aba
- `src/pages/ShortsTrends.tsx` — Mover para dentro de ViralDatabase
- `src/App.tsx` — Atualizar rotas e redirects

## Ordem de Execução
1. Migrar Dotti + funções mais usadas (elimina 402)
2. Conectar seletor de voz na UI (quick win)
3. Simplificar sidebar + corrigir links
4. Escalar auto-scan + criar enriquecimento massivo
5. Melhorar pipeline de áudio
6. Migrar funções restantes em lotes

