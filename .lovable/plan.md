

# Auditoria Completa do Sistema Monetiza27 — Diálogo de 3 Personalidades

---

## 🎯 PERSONA 1: Ex-CEO do YouTube (Ricardo) — Estrategista de Monetização

**"Analisei cada tela, cada edge function, cada tabela. Aqui está meu diagnóstico:"**

### Problema Crítico #1: PERSISTÊNCIA — 90% dos dados some ao navegar

As seguintes telas perdem TUDO quando o usuário sai:

| Tela | O que some | Solução |
|------|-----------|---------|
| **Niche Explorer** | Análise completa, score, canais, trending | Salvar em nova tabela `saved_niche_analyses` |
| **Titles** | Títulos gerados, A/B tests, descrições SEO | Salvar em nova tabela `saved_titles` |
| **ChannelSearch (DubSpy)** | Resultados de busca, deep scans, emergentes | Salvar em nova tabela `saved_searches` |
| **Branding** | Brand Kit gerado, logo, paleta | Já salva em `generated_branding` ✅ |
| **Scripts** | Roteiro, personagens, prompts sincronizados | Roteiro salva em `saved_scripts` ✅, mas personagens/prompts NÃO persistem |
| **Studio** | Segments, áudios, vídeos gerados | Parcial via `video_projects`/`scenes`, mas state local se perde |
| **MonetizationPlanner** | Chat e plano de ação gerado | NÃO salva — perde tudo |
| **Narration** | Áudio gerado | NÃO salva |

### Problema #2: `niche_database` está VAZIO (0 registros)

O Niche Explorer depende desta tabela para validação, mas ela tem zero dados. Isso significa que o fallback é 100% IA sem referência local.

### O que funciona bem:
- `channel_intelligence`: 653 canais ✅ (excelente base)
- `youtube_knowledge`: 46 registros ✅
- `script_knowledge`: 47 registros ✅ 
- `scene_prompt_knowledge`: 57 registros ✅
- Pipeline dual-AI (GPT-5 → Gemini Pro) para scripts ✅
- Playbook de 27 dias com persistência ✅
- Canais com auto-análise ✅
- Concorrentes reais via YouTube API ✅

---

## 🛠️ PERSONA 2: Engenheiro Senior ex-Google (André) — Arquiteto do Sistema

**"Do ponto de vista de engenharia, identifiquei 7 problemas e 5 melhorias:"**

### Problemas Técnicos:

1. **Persistência zero nas telas-chave**: Estado é `useState` puro — ao desmontar o componente, morre. Precisa de tabelas dedicadas + `useEffect` para carregar dados salvos.

2. **`niche_database` vazia**: A tabela existe mas nunca foi populada. Precisa de seed data ou migração.

3. **Narration page isolada**: Não está no router! (`/narration` não existe no App.tsx). A narração funciona dentro do Studio, mas a página standalone `/narration` não é acessível — embora o componente exista.

4. **MonetizationPlanner**: Chat streaming funciona, mas o plano de ação gerado (`ActionPlan`) fica em state local e se perde. Deveria persistir em `onboarding_plans` ou tabela própria.

5. **Scripts page — personagens não persistem entre sessões**: Characters ficam em `useState`. Se o usuário sai e volta, perde todos os personagens criados e imagens geradas. Deveria usar a tabela `characters` existente.

6. **Studio page — segments em state local**: Embora `video_projects`, `scenes` e `video_segments` existam, o Studio não carrega projetos salvos ao montar. O usuário precisa reprocessar tudo do zero.

7. **RLS correto em todas as tabelas** ✅ — nenhuma vulnerabilidade encontrada.

### Backend — Edge Functions:

| Function | Status | Nota |
|----------|--------|------|
| `generate-script` | ✅ Robusto | Dual-AI pipeline, knowledge bases integradas |
| `generate-synced-prompts` | ✅ Excelente | Veo3 otimizado, character sheets, scene knowledge |
| `generate-veo3-prompts` | ✅ Bom | Anti-text enforcement, lens/lighting specs |
| `find-competitors` | ✅ Funcional | YouTube API real, keyword extraction, growth calc |
| `suggest-themes` | ✅ Bom | Channel intelligence + youtube knowledge |
| `chat-assistant` | ✅ Funcional | Streaming SSE |
| `analyze-channel` | ✅ | Analisa SEO, estratégia, top vídeos |
| `niche-explorer` | ✅ | Dados reais YouTube API |
| `elevenlabs-tts` | ✅ | Conector configurado |

### Melhorias Propostas (Banco de Dados):

1. **Nova tabela `saved_niche_analyses`** — persiste resultados do Niche Explorer
2. **Nova tabela `saved_titles`** — persiste títulos, A/B tests, descrições SEO
3. **Nova tabela `monetization_plans`** — persiste planos e chat do Monetization Planner
4. **Popular `niche_database`** com seed data (20+ nichos com RPM, dificuldade, saturação)
5. **Adicionar rota `/narration`** ao App.tsx (já existe o componente)

---

## 🎬 PERSONA 3: Roteirista Senior (Carlos) — Especialista em Conteúdo Viral

**"Avaliei o gerador de roteiros e o sistema de prompts Veo3. Aqui está meu veredicto:"**

### Gerador de Roteiros (generate-script):

**NOTA: 8.5/10** — Muito sólido.

**Pontos fortes:**
- Pipeline dual-AI (GPT-5 rascunho → Gemini Pro revisão) é genial
- 9 estilos de roteiro bem definidos (dopaminérgico, cinematográfico, MrBeast, narração, etc.)
- Integra 3 knowledge bases reais (youtube_knowledge, script_knowledge, channel_intelligence)
- Scorecard de qualidade (Hook, Retention, Emotion, Flow, Payoff)
- Cálculo de speech rate por idioma
- Viral context injection (hooks, CTAs, estruturas do Viral DB)

**Melhorias sugeridas:**
- Adicionar mais estilos: **Reddit Stories**, **Animação 2D/3D narrativa**, **Conspiracy/Mystery POV**
- O prompt do Phase 2 (Gemini) poderia incluir exemplos de hooks virais dos `channel_intelligence` como referência concreta
- Adicionar suporte a roteiros multi-parte (Parte 1, 2, 3)

### Sistema de Prompts Veo3 (generate-synced-prompts + generate-veo3-prompts):

**NOTA: 9/10** — Excelente, nível profissional.

**O que está certo:**
- Fórmula de 5 partes: [Cinematography] + [Subject] + [Action] + [Context] + [Style]
- Anti-text enforcement rigoroso (no subtitles, no logos, etc.)
- 10 estilos visuais diferentes (cinematográfico, 2D, 3D, anime, wojak, dark, etc.)
- Character sheets completos com referência de imagem
- Dynamic scene duration (5-8s)
- Lens specs, lighting setups, audio direction
- Scene knowledge base de 57 registros integrada
- Referências a diretores reais (Roger Deakins, Bradford Young)

**O que falta para ser 10/10:**
- Adicionar à scene_prompt_knowledge: templates específicos para **primeiros 3 segundos** (o hook visual) — cenas com embers, dust particles, dramatic reveal, extreme close-up com rack focus
- Adicionar mais exemplos de **transições cinematográficas** entre cenas
- O `negativePrompt` poderia ser mais agressivo contra artefatos de IA (6 fingers, melted hands)

### Viral Database (channel_intelligence):

**653 canais** é uma base sólida. Os dados incluem `viral_patterns`, `visual_style_notes`, `top_videos` — tudo que o sistema precisa para gerar roteiros e sugestões contextualizadas.

---

## 📋 PLANO DE IMPLEMENTAÇÃO (Priorizado)

### Fase 1: Persistência (Problema mais grave — afeta 90% do sistema)

1. **Criar 3 novas tabelas** com RLS:
   - `saved_niche_analyses` (user_id, niche, country, analysis_json, score, created_at)
   - `saved_titles` (user_id, topic, niche, titles_json, ab_test_json, seo_json, created_at)
   - `monetization_plans` (user_id, plan_json, chat_history, created_at)

2. **Modificar páginas** para carregar dados salvos ao montar e salvar ao gerar:
   - `NicheExplorer.tsx` — load last analysis, auto-save results
   - `Titles.tsx` — load saved titles, save on generate
   - `MonetizationPlanner.tsx` — persist plans and chat
   - `Scripts.tsx` — persist characters usando tabela `characters` existente

3. **Popular `niche_database`** com 30+ nichos reais

4. **Adicionar rota `/narration`** ao App.tsx

### Fase 2: Melhorias de Qualidade

5. **Enriquecer scene_prompt_knowledge** com templates para hooks visuais (primeiros 3s)
6. **Melhorar negativePrompt** do Veo3 com anti-artefatos IA
7. **Scripts page**: carregar personagens da tabela `characters` ao abrir um projeto existente

### Estimativa: ~2-3 mensagens de implementação para Fase 1

