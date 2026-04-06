

# Plano: Absorver Documento "Viral Engine Master" no Sistema

## Análise do Gap

Após revisar exaustivamente o código, **~70% do documento já está implementado** no `generate-script`, `generate-titles`, `score-script` e `video-production-training.ts`. O que falta ou pode ser reforçado:

### Gaps Identificados

1. **Sound Design / BPM Engine** -- O documento exige sugestões de BPM por nicho e tags de SFX no roteiro (`[ÁUDIO: Drone sub-bass]`, `[TRILHA: Synthwave 120 BPM]`). O sistema atual NÃO injeta diretrizes de Sound Design no prompt de geração de roteiros.

2. **Tags de Edição VFX no Roteiro** -- O documento exige `[J-CUT]`, `[BLENDER: parallax]`, `[AFTER EFFECTS: zoom-in]`, `[CORTAR MÚSICA 1.5s]` embutidas no roteiro. O sistema atual tem "marcadores de edição" conceituais mas não injeta uma diretriz explícita de tags VFX.

3. **Thumbnail: Regra dos 3 Elementos + Pós-Produção VFX** -- O `generate-thumbnail-prompt` é genérico. Falta injetar as regras de composição (3 elementos, cores complementares, Drop Shadow, Optical Glow, Motion Blur) e instruções de pós-produção.

4. **Narrator Archetypes (Personas)** -- O documento define 3 arquétipos (Investigador, Sábio/Avô, Hacker de Informação). O sistema tem `styleGuides` mas não tem personas narrativas como conceito separado.

5. **Binge Loop CTA** -- O documento proíbe "Obrigado por assistir" e exige que o final seja o gancho do próximo vídeo. O sistema tem CTAs mas não tem a mecânica de Binge Loop explícita.

6. **Título: 10 Fórmulas Matemáticas** -- O `viralDatabase.ts` tem 12 padrões. O documento traz 5 fórmulas adicionais (Segredo Oculto, Erro Fatal, Contraste Absurdo, Desafio do Tempo, Arquivos Não Revelados).

7. **Estratégia das 48 Horas** -- Reviver vídeos com novos títulos/thumbnails ao 3º dia. Não existe no sistema.

## Plano de Implementação

### Arquivo 1: `src/lib/viralDatabase.ts`
- Adicionar **5 novos title patterns** do documento (Segredo Oculto, Erro Fatal, etc.)
- Adicionar **5 novos hooks** com estilo "contraintuitivo" e "arquivo oculto"
- Adicionar **CTAs tipo Binge Loop** (final → próximo vídeo)
- Adicionar nova interface `NarratorArchetype` e constante `NARRATOR_ARCHETYPES` com os 3 arquétipos
- Adicionar nova interface `SoundDesignProfile` e constante `SOUND_DESIGN_PROFILES` com BPM/SFX por nicho
- Adicionar nova constante `VFX_EDIT_TAGS` com as tags de edição do documento

### Arquivo 2: `supabase/functions/generate-script/index.ts`
- Injetar novo bloco `SOUND_DESIGN_DIRECTIVE` no system prompt com mapeamento BPM por nicho/estilo e instrução para inserir tags `[ÁUDIO:]` e `[TRILHA:]`
- Injetar novo bloco `VFX_EDIT_TAGS_DIRECTIVE` instruindo a IA a embutir `[J-CUT]`, `[BLENDER:]`, `[AFTER EFFECTS:]`, `[CORTAR MÚSICA]` no roteiro
- Adicionar `NARRATOR_ARCHETYPES` map e injetar a persona correta baseada no estilo/nicho
- Reforçar a regra de **Binge Loop** no final do roteiro (proibir "obrigado por assistir")
- Adicionar a regra **Mas/Portanto** explicitamente (proibir "E" e "Então" como conectores)

### Arquivo 3: `supabase/functions/generate-thumbnail-prompt/index.ts`
- Injetar as regras de composição do documento no system prompt: Regra dos 3 Elementos, cores complementares, instruções de pós-produção (Drop Shadow, Optical Glow, Radial Blur, Curves)
- Adicionar campo `post_production_instructions` na resposta da IA
- Reforçar que thumbnails não descrevem o vídeo — criam mistério

### Arquivo 4: `supabase/functions/generate-titles/index.ts`
- Injetar as 5 fórmulas matemáticas do documento no prompt de geração
- Adicionar regras: max 50 chars, palavras de poder, nunca entregar a resposta no título
- Reforçar Information Gap Theory no system prompt

### Arquivo 5: `supabase/functions/score-script/index.ts`
- Adicionar critérios de avaliação: Sound Design tags presentes? VFX tags presentes? Binge Loop no final? Regra Mas/Portanto respeitada?

### Arquivo 6: `supabase/functions/next-best-action/index.ts`
- Injetar a "Estratégia das 48 Horas" -- se um vídeo tem 3+ dias e CTR baixo, a ação recomendada deve ser trocar título/thumbnail

## Detalhes Técnicos

- Nenhuma mudança de banco de dados necessária -- tudo é injetado via prompts e constantes client-side
- 6 arquivos editados (2 client-side, 4 edge functions)
- Edge functions precisam ser redeployadas após edição
- Impacto zero em funcionalidades existentes -- são adições aos prompts

