

# Plano: Upgrade Completo do Script Engine + Knowledge Databases + Sincronização Avançada

## Problemas Identificados

1. **Dual-AI**: Ambas as fases usam o mesmo modelo (Gemini Pro). A Phase 2 recebe o rascunho e reescreve, mas como é o mesmo "cérebro", o resultado pode ser circular. Usar modelos diferentes (GPT-5 cria, Gemini Pro revisa) dá perspectivas complementares.
2. **Roteiro não editável**: O script é renderizado como Markdown read-only. Não há textarea para edição manual ou colar roteiro próprio.
3. **Estilo visual não passa como referência**: O `generate-synced-prompts` recebe `videoStyle` mas as imagens de referência dos personagens (`imageUrl`) nunca são enviadas para a geração de vídeo.
4. **Sincronização fixa**: Todas as cenas têm duração igual (5s, 8s, etc). Não analisa o conteúdo do áudio para ajustar duração por cena.
5. **Sem knowledge databases**: Toda a "expertise" vive hardcoded nos prompts das edge functions. Não há banco de dados persistente de conhecimento.
6. **Primeiros segundos fracos**: O sistema não prioriza os primeiros 10s com tratamento especial.

---

## Mudanças Planejadas

### 1. Dual-AI com Modelos Diferentes
**Edge function `generate-script`**:
- Phase 1 (Criação): `openai/gpt-5` — forte em narrativa criativa, storytelling emocional
- Phase 2 (Aprovação/Reescrita): `google/gemini-2.5-pro` — forte em análise crítica e refinamento
- Phase 2 recebe critérios de scoring (hook_score, retention_score, emotion_score) e só aprova se score > 8/10, senão reescreve as partes fracas
- Adicionar um "scorecard" retornado ao frontend mostrando as notas do roteiro

### 2. Roteiro Editável + Import Manual
**Frontend `Scripts.tsx`**:
- Substituir o ReactMarkdown read-only por um toggle: "Modo Leitura" (Markdown) / "Modo Edição" (textarea)
- Botão "Colar meu roteiro" que abre textarea vazia para o usuário colar texto próprio
- O roteiro editado é usado nas próximas etapas (personagens, prompts)

### 3. Knowledge Databases (3 tabelas novas)
Criar via migration:

```text
youtube_knowledge       — Regras do algoritmo, retenção, CTR, monetização
├── id, category, title, content, tags[], source, priority
script_knowledge        — Técnicas de roteiro, hooks, estruturas narrativas  
├── id, category, title, content, examples[], effectiveness_score
scene_prompt_knowledge  — Prompts virais, composições, técnicas cinematográficas
├── id, category, title, prompt_template, tags[], viral_score
```

Pré-popular com ~50 registros cada contendo:
- **YouTube**: Regras dos primeiros 30s, algoritmo 2025-2026, RPM por nicho, formatos de retenção
- **Roteiro**: Hooks por tipo (choque, curiosidade, storytelling), estruturas (jornada do herói, in medias res, bola de neve), técnicas de open loop
- **Cenas**: Templates de prompts por estilo, composições cinematográficas, paletas de cor por mood, técnicas anti-AI

Essas tabelas são injetadas nos prompts das edge functions para que a IA tenha "memória institucional".

### 4. Sincronização Inteligente com Áudio
**Edge function `generate-synced-prompts`**:
- Analisar o texto de cada cena: cenas com mais conteúdo emocional/descritivo → duração maior (10-15s). Cenas de transição rápida → 5s
- A IA decide a duração ideal por cena (entre 5s e 15s) baseada no que está sendo narrado
- Adicionar campo `sceneDurationSeconds` no output de cada cena
- Os primeiros 10 segundos recebem tratamento especial: "HOOK SCENE — must be the most visually striking, impossible-to-ignore image"

### 5. Referência Visual nos Prompts
- Quando personagens têm `imageUrl` (imagem de referência gerada), incluir essa URL no prompt como "reference image" para manter consistência
- No export AutoFlow "Ingredients", mapear as imagens de referência dos personagens

### 6. Primeiros 10 Segundos como Prioridade
- Script: Instruções reforçadas para hook nos primeiros 10s com dados do `youtube_knowledge`
- Prompts visuais: Cena 1 recebe boost de qualidade ("ultra-premium, award-winning opening shot, maximum visual impact")
- Scoring separado para o hook exibido no frontend

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-script/index.ts` | Phase 1 → GPT-5, Phase 2 → Gemini Pro com scoring, injetar knowledge DB |
| `supabase/functions/generate-synced-prompts/index.ts` | Duração dinâmica por cena, boost na cena 1, referências de imagem |
| `src/pages/Scripts.tsx` | Modo edição, import manual, scorecard, duração variável nas cenas |
| `src/lib/viralDatabase.ts` | Expandir com mais hooks, CTAs e estruturas |
| Migration SQL | 3 tabelas de knowledge + seed data |

---

## Ordem de Execução

1. Criar as 3 tabelas de knowledge + seed data (migration)
2. Atualizar `generate-script` com dual-model + knowledge injection + scoring
3. Atualizar `generate-synced-prompts` com duração dinâmica + hook boost + ref images
4. Atualizar `Scripts.tsx` com modo edição, import, scorecard, cenas com duração variável

