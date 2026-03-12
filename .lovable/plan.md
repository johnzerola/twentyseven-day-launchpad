

# Restaurar Upload de Áudio + Transcrição via Gemini + Cenas Sincronizadas Inteligentes

## Resumo

Restaurar o upload de áudio no AudioProcessor, usar Gemini (Lovable AI) para transcrição em vez de ElevenLabs (economia de custos), e fazer a IA funcionar como "diretor criativo" — analisando tempos de fala para criar cenas com duração e conteúdo alinhados ao que está sendo narrado.

---

## O que muda

### 1. AudioProcessor.tsx — Restaurar upload de áudio + campo de estilo customizado

- Adicionar input de upload de áudio (`<input type="file" accept="audio/*">`)
- Adicionar campo de texto opcional "Instruções extras de estilo" (ex: "quero cinematográfico com tons dourados")
- Manter o botão "Gerar Cenas" que agora envia o áudio para a Edge Function
- Remover controle de duração do usuário — a IA decide tudo
- Exibir progresso: "Transcrevendo áudio..." → "Analisando narração..." → "Gerando cenas..."

### 2. Nova Edge Function: `transcribe-and-generate-scenes/index.ts`

Pipeline unificado em uma só function (evita timeout):

**Fase 1 — Transcrição via Gemini:**
- Converter áudio para base64
- Enviar para Gemini 2.5 Flash com prompt: "Transcreva este áudio com timestamps por frase"
- Receber texto + timestamps de cada bloco de fala

**Fase 2 — Geração de cenas sincronizadas:**
- Usar a transcrição com timestamps + roteiro + estilo + personagens + instruções extras
- Gemini 2.5 Pro como "diretor criativo" decide:
  - Duração de cada cena (5-10s)
  - Conteúdo visual que faz sentido com o que está sendo falado naquele momento
  - Múltiplas cenas por bloco narrativo (ex: pirâmide → drone → estudante → documentário)
  - startTime/endTime alinhados com a fala real
- Injetar personagens nos prompts quando necessário
- Usar toda a knowledge base existente (scene_prompt_knowledge, script_knowledge, viral_patterns)

**Exemplo do fluxo narrativo:**
```text
[0.0s-8.2s] "As pirâmides do Egito foram construídas há milhares de anos..."
  → Cena 1 (0-5s): Drone aéreo sobre pirâmides ao amanhecer, luz dourada
  → Cena 2 (5-10s): Close nos blocos de pedra com textura detalhada

[8.2s-15.0s] "Estudiosos ainda debatem como foram construídas..."
  → Cena 3 (8-13s): Sala de universidade, aluno estudando com livros sobre Egito
  → Cena 4 (13-18s): TV mostrando documentário sobre pirâmides
```

### 3. Estilo Visual — Campo customizado adicional

No step 2 (Estilo Visual) em Scripts.tsx:
- Manter os cards de seleção de estilo existentes
- Adicionar `<Textarea>` abaixo: "Descreva detalhes extras do estilo visual que deseja (opcional)"
- Passar `customStyleNotes` para a Edge Function junto com `videoStyle`

### 4. Personagens nas cenas

A Edge Function já recebe os personagens. O prompt do Gemini será reforçado para:
- Incluir descrição completa do personagem em cenas onde ele aparece
- Decidir autonomamente em quais cenas cada personagem deve estar

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `src/components/scripts/AudioProcessor.tsx` | Reescrever — upload de áudio + campo estilo extra + progresso |
| `supabase/functions/transcribe-and-generate-scenes/index.ts` | Criar — transcrição Gemini + geração de cenas |
| `src/pages/Scripts.tsx` | Editar — adicionar `customStyleNotes` state e Textarea no step de estilo |
| `src/components/scripts/types.ts` | Editar — adicionar `customStyleNotes` ao AudioProcessorProps |
| `supabase/config.toml` | Adicionar entry para nova function |

---

## Detalhes técnicos

- **Transcrição**: Gemini 2.5 Flash aceita áudio inline (base64) e retorna texto com timestamps estimados por frase
- **Limite de áudio**: ~25MB (Gemini suporta até 20min de áudio inline)
- **Sem ElevenLabs**: Zero custo adicional de API para transcrição
- **Duração das cenas**: IA decide (5-10s max), sem input do usuário
- **Cobertura total**: Da cena 1 (00:00) até o final do áudio, sem lacunas

