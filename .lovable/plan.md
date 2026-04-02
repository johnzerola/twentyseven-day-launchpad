

# Plano de Evolução: Motor de Monetização Acelerada

## Diagnóstico Confirmado

Auditei cada ponto mencionado e todos os bugs/gaps se confirmam no código. O sistema tem inteligência de sobra mas falta **coesão decisória** e **empacotamento integrado**.

---

## Fase 1 — Correção de Bugs Críticos (imediato)

### 1.1 score-script: Bug de inflação de métricas
**Arquivo:** `supabase/functions/score-script/index.ts` (linhas 346-384)
- O upsert insere `times_used: 1` e depois faz fetch + soma +1 novamente → inflação dupla
- `best_score` compara com `total_score_contribution` em vez de `best_score`
- **Fix:** Usar uma única operação: upsert com `ON CONFLICT` e cálculo incremental correto em SQL (ou remover o fetch+update redundante)

### 1.2 Content DNA Score: Drift de contrato
**Arquivo:** `src/components/scripts/ScriptGenerator.tsx` (linhas 1148-1153)
- UI espera `scores.overall_grade`, `scores.viral_score`, `scores.hook_score`
- score-script retorna `combinedScore`, `gpt_score`, `gemini_score`, `approved`
- **Fix:** Alinhar o handler do botão "Score com Content DNA" ao contrato real do endpoint

### 1.3 Shorts: Contexto incompleto
**Arquivo:** `src/components/scripts/ScriptGenerator.tsx` (linhas 310-312)
- `generate-script-short` não recebe `channelKnowledge`, `referenceScript`, nem `rejectionFeedback`
- **Fix:** Passar os mesmos campos que longform já recebe

### 1.4 adapt-30day-plan: Sem verificação de auth
**Arquivo:** `supabase/functions/adapt-30day-plan/index.ts` (linhas 13-22)
- Usa service role sem verificar que o `userId` corresponde ao caller
- **Fix:** Adicionar validação de JWT do usuário antes de modificar dados

### 1.5 generate-30day-plan: Viés de Shorts
**Arquivo:** `supabase/functions/generate-30day-plan/index.ts` (linhas 30-38)
- Filtra `youtube_knowledge` por `shorts-monetization` mesmo para estratégia longform
- **Fix:** Filtrar por categoria dinâmica baseada em `strategy`

---

## Fase 2 — Entidade Central: `content_thesis` (fundação)

Nova tabela que conecta o ciclo inteiro: ideia → script → título → thumb → vídeo → resultado.

```text
content_thesis
├── id, user_id, channel_id
├── thesis_text (a tese central do vídeo)
├── niche, angle, format (short/long/both)
├── evidence_json (fontes, refs, breakout videos)
├── originality_notes, source_notes, packaging_notes
├── confidence_score, freshness_score
├── saturation_risk, originality_risk
├── why_now, expires_at
├── status (draft → scripted → packaged → published → measured)
├── script_id → saved_scripts
├── title_ids → saved_titles  
├── thumbnail_prompt_id
├── video_project_id → video_projects
├── youtube_video_id (quando publicado)
├── actual_views, actual_ctr, actual_retention
├── monetization_result_json
├── created_at, updated_at
```

Todas as etapas do pipeline passam a vincular-se a esta entidade, criando rastreabilidade completa.

---

## Fase 3 — Dotti: Saída Estruturada

### 3.1 Expandir `dotti_suggestions`
Adicionar campos estruturados à tabela:
- `suggestion_type` (tema, estratégia, otimização, urgência)
- `format` (short/long/both)
- `confidence`, `freshness_score`
- `monetization_angle`, `production_effort`
- `originality_risk`, `evidence_json`
- `why_now`, `expires_at`
- `content_thesis_id` (link para a entidade central)

### 3.2 Melhorar passagem Dotti → Roteiro
Em vez de pegar só a primeira linha (`sessionStorage`), salvar a sugestão completa e passar o `content_thesis_id` para o gerador de roteiro, que busca todos os dados estruturados.

---

## Fase 4 — Packaging Lab

Novo componente e endpoint que avaliam o **conjunto** como unidade:

```text
Packaging Score = f(título, thumbnail, hook_30s, niche_fit, promise_delivery)
```

### 4.1 Edge Function: `packaging-score`
- Recebe: título, prompt de thumb (ou imagem), primeiros 30s do roteiro, nicho
- Retorna: score composto (0-100), breakdown por dimensão, sugestões de melhoria
- Avalia: contraste título↔thumb, promessa↔entrega, fit de tráfego (browse/search/suggested)

### 4.2 Componente: `PackagingLab.tsx`
- Interface unificada onde o usuário vê título + thumb + hook lado a lado
- Score visual em tempo real
- Simulação de thumbnail em tamanho pequeno (como aparece no feed)
- CTR estimado por par título+thumb (calibrado, não "duro")

---

## Fase 5 — Originality & Safety Engine

Score de primeira classe para canais faceless/dark:

### 5.1 Edge Function: `originality-safety-score`
5 dimensões:
- **Originalidade**: o que este vídeo traz que concorrentes não trazem
- **Proveniência**: fontes verificáveis dos fatos centrais
- **Risco de repetição**: similaridade com conteúdo já saturado no nicho
- **Risco editorial**: temas sensíveis, claims não verificáveis
- **Risco de asset**: vozes/imagens genéricas, stock detectável

### 5.2 Integração no pipeline
- Obrigatório antes de "Aprovar" roteiro para canais marcados como faceless
- Score aparece no scorecard junto com o score de roteiro existente
- Bloqueio suave (warning) se score < 40

---

## Fase 6 — Decision Engine (fonte única de verdade)

### 6.1 Edge Function: `next-best-action`
Motor que sintetiza TODOS os scores e diz exatamente o que fazer:

```text
Input: user_id, channel_id
Output: {
  action: "Publicar tema X amanhã",
  format: "short",
  title_suggestion: "...",
  thumb_direction: "...",
  hook_strategy: "...",
  why: "Tema trending + nicho low-saturation + seu canal performa 2x em curiosidade",
  risk: "medium",
  expected_views: "5k-15k",
  monetization_impact: "+12h watch time estimado",
  sources: [...]
}
```

Consulta: content_thesis pendentes, packaging scores, originality scores, channel performance, niche velocity, trending topics.

### 6.2 Dashboard widget
Card proeminente no Dashboard: "Sua próxima melhor jogada" — com botão para iniciar produção direto.

---

## Fase 7 — Frescor Real em Temas

Alinhar `suggest-themes` com o mesmo nível de dados em tempo real que `generate-titles` já usa:
- Últimos breakout videos do nicho (via `emerging_videos`)
- Trending do YouTube/Brave
- Velocidade e saturação do tema
- Cada tema retorna: `viral_likelihood`, `why_now`, `saturation`, `effort_score`, `originality_risk`, `best_format`

---

## Fase 8 — MonetizaScore V2

Substituir os 4 pesos fixos (25% cada) por 5 scores contextuais:

| Score | Peso varia por estratégia |
|-------|--------------------------|
| YPP Speed | Alto em shorts-sprint |
| Revenue Quality | Alto em longform-first |
| Originality/Safety | Sempre alto para faceless |
| Packaging Strength | Sempre alto |
| Operational Feasibility | Alto para canais novos |

Thresholds e regras movem para tabela `validation_config` com `source`, `confidence`, `last_verified_at`.

---

## Ordem de Implementação Sugerida

1. **Fase 1** — Bugs (1-2 sessões) — impacto imediato na confiabilidade
2. **Fase 2** — `content_thesis` (1 sessão) — fundação para tudo que vem depois
3. **Fase 3** — Dotti estruturado (1 sessão) — melhora a entrada do pipeline
4. **Fase 4** — Packaging Lab (1-2 sessões) — maior impacto em monetização
5. **Fase 5** — Originality Engine (1 sessão) — crítico para dark/faceless
6. **Fase 6** — Decision Engine (1-2 sessões) — a "fonte única de verdade"
7. **Fase 7** — Frescor em temas (1 sessão)
8. **Fase 8** — MonetizaScore V2 (1 sessão)

