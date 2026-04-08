

# Plano: Modo Piloto Automático + Emoções Dopaminérgicas

O sistema já tem o motor de monetização das 10 seções implementado. O que falta, baseado no seu pedido, são duas coisas:

1. **Botão "Modo Piloto Automático"** — 1 clique gera tudo: roteiro, áudio, cenas, título, SEO, descrição, thumbnail
2. **Emoções dopaminérgicas intensificadas** nos roteiros e na voz

---

## 1. Modo Piloto Automático (Scripts page)

Adicionar botão "🚀 Gerar Tudo Automaticamente" na página Scripts que executa o pipeline completo em sequência:

**Fluxo automático:**
1. Gerar roteiro (edge function `generate-script`)
2. Gerar áudio/voz (edge function `google-tts` com estilo dopaminérgico)
3. Extrair personagens (edge function `extract-characters`)
4. Gerar cenas visuais sincronizadas (edge function `audio-to-scenes` ou `generate-synced-prompts`)
5. Gerar títulos + SEO (edge function `generate-titles` + `seo-analyzer`)
6. Gerar thumbnail (edge function `generate-thumbnail-prompt`)
7. Mostrar tudo pronto no Production Pack

**Componente novo:** `src/components/scripts/AutoPilotEngine.tsx`
- Barra de progresso com 7 etapas visuais
- Cada etapa mostra status: pendente, processando, concluído, erro
- Se uma etapa falha, continua com as próximas e marca como "manual"
- Ao final, navega automaticamente para a aba "Títulos & SEO" mostrando o Production Pack completo

**Integração:** Botão no topo da página Scripts, ao lado de "Gerar Roteiro". Requer apenas: tópico + nicho preenchidos.

---

## 2. Emoções Dopaminérgicas Intensificadas

### No Roteiro (edge function `generate-script`)
Adicionar ao system prompt um bloco `EMOTIONAL_INTENSITY_ENGINE`:
- Mapa de emoções obrigatório: cada bloco de 45-60s DEVE alternar entre curiosidade, choque, compaixão e dopamina
- Instruções de "emotional whiplash" amplificadas
- Marcadores `[EMOÇÃO: choque]`, `[EMOÇÃO: dopamina]`, `[EMOÇÃO: tensão]` no roteiro para guiar o editor

### Na Voz (edge function `google-tts`)
Expandir os `VOICE_STYLE_PROMPTS` no Gemini TTS com instruções emocionais mais ricas:
- Dopaminérgico: adicionar "Build tension with pauses before reveals. Whisper on shocking moments. SHOUT on reveals. Your voice should make listeners feel ADRENALINE."
- Misterioso: adicionar "Drop to near-whisper on dark moments. Let silence hang for 0.5s before key reveals."
- Energético: adicionar "Every sentence should feel like the most important thing ever said. Punchy, rhythmic, infectious."

### No Frontend (VoiceGeneratorStep)
Adicionar selector "Intensidade Emocional" com 3 níveis:
- Normal (atual)
- Alta (instruções emocionais extras no prompt TTS)
- Máxima (todas as técnicas ativas + marcadores emocionais no texto)

---

## Arquivos a criar
- `src/components/scripts/AutoPilotEngine.tsx`

## Arquivos a editar
- `src/pages/Scripts.tsx` — integrar AutoPilotEngine
- `supabase/functions/generate-script/index.ts` — adicionar EMOTIONAL_INTENSITY_ENGINE ao prompt
- `supabase/functions/google-tts/index.ts` — expandir voice style prompts com emoções
- `src/components/scripts/VoiceGeneratorStep.tsx` — selector de intensidade emocional
- `src/components/scripts/PipelineStepper.tsx` — indicador visual de auto-pilot ativo

## Sem migrações de banco necessárias

