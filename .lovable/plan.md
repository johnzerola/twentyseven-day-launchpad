

# Plano de Auditoria e Correção do Pipeline Completo de Roteiros

## Problema Central Identificado

**76 edge functions** ainda usam `LOVABLE_API_KEY` via o gateway `ai.gateway.lovable.dev`, que retorna **402 "Créditos insuficientes"**. As funções críticas do pipeline de roteiros — `generate-script`, `generate-synced-prompts`, `generate-visual-prompts`, `predict-retention`, `score-script`, `refine-script` — vão quebrar ao serem chamadas.

Apenas 3 funções foram migradas para o `GOOGLE_AI_API_KEY` direto: `extract-characters`, `generate-scenes-short`, `generate-titles`.

---

## Plano em 6 Partes

### PARTE 1: Migrar Funções Críticas do Pipeline para Gemini Direto
**Funções a migrar (prioridade máxima — pipeline de roteiros):**

| Função | Modelo Atual | Ação |
|--------|-------------|------|
| `generate-script` | Gemini 2.5 Pro via Gateway | Migrar para `generativelanguage.googleapis.com` com `GOOGLE_AI_API_KEY`. Manter streaming via SSE. |
| `refine-script` | Gemini Pro via Gateway | Migrar para Gemini direto. |
| `score-script` | GPT + Gemini via Gateway | Migrar para Gemini direto (dual score pode usar 2 chamadas Gemini com temperaturas diferentes). |
| `generate-synced-prompts` | Gemini 2.5 Pro via Gateway | Migrar para Gemini direto. Usar `responseMimeType: "application/json"` em vez de `tool_choice`. |
| `generate-visual-prompts` | Gemini 2.5 Flash via Gateway | Migrar para Gemini direto. |
| `predict-retention` | Gemini Flash Lite via Gateway | Migrar para Gemini direto. |

**Abordagem técnica:**
- Substituir `https://ai.gateway.lovable.dev/v1/chat/completions` por `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=${GOOGLE_AI_API_KEY}`
- Converter formato OpenAI (`messages[]`) → formato Gemini (`contents[]`)
- Para `tool_choice`, usar `responseMimeType: "application/json"` com schema no prompt
- Para streaming (`generate-script`), usar `streamGenerateContent?alt=sse` do Gemini

### PARTE 2: Voz Dopaminérgica e Magnética no TTS
**Problema:** O Gemini TTS atual só injeta instruções de velocidade ("brisk pace" / "slowly"). Falta a instrução de voz **dopaminérgica, magnética e emocional**.

**Correção no `google-tts/index.ts`:**
- Adicionar `stylePrefix` rico ao texto enviado ao Gemini TTS:
  ```
  "Read this narration with INTENSE energy and magnetic charisma. 
   Your voice must captivate — convey wonder, urgency, and emotion. 
   Vary your pace dramatically: slow down for revelations, speed up for excitement. 
   Use vocal emphasis on key words. Make the listener FEEL every sentence. 
   Deliver like a world-class documentary narrator who makes people unable to stop listening:"
  ```
- Permitir ao usuário escolher "Estilo de voz" na UI (Energético, Calmo, Misterioso, Dopaminérgico)
- Mapear cada estilo para instruções específicas no prompt do Gemini TTS

### PARTE 3: Consistência de Personagens nas Cenas
**Estado atual:** O sistema já possui:
- `CharacterManager` com biblioteca global (`global_characters`) e fotos de referência
- `generate-synced-prompts` com "Character Identity Sheets" (150-200 palavras, cópia verbatim)
- Regra de máximo 2 personagens por prompt

**Verificação:** O fluxo está correto. Os personagens são passados como `characters[]` ao gerar cenas, e o prompt exige cópia verbatim das descrições. O `SceneViewer` mostra personagens por cena com detalhes.

**Melhoria a implementar:**
- Quando há 3+ personagens numa cena, o sistema deve **automaticamente dividir** em sub-cenas de 8s com 2 personagens cada, em vez de depender apenas da instrução no prompt
- Garantir que `charactersInScene` no JSON de saída inclua objetos ricos (nome + descrição visual) e não apenas strings

### PARTE 4: Motor de Cenas — Sincronização e Qualidade Dopaminérgica
**Estado atual:** `generate-synced-prompts` já implementa:
- Cenas de 8s (limite Veo3), cobertura 100% do áudio
- DarkPlanner v3 com trio de movimento obrigatório
- Environment Identity Sheet (17 parâmetros)
- Camera variety (rotação obrigatória de ângulos)
- Dopaminergic visuals formula

**Melhoria:**
- Adicionar instrução explícita: "Every scene must create a VISCERAL emotional response — the viewer must feel compelled to keep watching. Use dramatic reveals, impossible-to-ignore beauty, and visual tension."
- Reforçar no prompt que Scene 1 (Hook) precisa ser **visualmente impossível de ignorar** — escala épica + micro-detalhe + movimento de câmera dramático

### PARTE 5: Títulos, Thumbnails e SEO
**Estado atual:** `generate-titles` já foi migrado para Gemini direto. Inclui:
- Análise de concorrentes via YouTube Data API
- Busca de tendências via Brave Search
- Geração de títulos virais + A/B testing + SEO

**Verificação necessária:** Confirmar que a função está retornando instruções de thumbnail (composição, paleta de cores, emoção-alvo). Se não estiver, adicionar ao prompt.

### PARTE 6: Idioma da Voz
**Estado atual:** O TTS passa o `language` selecionado ao Gemini, mas o Gemini TTS detecta idioma automaticamente pelo texto do roteiro. Se o roteiro é gerado em inglês, a voz sai em inglês.

**Verificação:** O fluxo `language` → `generate-script` (gera roteiro no idioma) → `google-tts` (narra o texto) funciona corretamente. O idioma é propagado.

---

## Resumo de Arquivos a Editar

1. `supabase/functions/generate-script/index.ts` — Migrar de Lovable Gateway para Gemini direto (streaming)
2. `supabase/functions/refine-script/index.ts` — Migrar para Gemini direto
3. `supabase/functions/score-script/index.ts` — Migrar para Gemini direto
4. `supabase/functions/generate-synced-prompts/index.ts` — Migrar para Gemini direto
5. `supabase/functions/generate-visual-prompts/index.ts` — Migrar para Gemini direto
6. `supabase/functions/predict-retention/index.ts` — Migrar para Gemini direto
7. `supabase/functions/google-tts/index.ts` — Adicionar instruções de voz dopaminérgica/magnética
8. `src/components/scripts/VoiceGeneratorStep.tsx` — Adicionar seletor de "Estilo de voz" (Dopaminérgico, Misterioso, Calmo, Energético)

## Ordem de Execução
1. Migrar `generate-script` (core do pipeline — mais crítico)
2. Migrar `refine-script` + `score-script` (completam o pipeline de roteiro)
3. Migrar `generate-synced-prompts` + `generate-visual-prompts` (pipeline visual)
4. Migrar `predict-retention` (analytics)
5. Atualizar TTS com voz dopaminérgica
6. Atualizar UI do Voice Step

