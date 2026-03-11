

# Plano: Simplificar exportação + Salvar guia AutoFlow no banco

## O que vai mudar

### 1. Scripts.tsx — Botão único "Copiar Cenas"
- **Remover** os 3 botões extras (JSON Completo, Detalhado, Personagens JSON) — linhas 1532-1585
- **Substituir** o bloco AutoFlow atual por um único botão "📋 Copiar Cenas AutoFlow" que copia **AMBOS** formatos:
  - Primeiro: as linhas AutoFlow `[V1-S#] image prompt ||| [V1-S#] video prompt` (uma por cena)
  - Depois: separador `\n\n===JSON DETALHADO===\n\n` + JSON com dados completos de cada cena (duração, câmera, mood, personagens, timestamps)
- **Corrigir o video prompt** — atualmente gera texto genérico (`cinematic motion, smooth transition`). Vai usar os dados reais: `lensSpec`, `lightingSetup`, `cameraAngle` + `mood` para gerar um prompt de câmera rico conforme o guia AutoFlow (ex: "Slow dolly-in, Rembrandt lighting, 85mm portrait lens, tense mood")
- **Remover** `imageUrl` e `generatingImage` do tipo `Character`

### 2. Salvar guia AutoFlow como conhecimento global
- Inserir o conteúdo do guia AutoFlow na tabela `scene_prompt_knowledge` com categoria `autoflow-format` e viral_score alto, para que a edge function `generate-synced-prompts` sempre consulte essas regras ao gerar prompts
- Conteúdo: regras de formato (tags [V#-S#], delimitador |||, vocabulário de câmera, uma linha por prompt, sem headers/comentários)

### 3. Edge Function `generate-synced-prompts` — Instruir IA sobre formato AutoFlow
- Adicionar no system prompt uma seção `AUTOFLOW FORMAT RULES` que ensina à IA o formato correto de saída, garantindo que os `visualPrompt` e `cameraAngle` já saiam prontos para colar no AutoFlow

### Arquivos modificados
- `src/pages/Scripts.tsx` — limpar botões, corrigir formato de cópia
- `supabase/functions/generate-synced-prompts/index.ts` — adicionar regras AutoFlow no prompt
- Inserção de dados na tabela `scene_prompt_knowledge` via insert tool

