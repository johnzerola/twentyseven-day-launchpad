

# Diagnóstico Profundo V3.0 — O Que Falta, O Que Melhorar

## Estado Atual do Sistema (Números Reais)

| Base de Dados | Registros | Avaliação |
|---|---|---|
| Canais Inteligência | 709 | ✅ Bom, mas nichos desbalanceados |
| Títulos Virais | 1.384 | ✅ Sólido |
| Hook Library | 343 | ⚠️ Precisa 500+ |
| Script Knowledge | 258 | ✅ Bom |
| YouTube Knowledge | 292 | ✅ Bom |
| Scene Prompt Knowledge | 280 | ⚠️ Precisa 500+ para cobertura |
| Content DNA | 146 | ❌ FRACO — deveria ter 1000+ |
| Hook Patterns | 50 | ❌ MUITO FRACO |
| Content Models | 42 | ⚠️ Precisa expandir |
| Attention Engineering | 52 | ⚠️ Suficiente mas raso |
| Knowledge Embeddings (RAG) | 70 | ❌ CRÍTICO — precisa 1000+ para RAG funcionar |
| Prompt Library | 0 | ❌ Tabela criada mas vazia |

---

## 1. ROTEIROS — Está Usando o Melhor do Claude?

**SIM, está usando Claude Sonnet 4** como motor primário. O pipeline é:
- **Phase 0**: Hook via Claude (non-streaming, 60s de gancho)
- **Phase 1**: Rascunho completo via Claude streaming (SSE adapter)
- **Phase 2**: Refinamento (funciona)
- **Phase 3**: Avaliação dual GPT + Gemini (score mínimo 14/20)

**O que está BOM:**
- Anti-Slop Engine com 30+ frases proibidas
- 5 técnicas cinematográficas (Inner Monologue, Cliffhangers, Emotional Whiplash, Rule of Three, Chekhov's Gun)
- 14 estilos de narrativa + 13 gêneros
- Voice Profile injection (aprende voz do canal)
- Rejection learning loop (aprende com roteiros rejeitados)
- Smart Knowledge RAG no pipeline

**O que FALTA para ser impecável:**

1. **Content DNA com apenas 146 registros** — o motor de referência viral tem poucos exemplos reais. Precisa de 1000+ vídeos analisados com DNA completo para dar contexto rico ao Claude.

2. **Knowledge Embeddings com apenas 70 registros** — o RAG semântico (`smart-knowledge-retrieval`) mal funciona com tão poucos vetores. Precisa backfill massivo.

3. **Sem "Skill Tree" de roteiro** — não há sistema que detecte qual TÉCNICA específica melhorou mais os scores e priorize ela. O sistema aprende erros mas não aprende ACERTOS.

4. **Sem benchmark por nicho** — não compara "seu roteiro de true crime" com "média de roteiros de true crime que passaram no score". Falta calibração por nicho.

---

## 2. CANAIS DARK — O Sistema Sabe o Que É?

**Parcialmente.** O `channel_intelligence` tem nichos como "dark folklore" (18), "dark history" (15), "dark psychology" (1), "dark data" (1). Mas:

- **Não há definição formal de "canal dark"** no sistema — não existe flag `is_dark_channel` ou categorização Dark vs Light
- **Nichos desbalanceados**: True Crime (50), Horror (46) mas Western/Cowboy (0), Animal Survival (2), Restoration (4)
- **Os canais que você adicionou (Turquia/Polônia/Romênia)** são exatamente canais dark faceless — survival stories, old west, true crime, animal rescue — mas o sistema não os categoriza assim
- **Falta**: Taxonomia de "Dark YouTube" — canais que viralizam com storytelling sombrio/emocional sem mostrar rosto

---

## 3. PLANO DE 30 DIAS — Funciona de Verdade?

**A estrutura existe** (`Tracker30Days.tsx`, `TrackerWizard.tsx`, `generate-30day-plan`). Mas:

- ✅ Gera plano personalizado com IA (Gemini Flash)
- ✅ Tasks diárias com tipos (content/research/optimization)
- ✅ Milestones adaptativos
- ✅ Smart alerts (replique formato, estratégia abaixo da meta)
- ✅ YouTube OAuth sync para métricas reais

**O que FALTA:**
1. **Sem re-cálculo dinâmico** — se o usuário está acima/abaixo da meta no dia 10, o plano não se adapta automaticamente
2. **Sem integração com o gerador de roteiros** — o plano diz "grave 2 shorts" mas não oferece botão "Gerar Roteiro para esta Task"
3. **Sem feed de progresso visual** — calendário de 30 dias com cores (verde=feito, vermelho=atrasado) não existe
4. **Sem análise de canal pré-plano** — o plano pode ser gerado SEM conectar canal real, perdendo personalização

---

## 4. IA ANALISA PROFUNDAMENTE O CANAL?

**SIM, mas só quando acionada.** O sistema tem:
- `channel-intelligence` — análise de canal completa
- `learn-channel-voice` — aprende voz do canal (tone, ritmo, hooks)
- `extract-content-dna` — DNA de vídeos top
- `deep-scan-video` — engenharia reversa de vídeo individual
- `emulate-channel` — roadmap de emulação

**O que FALTA:**
1. **Sem análise AUTOMÁTICA periódica** — deveria re-analisar canais conectados semanalmente
2. **Sem comparação temporal** — "seu canal cresceu X% vs semana passada"
3. **Sem detecção de declínio** — alertar se views/subs caem
4. **Content DNA com 146 registros é insuficiente** para padrões estatísticos robustos

---

## 5. ACERVO DE CENAS — Está Rico?

**280 scene_prompt_knowledge** — insuficiente. Para cobrir todos os estilos visuais (13+) e nichos (20+), precisa 500-800+.

Nichos SEM templates de cena: animal_chase, western, restoration, ASMR, gaming, cooking.

---

## PLANO DE EVOLUÇÃO V3.0

### Fase 1: Enriquecimento de Dados (CRÍTICO)

**1.1 Backfill massivo de Content DNA**
- Rodar `extract-content-dna` nos top 5 vídeos de cada um dos 709 canais
- Meta: de 146 → 2000+ registros de DNA
- Impacto: roteiros 3x mais contextualizados

**1.2 Backfill de Knowledge Embeddings**
- Rodar `backfill-embeddings` em todas as tabelas de knowledge
- Meta: de 70 → 2000+ vetores
- Impacto: RAG semântico funcional (hoje é quase inútil)

**1.3 Expandir Scene Prompt Knowledge**
- Adicionar templates para nichos faltantes (western, animal, restoration, gaming, cooking)
- Meta: de 280 → 600+

**1.4 Expandir Hook Patterns**
- De 50 → 200+ com exemplos reais por nicho
- Extrair hooks dos 1384 títulos virais já existentes

### Fase 2: Inteligência de Roteiro (ALTO IMPACTO)

**2.1 Skill Scoring — Aprender ACERTOS**
- Quando roteiro passa no score dual (14+/20), salvar as técnicas que contribuíram
- Criar tabela `script_skill_scores` com: técnica, nicho, score_contribution, frequency
- Usar no próximo roteiro: "técnicas que mais funcionam para TRUE CRIME: Inner Monologue (9.2/10), Chekhov's Gun (8.8/10)"

**2.2 Benchmark por Nicho**
- Calcular média de scores por nicho/estilo
- Mostrar ao Claude: "média true crime = 15.2/20, seu mínimo é 15"

**2.3 Dark Channel Taxonomy**
- Adicionar flag `content_category` em channel_intelligence: 'dark_storytelling', 'educational', 'entertainment', 'restoration', 'animal'
- Definição de "canal dark": faceless + narração + storytelling emocional/sombrio + sem rosto

### Fase 3: Tracker 30 Dias Inteligente

**3.1 Plano Adaptativo**
- Edge function `adapt-30day-plan` que re-calcula metas baseado no progresso real
- Se dia 10 está 50% acima da meta → escalar; se 50% abaixo → ajustar tarefas

**3.2 Botão "Produzir" nas Tasks**
- Cada task de conteúdo → botão direto para ScriptGenerator com tópico pre-preenchido

**3.3 Calendário Visual**
- Grid 30 dias com cores (verde/amarelo/vermelho) por status de tasks

### Fase 4: Análise Profunda Automatizada

**4.1 Re-scan Semanal de Canais Conectados**
- Cron que re-analisa canais do usuário via `channel-intelligence`
- Detecta mudanças: views caindo, novo padrão viral, oportunidade

**4.2 Alerta de Declínio**
- Comparar métricas semana a semana
- Notificar: "Views caíram 30% esta semana. Possível causa: mudança de algoritmo / frequência de upload"

---

## Detalhes Técnicos

### Arquivos a Modificar/Criar
1. **Nova migration SQL**: tabela `script_skill_scores` + coluna `content_category` em `channel_intelligence`
2. **Nova edge function**: `adapt-30day-plan` (re-cálculo dinâmico)
3. **Modificar**: `supabase/functions/backfill-embeddings/index.ts` — trigger massivo
4. **Modificar**: `src/pages/Tracker30Days.tsx` — calendário visual + botão produzir
5. **Modificar**: `supabase/functions/generate-script/index.ts` — injetar skill scores
6. **Novo**: `supabase/functions/weekly-channel-rescan/index.ts`

### Prioridade de Execução
| # | Ação | Impacto |
|---|------|---------|
| 1 | Backfill embeddings (70→2000+) | CRÍTICO — RAG não funciona sem isso |
| 2 | Backfill Content DNA (146→2000+) | ALTO — roteiros sem referência real |
| 3 | Expandir hook_patterns (50→200+) | ALTO — hooks repetitivos |
| 4 | Skill scoring (aprender acertos) | ALTO — evolução contínua |
| 5 | Tracker adaptativo + calendário | MÉDIO — UX profissional |
| 6 | Dark channel taxonomy | MÉDIO — categorização |
| 7 | Re-scan semanal automatizado | MÉDIO — inteligência contínua |

