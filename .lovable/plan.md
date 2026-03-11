

# Fase 2 — Plano de Implementação

## A. Niche Explorer com IA Profunda

**Estado atual**: Já usa YouTube API + Gemini para análise. Retorna channels, trending, radar metrics, competitor insights.

**Melhorias**:
1. **Consultar `channel_intelligence`** antes da análise — usar os 650+ canais do banco para enriquecer o contexto da IA com padrões reais do nicho
2. **Consultar `niche_database`** para dados de RPM/saturação reais em vez de depender apenas do `RPM_BY_COUNTRY` hardcoded
3. **Adicionar "Concorrentes Diretos"** na resposta — top 5 canais do `channel_intelligence` que operam no mesmo nicho+país, com link para modelar
4. **Botão "Salvar como Projeto"** — redireciona para Workflow criando um projeto com nicho pré-configurado

**Arquivos**: `supabase/functions/niche-explorer/index.ts`, `src/pages/NicheExplorer.tsx`

## B. Monetização Melhorada

**Estado atual**: Chat com IA + plano de ação. Funciona mas é genérico.

**Melhorias**:
1. **Integrar dados dos canais do usuário** (`user_channels`) — a IA recebe subscribers, views, nicho e análise do canal real
2. **Integrar dados do `niche_database`** — RPM real do nicho + dificuldade
3. **Dashboard visual** no topo: progress to YPP (subs/watchhours), receita estimada atual, próximo milestone
4. **Quick actions contextuais**: "Criar roteiro para seu nicho", "Analisar concorrentes do seu canal"

**Arquivos**: `src/pages/MonetizationPlanner.tsx`, `supabase/functions/monetization-coach/index.ts`

## C. Banco de Estilos de Roteiro Expandido

**Estado atual**: `script_knowledge` tem templates mas pode não cobrir todos os 13 STYLES do frontend.

**Melhorias**:
1. Inserir templates para cada estilo que não tenha cobertura completa: `dopaminérgico`, `mrbeast`, `tutorial`, `listicle`, `reddit`, `conspiração`, `mitologia`, `teorias`
2. Cada template inclui: estrutura, técnicas de retenção, exemplos reais, word-count guidelines
3. Verificar `scene_prompt_knowledge` para garantir que todos os 10 VIDEO_STYLES têm pelo menos 4 templates cada

**Implementação**: Migration SQL com INSERT INTO `script_knowledge` e `scene_prompt_knowledge`

## D. Auto-scan Semanal para `viral_titles_db`

**Estado atual**: `auto-scan-channels` existe e faz scan de canais. `build-viral-titles-db` existe para popular títulos. Mas não há cron job para títulos.

**Melhorias**:
1. **Expandir `auto-scan-channels`** para também chamar `build-viral-titles-db` com os nichos escaneados
2. **Criar cron job** via `pg_cron` para executar semanalmente (terças, 4 AM)
3. Cada execução adiciona ~50-100 títulos virais novos ao banco

**Arquivos**: `supabase/functions/auto-scan-channels/index.ts`, SQL insert para cron

## E. Integração Total via Workflow

**Estado atual**: Workflow é um checklist de 5 etapas estáticas. Não salva projetos, não linka dados.

**Melhorias**:
1. **Transformar em Project Manager** usando `video_projects` como base
2. **Cada projeto** = título + nicho + canal vinculado (opcional) + roteiro + cenas
3. **Dashboard** mostrando todos os projetos com status visual (draft → script → scenes → published)
4. **Criar projeto** a partir de: Niche Explorer, Sugestões do canal, Scripts
5. **Transição automática**: quando roteiro é salvo → projeto avança para "Script Done"; quando cenas são geradas → "Scenes Ready"
6. **Multi-canal**: filtrar projetos por canal, ver pipeline de cada canal

**Arquivos**: `src/pages/Workflow.tsx` (rewrite completo)

---

## Ordem de Implementação

| Prioridade | Item | Complexidade |
|-----------|------|-------------|
| 1 | E. Workflow como Project Manager | Alta |
| 2 | C. Banco de estilos expandido (migration) | Baixa |
| 3 | A. Niche Explorer com IA profunda | Média |
| 4 | B. Monetização melhorada | Média |
| 5 | D. Auto-scan viral_titles_db | Baixa |

## Arquivos Editados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Workflow.tsx` | Rewrite como Project Manager |
| `src/pages/NicheExplorer.tsx` | Botão salvar projeto, concorrentes do banco |
| `supabase/functions/niche-explorer/index.ts` | Consultar channel_intelligence + niche_database |
| `src/pages/MonetizationPlanner.tsx` | Dashboard YPP, integrar canais do usuário |
| `supabase/functions/monetization-coach/index.ts` | Receber dados de canais e niche_database |
| `supabase/functions/auto-scan-channels/index.ts` | Chamar build-viral-titles-db |
| Migration SQL | +30 templates script_knowledge + scene_prompt_knowledge |
| SQL insert | Cron job para auto-scan semanal |

