

# Pipeline Multi-IA: Claude no Refinamento + Loop de Aprendizado

## Resumo

Integrar o Claude (via CLAUDE_API_KEY já configurado) como editor especializado na fase de refinamento, com um loop de aprendizado que usa o feedback da avaliação para melhorar todas as IAs continuamente. O Gemini Flash continua gerando o rascunho (custo quase zero via API direta).

## Fluxo proposto

```text
FASE 1: GERAÇÃO (Gemini Flash — API direta, custo ~zero)
  └─ GPT sugere 3 mini-outlines → Gemini escolhe + escreve roteiro completo

FASE 2: REFINAMENTO (Claude — API direta via CLAUDE_API_KEY)
  └─ Claude lê o roteiro INTEIRO primeiro (contexto completo)
  └─ Reescreve o hook (30s) com emoção e magnetismo
  └─ Polimento emocional cirúrgico no corpo
  └─ Regra: NÃO pode mudar história, personagens ou eventos

FASE 3: AVALIAÇÃO (Gemini Flash — API direta, custo ~zero)
  └─ Score detalhado com pontos fortes e fracos

FASE 4: APRENDIZADO (automático, sem custo extra)
  └─ Feedback da avaliação salvo na tabela ai_learning
  └─ Próximas gerações consultam esses aprendizados
  └─ IAs evitam erros recorrentes (roteiro curto, final previsível, etc.)
```

## Economia vs. Fluxo atual

| Etapa | Antes | Depois |
|---|---|---|
| Geração | Gemini Flash (direto) | Gemini Flash (direto) — igual |
| Hook separado | Gemini Pro (caro) | Eliminado — Claude faz no refinamento |
| Refinamento | Gemini (direto) | Claude (direto via CLAUDE_API_KEY) |
| Avaliação | GPT-5 via Gateway ($$$) + Gemini | 2x Gemini Flash (direto, ~zero) |
| Total créditos Lovable | ~R$0,23/vídeo | ~R$0,00 (tudo via API direta) |

A chave `CLAUDE_API_KEY` já está configurada nos secrets. Claude Sonnet é ~$3/M tokens input, ~$15/M output. Um refinamento de roteiro de 10min (~2000 palavras) custa ~$0,01-0,02.

## Implementação técnica

### 1. Adicionar `callClaude()` ao `gemini-direct.ts`
- Nova função `callClaude(system, userMsg, opts)` que chama `https://api.anthropic.com/v1/messages` com `CLAUDE_API_KEY`
- Nova função `callClaudeStreaming()` para refinamento com streaming
- Modelo: `claude-sonnet-4-20250514` (melhor custo-benefício para edição)

### 2. Atualizar `generate-script/index.ts` — GPT sugere outlines
- Antes de gerar, chamar Gemini Flash para 3 mini-outlines (1 chamada barata)
- O outline vencedor alimenta a geração principal
- Remover a fase de Hook separada (Claude faz isso no refinamento)

### 3. Reescrever `refine-script/index.ts` — Claude como editor
- Claude recebe o roteiro completo + contexto (nicho, estilo, duração)
- Instruções: ler tudo primeiro, depois polir hook + emoção + magnetismo
- Regra absoluta: não mudar história, personagens, eventos
- Saída: narração pura, zero tags técnicas

### 4. Atualizar `score-script/index.ts` — Eliminar GPT-5 via Gateway
- Trocar `callLovableAI(openai/gpt-5)` por `callGemini(gemini-2.5-flash)` (API direta)
- Mantém avaliação dual (2x Flash com temperaturas diferentes)
- Zero custo de créditos Lovable

### 5. Loop de aprendizado evolutivo
- Já existe parcialmente (`ai_learning` table + `dual_score_rejection`)
- Expandir: salvar TODOS os feedbacks (aprovados + rejeitados)
- Injetar os top 10 aprendizados recentes no system prompt da geração E do refinamento
- Categorizar erros: "roteiro curto", "final previsível", "linguagem IA", "hook fraco"

### 6. AutoPilotEngine — Integrar refinamento no pipeline
- Após geração do script, chamar `refine-script` automaticamente
- Mostrar progresso: "Refinando com IA especializada..."
- O script refinado é o que vai para TTS

## Arquivos a editar
- `supabase/functions/_shared/gemini-direct.ts` — adicionar `callClaude` + `callClaudeStreaming`
- `supabase/functions/refine-script/index.ts` — trocar Gemini por Claude
- `supabase/functions/score-script/index.ts` — eliminar GPT-5 via Gateway
- `supabase/functions/generate-script/index.ts` — remover hook separado
- `src/components/scripts/AutoPilotEngine.tsx` — integrar refinamento no pipeline

