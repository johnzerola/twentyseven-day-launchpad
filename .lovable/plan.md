

# V2 — Monetiza27: O Salto para Plataforma Profissional

## Diagnóstico Atual (CEO Board Review)

### O que já funciona bem
- Script Engine com Dual-AI (GPT-5 + Gemini Pro) e scorecard
- Revenue Simulator com dados reais de RPM/país
- DubSpy com Deep Scan e clusters
- Prompts Veo 3 com qualidade Netflix/Disney
- Knowledge DBs (youtube: 15, script: 15, scene: 27 registros)

### O que falta para V2 — 12 gaps críticos

---

## 1. KNOWLEDGE DATABASES — Escala Insuficiente

**Problema**: 15 registros em youtube_knowledge e script_knowledge é muito pouco. Plataformas sérias têm centenas.

**Ação**: Expandir massivamente:
- `youtube_knowledge`: de 15 → 80+ registros (algoritmo 2025-2026, formatos de retenção por nicho, timing de upload por país/fuso, estratégias de Shorts vinculados, community posts, SEO avançado, monetização alternativa)
- `script_knowledge`: de 15 → 60+ registros (hooks por nicho, cold opens, técnicas de cliffhanger, estruturas para documentários 40min, listicles, tutorials, scripts de Shorts)
- `scene_prompt_knowledge`: de 27 → 80+ registros (composições por gênero: horror, finanças, motivacional, etc; transições cinematográficas, paletas de cor por mood)

---

## 2. DASHBOARD — Estático e Inútil

**Problema**: O Dashboard tem dados hardcoded (dia 5, tasks fixas, RPM fixo). Não reflete o progresso real do usuário.

**Ação**: Dashboard dinâmico que puxa dados reais:
- Total de roteiros criados, canais rastreados, vídeos em produção (do DB)
- Progresso real do Workflow (da tabela `user_progress`)
- Últimas atividades (últimos scripts, últimas análises)
- Quick actions: "Continuar roteiro", "Nova análise de nicho", "Gerar títulos"
- Remover os PHASES/DAILY_TASKS hardcoded do plano de 27 dias (já foi descontinuado)

---

## 3. A/B TITLE TESTER — Ferramenta que Nenhum Concorrente Tem

**Problema**: O gerador de títulos gera títulos mas não compara com dados reais.

**Ação**: Nova funcionalidade no Títulos Virais:
- Coloca 2 títulos lado a lado
- IA analisa CTR estimado, emotional triggers, SEO score, comprimento ideal
- Mostra qual ganharia num cenário real baseado em dados do `youtube_knowledge`
- Integrar com YouTube API para buscar títulos reais de vídeos trending no mesmo nicho como benchmark

---

## 4. THUMBNAIL ANALYZER — Falta Inteligência Visual

**Problema**: O Thumbnail Lab no Growth Center gera conceitos texto, mas não analisa thumbnails reais nem gera imagens.

**Ação**: Adicionar análise de thumbnail por IA:
- Upload de thumbnail → IA (Gemini Pro com visão) analisa: contraste, texto legível, face expression, composição, CTR score
- Gera sugestões de melhoria específicas
- Compara com thumbnails de vídeos virais do mesmo nicho
- Edge function nova: `analyze-thumbnail`

---

## 5. TRENDING TOPICS FEED — Saber o que Postar AGORA

**Problema**: Não existe nenhuma ferramenta que mostre o que está em alta AGORA no YouTube para o nicho do usuário.

**Ação**: Nova seção no Dashboard ou página dedicada:
- Edge function `trending-topics` que usa YouTube API para buscar trending videos por região
- Filtra por nicho do usuário
- Mostra: título, views/hora, canal, thumbnail
- Botão "Criar roteiro sobre isso" que leva direto para Scripts com o topic preenchido
- Atualiza a cada visita (cache de 1h)

---

## 6. SCRIPT TEMPLATES LIBRARY — Roteiros Pré-Prontos

**Problema**: O usuário sempre começa do zero. Não há templates prontos para acelerar.

**Ação**: Biblioteca de templates no Script Engine:
- 15-20 templates por formato: Documentário, Listicle, Tutorial, Horror Story, Motivacional, True Crime, Explicativo
- Cada template tem estrutura completa com placeholders: [HOOK], [PROBLEMA], [SOLUÇÃO], [CTA]
- Usuário seleciona template → preenche variáveis → IA expande para roteiro completo
- Armazenados na tabela `script_knowledge` com category = 'template'

---

## 7. COMPETITOR WATCH — Monitoramento Automático

**Problema**: O DubSpy analisa uma vez. Não monitora mudanças ao longo do tempo.

**Ação**: Usar a tabela `tracked_channels` (já existe) de forma mais inteligente:
- Na página Meus Canais, mostrar delta de subscribers/views desde o último check
- Alertas visuais: "Canal X ganhou 50K subs esta semana — veja o que ele postou"
- Botão "Analisar último vídeo" que faz Deep Scan do vídeo mais recente
- Histórico de crescimento do canal trackeado

---

## 8. EXPORT SYSTEM — Exportar Tudo

**Problema**: Não há como exportar roteiros, planos ou análises.

**Ação**: Sistema de export unificado:
- Roteiros → Markdown, TXT, PDF (via client-side)
- Brand Kit → PNG/SVG do mockup
- Análise de nicho → PDF report
- Usar `jsPDF` ou gerar via canvas + download

---

## 9. WORKFLOW — Links Quebrados

**Problema**: Workflow referencia `/narration` e `/studio` que foram removidos.

**Ação**: Atualizar STEPS_TEMPLATE para refletir as rotas atuais:
- Remover steps de Narração e Studio
- Ajustar para: Nicho → Roteiro → Títulos → Prompts Visuais → Publicação
- Cada step com links corretos

---

## 10. ONBOARDING → DASHBOARD FLOW

**Problema**: O onboarding gera um plano mas o Dashboard não usa esses dados.

**Ação**: Dashboard deve ler o `onboarding_plans` do usuário e mostrar:
- Nicho escolhido, meta de ganhos, tipo de conteúdo
- Próximos passos do plano gerado
- Progresso vs plano original

---

## 11. SEO DESCRIPTION GENERATOR

**Problema**: Não existe gerador de descrição SEO para vídeos YouTube.

**Ação**: Adicionar ao módulo de Títulos Virais:
- Input: título do vídeo + nicho
- Output: descrição otimizada com timestamps, keywords, links, hashtags
- Edge function: expandir `generate-titles` para incluir tipo 'description'

---

## 12. MOBILE RESPONSIVENESS

**Problema**: Sidebar não funciona bem em mobile, vários módulos não são responsivos.

**Ação**: Review geral de responsividade em todos os módulos.

---

## Prioridade de Execução (por impacto)

| # | Item | Impacto | Esforço |
|---|------|---------|---------|
| 1 | Knowledge DBs expand | Alto | Médio |
| 2 | Dashboard dinâmico | Alto | Médio |
| 3 | Workflow fix (links quebrados) | Alto | Baixo |
| 4 | Trending Topics Feed | Alto | Médio |
| 5 | A/B Title Tester | Alto | Médio |
| 6 | Script Templates | Médio | Médio |
| 7 | SEO Description Generator | Médio | Baixo |
| 8 | Thumbnail Analyzer | Médio | Alto |
| 9 | Export System | Médio | Médio |
| 10 | Competitor Watch deltas | Médio | Médio |
| 11 | Onboarding → Dashboard | Médio | Baixo |
| 12 | Mobile responsive | Baixo | Médio |

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| Knowledge DB (SQL inserts) | +120 registros novos |
| `src/pages/Dashboard.tsx` | Reescrever com dados dinâmicos |
| `src/pages/Workflow.tsx` | Fix rotas quebradas |
| `src/pages/Titles.tsx` | A/B tester + SEO description |
| `src/pages/Scripts.tsx` | Templates library |
| `src/pages/ChannelSearch.tsx` | Trending topics integration |
| `supabase/functions/generate-titles/index.ts` | Suporte a A/B test + description |
| Nova edge function: `trending-topics` | YouTube API trending |
| Nova edge function: `analyze-thumbnail` | Gemini Vision analysis |

