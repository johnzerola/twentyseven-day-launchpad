

# Diagnóstico: Consumo Excessivo de Créditos + Marcadores de Emoção no Roteiro

## Problemas encontrados

### 1. Consumo de créditos absurdo
**Causa-raiz:** Todas as chamadas de IA passam agora pelo Lovable AI Gateway como prioridade, usando `gemini-2.5-pro` (o modelo MAIS caro). Antes, o sistema usava diretamente a sua chave `GOOGLE_AI_API_KEY` (custo zero de créditos Lovable).

Para gerar UM ÚNICO roteiro de 15 minutos, o sistema faz:
- 1 chamada para Smart Knowledge Retrieval (re-ranking)
- 1 chamada para gerar o Hook (Phase 0) — `gemini-2.5-pro`
- 1 chamada para gerar o Outline — `gemini-2.5-flash`
- 2-3 chamadas para gerar os Atos — `gemini-2.5-pro`
- 0-2 chamadas de Overflow — `gemini-2.5-pro`
- Depois: cenas, títulos, thumbnails, afiliados — mais chamadas Pro

Total: **8-15 chamadas por vídeo**, maioria usando `gemini-2.5-pro` via Gateway.

O `gemini-2.5-pro` é 10-20x mais caro que o `gemini-2.5-flash`. E o Lovable Gateway cobra créditos por cada chamada.

**Solução:** Inverter a prioridade para que o sistema use a chave direta `GOOGLE_AI_API_KEY` como primário, e o Lovable Gateway apenas como fallback quando a chave direta falhar. Isso era o comportamento antigo.

### 2. Marcadores de emoção no roteiro
**Causa-raiz:** O system prompt da `generate-script` inclui um bloco inteiro chamado "EMOTIONAL INTENSITY ENGINE" (linhas 905-941) que **pede explicitamente** para o AI inserir marcadores `[EMOÇÃO: tipo]` no texto do roteiro. O prompt diz literalmente: *"Insira marcadores [EMOÇÃO: tipo] a cada 45-60 segundos no roteiro"*.

Isso polui o texto de narração com tags técnicas que não deveriam aparecer no roteiro final.

**Solução:** Remover a instrução de inserir marcadores `[EMOÇÃO: tipo]` no texto. Manter a orientação de VARIAR emoções entre blocos (isso é bom para o roteiro), mas sem pedir tags visíveis.

---

## Plano de implementação

### Passo 1: Inverter prioridade — GOOGLE_AI_API_KEY primeiro, Gateway como fallback
Em `supabase/functions/_shared/gemini-direct.ts`:
- `callGemini()`: Tentar primeiro a API direta com `GOOGLE_AI_API_KEY`. Se falhar (429/quota), usar Lovable Gateway como fallback.
- `callGeminiStreaming()`: Mesma inversão.
- `callGeminiWithFallback()`: Mesma inversão.
- `callGeminiOpenAICompat()`: Mesma inversão.
- Manter o tratamento de 402 do Gateway intacto.

Isso reduz o custo de créditos Lovable para quase zero quando a chave direta tem quota.

### Passo 2: Usar Flash em vez de Pro para etapas auxiliares
Em `supabase/functions/generate-script/index.ts`:
- Hook (Phase 0): manter Pro como primary (é crítico para qualidade)
- Outline: já usa Flash — manter
- Atos: trocar de Pro para Flash como primary, Pro como fallback
- Overflow: usar Flash
- ACT-CLOSE: usar Flash

Isso reduz o custo por chamada em ~10x para a maioria das etapas, sem perda significativa de qualidade.

### Passo 3: Remover marcadores de emoção do texto
Em `supabase/functions/generate-script/index.ts`:
- Remover o bloco "MARCADORES EMOCIONAIS" (linhas 909-918) que pede inserção de `[EMOÇÃO: tipo]`
- Manter o conceito de variação emocional entre blocos, mas como instrução narrativa, não como tag
- Adicionar instrução explícita: "NUNCA insira tags técnicas, marcadores entre colchetes, ou anotações de edição no texto — o roteiro deve ser 100% narração falada pura"

### Passo 4: Limpar outros marcadores técnicos do prompt
- Verificar e remover instruções de `[EDITOR: ...]` checkpoints (linha 144-146) — transformar em orientação narrativa sem tags
- Reforçar a limpeza no `getCleanNarration()` do AutoPilotEngine para filtrar qualquer marcador que escape

---

## Arquivos a editar
- `supabase/functions/_shared/gemini-direct.ts` — inverter prioridade API direta > Gateway
- `supabase/functions/generate-script/index.ts` — remover marcadores de emoção, usar Flash para atos
- `src/components/scripts/AutoPilotEngine.tsx` — melhorar limpeza de narração

## Resultado esperado
- Custo de créditos Lovable: queda de ~90% (usa a chave direta como primário)
- Roteiros limpos: sem `[EMOÇÃO: tipo]`, sem `[EDITOR: ...]`, apenas narração pura
- Qualidade mantida: Hook ainda usa Pro; atos usam Flash que é suficiente para narração

