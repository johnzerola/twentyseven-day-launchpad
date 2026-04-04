

# Plano: Absorver Treinamento de Produção de Vídeo no Pipeline de Cenas

## Contexto

O documento do usuário é um manual completo de produção de vídeo com IA (V2.0 Professional). O sistema já implementa ~80% desses princípios via DarkPlanner v3. Os elementos **novos e de alto valor** que faltam são:

1. **Prompt Anatomy Structure** — estrutura explícita de 9 componentes (Shot Type + Action + Characters + Setting + Lighting + Mood + Audio/ASMR + Dialogue + Technical Specs) como checklist formal
2. **Fixed Description Tags** — sistema `[nome_personagem]` com descrição resumida em cada prompt (atualmente o sistema copia verbatim mas não usa tags de referência curta)
3. **Scene Coverage Strategy** — regras de "filmagem" (abertura = wide, ação = medium/close, transição = establishing) como padrão automático
4. **ASMR Layer** — suporte a sons detalhados com categorias primário/secundário/terciário
5. **Multi-character positioning** — regras de foreground/background e limite de descrição
6. **Night/Weather/Historical templates** — instruções especializadas para condições difíceis
7. **Prompt length target** — o doc sugere 60-70 palavras (conflita com DarkPlanner v3 de 150-250). Vamos manter 150-250 para Veo3 mas absorver a estrutura interna
8. **Camera variety enforcement** — regras de não repetir shots consecutivos (já existe parcialmente)

## O que NÃO precisa mudar

- Policy filter (`veo3-policy-filter.ts`) — já cobre copyright/celebrity/brand/trigger
- Anti-text suffix — já implementado
- Character identity sheets — já implementado com verbatim copy
- Environment identity sheets — já implementado com 17 campos
- Style guides — já tem 19+ estilos

## Implementação

### 1. Criar bloco de conhecimento compartilhado: `_shared/video-production-training.ts`

Novo arquivo que exporta constantes reutilizáveis extraídas do treinamento:

- `PROMPT_ANATOMY_CHECKLIST` — os 9 componentes obrigatórios como string de instrução
- `SCENE_COVERAGE_STRATEGY` — regras de cobertura (abertura→wide, ação→medium, emoção→close-up, transição→establishing)
- `CAMERA_SHOT_VARIETY_RULES` — rotação obrigatória de ângulos, nunca repetir consecutivo
- `ASMR_SOUND_LAYER_GUIDE` — categorias de som (primary/secondary/tertiary) com exemplos por tipo
- `NIGHT_WEATHER_HISTORICAL_TEMPLATES` — instruções especializadas para noturno, chuva, neve, neblina, época histórica
- `MULTI_CHARACTER_RULES` — foreground/background, prioridade visual, limite de descrição
- `CHARACTER_TAG_FORMAT` — formato `[nome] gênero idade + 2-3 traços visuais + roupa`
- `TROUBLESHOOTING_RULES` — regras de consistência, movimento natural, iluminação correta

### 2. Integrar em `generate-synced-prompts/index.ts` (longform)

- Importar o novo módulo compartilhado
- Adicionar ao system prompt: `PROMPT_ANATOMY_CHECKLIST`, `SCENE_COVERAGE_STRATEGY`, `CAMERA_SHOT_VARIETY_RULES`, `MULTI_CHARACTER_RULES`
- Adicionar `ASMR_SOUND_LAYER_GUIDE` condicionalmente (quando niche inclui ASMR ou o usuário passa `enableASMR: true`)
- Adicionar `NIGHT_WEATHER_HISTORICAL_TEMPLATES` condicionalmente (quando script contém palavras-chave de noite/chuva/época)
- Adicionar `CHARACTER_TAG_FORMAT` ao bloco de construção de personagens existente

### 3. Integrar em `generate-visual-prompts/index.ts` (visual prompts simples)

- Importar e injetar `PROMPT_ANATOMY_CHECKLIST` e `CAMERA_SHOT_VARIETY_RULES` no system prompt
- Isso melhora a qualidade dos prompts visuais standalone

### 4. Integrar em `generate-scenes-short/index.ts` (shorts)

- Importar e injetar `PROMPT_ANATOMY_CHECKLIST`, `CAMERA_SHOT_VARIETY_RULES`, `MULTI_CHARACTER_RULES`
- O shorts já tem dopamine timing — adicionar apenas a estrutura anatômica e variedade de câmera

### 5. Post-processing: Validação de Anatomia de Prompt

Em cada edge function, após receber os prompts da IA, adicionar validação:
- Checar se tem pelo menos 3 dos 9 componentes anatômicos detectáveis (shot type, action verbs, lighting mention)
- Checar variedade de câmera (flaggar se 3+ prompts consecutivos usam mesmo tipo de shot)
- Adicionar warnings no metadata de retorno

### 6. Atualizar `SceneViewer.tsx`

- Mostrar badge de ASMR quando `audioDirection` contém "ASMR"
- Mostrar badge de condição especial (noturno/chuva/histórico) baseado nos dados do environment

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/_shared/video-production-training.ts` | **Criar** — constantes do treinamento |
| `supabase/functions/generate-synced-prompts/index.ts` | Editar — importar e injetar no system prompt |
| `supabase/functions/generate-visual-prompts/index.ts` | Editar — importar e injetar no system prompt |
| `supabase/functions/generate-scenes-short/index.ts` | Editar — importar e injetar no system prompt |
| `src/components/scripts/SceneViewer.tsx` | Editar — badges de ASMR/condições |

## Notas técnicas

- O treinamento sugere 60-70 palavras por prompt — isso é para ferramentas genéricas. Para Veo3, mantemos 150-250 palavras (comprovadamente melhor). A estrutura anatômica do doc é absorvida, não o tamanho.
- O sistema de tags `[nome_personagem]` é complementar ao verbatim copy que já existe — vai reforçar a consistência.
- Não criamos UI de wizard de configuração (as 6 perguntas do doc) porque o pipeline já tem PipelineStepper com 6 etapas equivalentes.

