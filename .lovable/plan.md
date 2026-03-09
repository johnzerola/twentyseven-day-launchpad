

# Dotti Studio — O que falta para sincronizar com IA

## Status Atual

| Componente | Status |
|---|---|
| Fatiar roteiro em segmentos 8s | Funcionando |
| Gerar imagem por segmento (Gemini AI) | Funcionando |
| Gerar imagens em lote | Funcionando |
| Gerar prompts visuais automaticamente | **Falta** |
| Gerar audio (ElevenLabs TTS) | **Falta** — precisa conectar ElevenLabs |
| Sincronizar audio + imagens | **Falta** |

## O que precisa ser feito

### 1. Conectar ElevenLabs (Narração Real)
O connector ElevenLabs esta disponível na plataforma. Preciso conectar para que o botão "Gerar Áudio e Sincronizar" funcione de verdade. Isso vai:
- Criar uma edge function `elevenlabs-tts` que chama a API ElevenLabs
- Gerar áudio MP3 real para cada segmento ou para o roteiro completo
- Permitir escolher entre as vozes neurais (Daniel PT-BR, Roger EN-US, etc.)

### 2. Auto-gerar Prompts Visuais com IA
Quando o usuario fatia o roteiro, os campos "Prompt Visual" ficam vazios. Vou adicionar:
- Botão "Auto-gerar Prompts" que usa Lovable AI (Gemini) para analisar cada trecho do texto e criar um prompt visual cinematográfico automaticamente
- Preenche todos os campos de uma vez

### 3. Pipeline Completo (Orquestração)
Fluxo em 3 passos automatizados:
1. **Fatiar** roteiro em segmentos
2. **Gerar áudio** (ElevenLabs) + **auto-gerar prompts visuais** (Gemini)
3. **Gerar imagens em lote** (Gemini Image)

Adicionar botão "Pipeline Completo" que roda os 3 passos em sequência.

### 4. Edge Function `elevenlabs-tts`
- Recebe texto + voiceId
- Chama ElevenLabs API via connector gateway
- Retorna áudio MP3
- Player de áudio inline no Studio

## Arquivos a Criar/Editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/elevenlabs-tts/index.ts` | Criar — TTS via ElevenLabs connector |
| `supabase/functions/generate-visual-prompts/index.ts` | Criar — Auto-gerar prompts visuais com Gemini |
| `src/pages/Studio.tsx` | Editar — Pipeline completo, player de áudio, auto-prompts |
| `supabase/config.toml` | Editar — Adicionar novas functions |

## Primeiro Passo
Preciso conectar o ElevenLabs via connector. Vou solicitar a conexão agora.

