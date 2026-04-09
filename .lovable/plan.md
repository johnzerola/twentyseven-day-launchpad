
Diagnóstico confirmado

Do I know what the issue is? Sim.

O erro principal agora não é mais só “áudio curto”. O fluxo está falhando antes, já no roteiro, e por isso às vezes “não gera nada”.

O que encontrei no código e nos sinais da sessão:
- A chamada para `generate-script` voltou `200`, mas o stream veio praticamente vazio: só `data: [DONE]`.
- No frontend, `AutoPilotEngine` interpreta isso como string vazia e lança o erro genérico `Script too short`.
- No backend, `supabase/functions/generate-script/index.ts` fecha o SSE com `[DONE]` quando o provedor devolve `402` ou `429`, em vez de devolver um erro estruturado. Resultado: o usuário recebe um falso “sucesso vazio”.
- Existe também uma condição de corrida no auto-start:
  - `Scripts.tsx` chama `autoLaunchRef.current?.()` com `setTimeout(300)`
  - mas o `AutoPilotEngine` só existe depois de `wizardConfigured`
  - então em alguns casos o clique/launch acontece antes do engine estar pronto, e parece que “nada aconteceu”.
- Há bugs secundários que reduzem a confiabilidade:
  - `generateTTSChunk()` usa `Bearer` com chave pública em vez da sessão do usuário
  - fallback de browser TTS é tratado como sucesso mesmo em longform
  - o AutoPilot não envia para o pipeline chunked o mesmo contexto rico que o `AudioProcessor` envia
  - a UI aceita cobertura parcial de cenas como “ok”
  - `Badge` não usa `forwardRef`, causando warning com Framer Motion

Plano de correção

1. Corrigir o erro silencioso no gerador de roteiro
- Ajustar `supabase/functions/generate-script/index.ts` para nunca encerrar stream vazio em erro de provedor.
- Quando houver `402`, `429` ou resposta vazia do modelo:
  - retornar erro explícito, ou
  - emitir evento SSE de erro estruturado antes de finalizar.
- Padronizar códigos de erro como:
  - `INSUFFICIENT_CREDITS`
  - `RATE_LIMITED`
  - `EMPTY_PROVIDER_STREAM`
  - `SCRIPT_GENERATION_FAILED`

2. Tornar o frontend capaz de entender erro real
- Atualizar `generateScriptSSE()` em `AutoPilotEngine.tsx` para:
  - detectar stream vazio
  - detectar evento SSE de erro
  - distinguir falha real de “roteiro curto”
- Mostrar mensagens corretas no painel:
  - “Créditos insuficientes”
  - “Rate limit, tente novamente”
  - “O provedor não retornou conteúdo”
- Impedir continuação automática para voz/cenas quando o roteiro falhar.

3. Remover a condição de corrida no auto-launch
- Substituir o `setTimeout(300)` em `src/pages/Scripts.tsx` por um handshake robusto:
  - guardar intenção de launch
  - disparar apenas quando `AutoPilotEngine` já tiver registrado `onReady`
- Isso resolve o caso em que o usuário clica e “não acontece nada”.

4. Endurecer a etapa de áudio para longform real
- Em `AutoPilotEngine.tsx`, usar o token da sessão do usuário nas chamadas diretas de TTS.
- Tratar `browser fallback` como modo degradado, não como sucesso pleno para 8–60 min.
- Se não houver áudio real decodificável:
  - não marcar a etapa como concluída normal
  - só seguir com aviso explícito ou tentar fallback controlado
- Manter a concatenação segura já existente em `src/lib/audio-concat.ts`.

5. Unificar o pipeline de cenas do AutoPilot com o pipeline manual
- O `AudioProcessor.tsx` hoje manda mais contexto para `transcribe-and-generate-scenes` do que o AutoPilot.
- Vou alinhar o AutoPilot para enviar também:
  - áudio real quando existir
  - `audioMimeType`
  - `customStyleNotes`
  - `referenceImageUrls`
  - `sceneBlueprintFromScript`
  - personagens
- Para longform, o AutoPilot deve usar sempre o pipeline chunked robusto, com base no áudio real quando disponível.

6. Subir o padrão de “sucesso” para 100% do que foi pedido
- Hoje o sistema ainda aceita coisas “quase ok”.
- Vou considerar sucesso apenas quando:
  - roteiro atingir a meta mínima de palavras
  - áudio real atingir a duração mínima definida
  - cenas cobrirem a timeline inteira do áudio
- Ajustes:
  - `ProductionPack.tsx` passa a mostrar falha se cobertura não for total
  - AutoPilot não fecha como concluído se alguma etapa crítica ficar incompleta
  - cobertura deixa de usar limite frouxo como 80%

7. Corrigir bugs visuais e de diagnóstico da UI
- Ajustar `src/components/ui/badge.tsx` para `forwardRef`, eliminando warning com Framer Motion.
- Melhorar o painel do AutoPilot para exibir:
  - erro técnico real
  - duração real do áudio
  - cenas esperadas vs geradas
  - status de fallback/degradação

Arquivos principais
- `supabase/functions/generate-script/index.ts`
- `src/components/scripts/AutoPilotEngine.tsx`
- `src/pages/Scripts.tsx`
- `src/components/scripts/AudioProcessor.tsx`
- `src/components/scripts/ProductionPack.tsx`
- `src/components/ui/badge.tsx`

Detalhes técnicos
- Causa-raiz imediata do “não gerou”: stream SSE vazio mascarado como sucesso no backend.
- Causa-raiz intermitente do “cliquei e nada aconteceu”: corrida entre wizard e `autoLaunchRef`.
- Causa-raiz histórica do áudio truncado: concatenação/medição do áudio; a base disso já existe, mas a orquestração ainda precisa ficar mais rígida.
- Observação honesta de engenharia: não existe como prometer que um provedor externo nunca dará rate limit ou falta de crédito; o que dá para garantir é:
  - fallback correto
  - erro explícito
  - nenhum falso sucesso
  - nenhuma continuação para cenas/áudio quando o roteiro não existir de verdade

Validação final que vou aplicar na implementação
- Teste ponta a ponta para: 8, 15, 25, 40 e 60 min
- Validar estes cenários:
  - geração normal
  - provedor com rate limit
  - crédito insuficiente
  - TTS MP3
  - TTS WAV
- Conferir em cada caso:
  - se o clique sempre inicia de fato
  - se o roteiro veio com conteúdo real
  - se o áudio medido bate a meta
  - se as cenas cobrem toda a timeline
  - se a UI mostra erro verdadeiro, nunca “script too short” quando o problema for outro
