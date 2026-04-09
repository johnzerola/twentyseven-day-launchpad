
Objetivo: deixar o pipeline de vídeos longos realmente confiável de 8, 15, 25, 40 e 60 minutos, garantindo que roteiro, áudio e cenas cubram a duração escolhida.

1. Diagnóstico do erro atual
- O material que você enviou mostra um desencontro claro:
  - pedido: 15 min
  - production pack: 2851 palavras (~19 min)
  - áudio real no console: 131s (~2m11s)
  - cenas geradas: 17
- Isso indica que o problema principal NÃO foi o roteiro.
- O roteiro veio longo o suficiente, mas o áudio final ficou truncado/corrompido e a etapa de cenas usou essa duração errada de 131s.

2. Causas-raiz encontradas no código
- AutoPilotEngine concatena os chunks de áudio com `new Blob(blobs)` sem tratar WAV corretamente.
  - Isso funciona melhor para MP3.
  - Quando o fallback de TTS retorna WAV, o arquivo final pode ficar com vários headers WAV colados, e o player/decoder passa a “enxergar” só uma parte do áudio.
- O manual de voz já tem uma concatenação WAV correta em `VoiceGeneratorStep.tsx`, mas o AutoPilotEngine não reutiliza essa lógica.
- O AutoPilotEngine gera cenas com a função direta `generate-synced-prompts`, em um único request.
  - Isso é frágil para longform.
  - Para 15, 25, 40 e 60 min, a quantidade de cenas explode e esse modelo não é o caminho mais seguro.
- Falta um “loop de garantia” entre:
  - duração pedida
  - tamanho do roteiro
  - duração real do áudio
  - quantidade final de cenas

3. O que vou implementar
- Corrigir a montagem de áudio no AutoPilotEngine
  - Extrair a lógica segura de concatenação de áudio para util compartilhado.
  - Suportar corretamente:
    - MP3 concatenado
    - WAV concatenado com header refeito
  - Medir a duração real do arquivo final sempre.
- Criar validação obrigatória de duração
  - Após gerar o roteiro: validar se ele bate a meta mínima por duração.
  - Após gerar o áudio: validar se a duração real bate a duração escolhida.
  - Se o áudio ficar menor do que o solicitado, o sistema entra em modo de correção automática:
    - gera continuação do roteiro apenas para o tempo faltante
    - gera só o trecho de áudio faltante
    - anexa ao áudio existente
    - mede de novo
  - Repetir até atingir a meta mínima.
- Trocar a geração de cenas do AutoPilotEngine para o pipeline assíncrono já existente
  - Em vez de chamar `generate-synced-prompts` direto para o vídeo inteiro, usar o fluxo robusto:
    - `transcribe-and-generate-scenes` start
    - `generate_chunk`
    - `finalize`
  - Esse pipeline já foi feito exatamente para evitar quebra em materiais longos.
- Adicionar guard rails para longform
  - Reservar `generate-synced-prompts` para casos curtos/pequenos.
  - Para longform, forçar o pipeline chunked.
  - Se algum caminho tentar gerar cenas demais num único request, bloquear e redirecionar automaticamente.
- Exibir métricas reais na interface
  - duração solicitada
  - palavras do roteiro
  - duração real do áudio
  - cenas esperadas (`ceil(audio/8)`)
  - cenas geradas
  - status de sincronização
- Ajustar o Production Pack
  - parar de mostrar apenas estimativa por palavras
  - incluir também:
    - duração real do áudio
    - cobertura de cenas
    - alerta visível se algum item não bate com a duração escolhida

4. Arquivos principais que precisam entrar nessa correção
- `src/components/scripts/AutoPilotEngine.tsx`
  - corrigir concatenação de áudio
  - medir duração real
  - implementar auto-correção de duração
  - trocar cenas para pipeline chunked
- `src/components/scripts/VoiceGeneratorStep.tsx`
  - reaproveitar/extrair a lógica segura de concatenação WAV
- `src/components/scripts/AudioProcessor.tsx`
  - compartilhar a orquestração chunked de cenas com o AutoPilot
- `supabase/functions/generate-script/index.ts`
  - reforçar garantia de comprimento mínimo por duração
  - permitir continuação automática quando faltar tempo real
- `supabase/functions/generate-synced-prompts/index.ts`
  - colocar trava para não ser usado em longform pesado
- `src/components/scripts/ProductionPack.tsx`
  - mostrar duração real e cobertura final

5. Regra de garantia por duração
Vou tratar como sucesso apenas quando os 3 itens baterem:
- roteiro suficiente para a duração
- áudio real com pelo menos a duração escolhida
- cenas cobrindo 100% do áudio real

Exemplos de aceite:
- 8 min → áudio >= 8:00, cenas >= 60
- 15 min → áudio >= 15:00, cenas >= 113
- 25 min → áudio >= 25:00, cenas >= 188
- 40 min → áudio >= 40:00, cenas >= 300
- 60 min → áudio >= 60:00, cenas >= 450

6. Estratégia para “isso nunca mais ocorrer”
- Unificar a lógica dos fluxos manual e automático para não existirem dois comportamentos diferentes.
- Impedir que o sistema avance para cenas quando o áudio real estiver abaixo do solicitado.
- Validar a saída em cada etapa antes de seguir para a próxima.
- Mostrar ao usuário o diagnóstico real, em vez de parecer que “deu certo” quando só uma parte foi gerada.

7. Resultado esperado após a correção
- Se você escolher 1 hora:
  - o roteiro será grande o bastante
  - o áudio final terá pelo menos 1 hora
  - as cenas cobrirão a 1 hora inteira
  - o pack final mostrará números reais, não estimativas enganosas

Detalhes técnicos
- Bug crítico confirmado: truncamento do áudio por concatenação inadequada de múltiplos chunks, especialmente quando o TTS retorna WAV.
- Sintoma colateral confirmado: como o AutoPilot usa a duração do áudio corrompido para gerar cenas, a contagem de cenas cai drasticamente.
- Melhoria estrutural principal: migrar o AutoPilot para o pipeline assíncrono de cenas já existente, que é o caminho correto para materiais longos.

Plano de validação final
- Testar ponta a ponta: 8, 15, 25, 40 e 60 minutos
- Validar pelo menos dois cenários de voz:
  - retorno MP3
  - retorno WAV
- Conferir em cada teste:
  - palavras do roteiro
  - duração real do áudio
  - número de cenas
  - cobertura total da timeline
  - Production Pack coerente com o resultado real
