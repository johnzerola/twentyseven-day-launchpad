

# Plano: Motor de Monetização Completo — 10 Seções

Este é um projeto massivo com 10 seções interdependentes. Dado o tamanho, vou dividir em **3 fases de implementação**, seguindo a prioridade exata que você definiu.

---

## Fase 1 — Receita Imediata + Anti-Abandono (Seções 6, 4, 1)

### 1. AffiliateLinksGenerator (Seção 6)
- Criar componente `src/components/scripts/AffiliateLinksGenerator.tsx`
- Tab "💰 Monetizar Agora" na página Scripts (após aprovação do roteiro)
- Auto-detecta nicho do script, mostra 5 programas de afiliados ranqueados com comissão, tempo de aprovação, botão "Copiar link"
- Gera snippet de descrição pronto para colar no YouTube
- Calculadora de receita estimada (0.5% conversão × views estimadas)
- Tabela hardcoded de 6 nichos com ~5 programas cada (finanças, tech, saúde, terror, educação, gaming)

### 2. Consistency Guardian (Seção 4)
- Nova edge function `consistency-guardian` — roda quando Dashboard carrega
- Lógica: calcula dias desde último script, busca trending topic do nicho
- 3 níveis: CONSISTENCY_BREAK (>2 dias), MOMENTUM_LOST (>5 dias), OK
- Banner full-width no topo do Dashboard com botão "Gerar agora" que pre-preenche Scripts
- Componente `src/components/dashboard/ConsistencyGuardian.tsx`

### 3. 4-Level Monetization Track (Seção 1)
- Componente `src/components/dashboard/MonetizationTrack.tsx`
- Barra horizontal com 4 níveis: Primeira Receita → Micro Sponsorship → YPP Early → YPP Full
- Status: locked/in_progress/unlocked com lógica baseada em ações do usuário
- Exibido no topo do Tracker30Days e no Dashboard

---

## Fase 2 — Feedback Loop + Thumbnails Reais (Seções 7, 5, 3)

### 4. 48h Post-Upload Diagnostic (Seção 7)
- Componente `src/components/dashboard/PostUploadDiagnostic.tsx`
- Quando vídeo linkado tem <48h: puxa CTR, AVD, retenção 30s via OAuth (ou input manual)
- 4 diagnósticos: CTR CRITICAL (<3.5%), Hook fraco (ret 30s <60%), Retenção média (<40%), SUCCESS (>5% CTR + >50% ret)
- Tab "Diagnóstico ao Vivo" no Tracker
- Sem OAuth: mostra campos para input manual + explica como encontrar os dados no YouTube Studio

### 5. Thumbnail Image Generation (Seção 5)
- O ThumbnailGenerator já tem `generateImage()` que chama `generate-thumbnail-prompt` com `generate_image: true`
- Verificar se o edge function já suporta geração real via Lovable AI (gemini-3.1-flash-image-preview)
- Se não, adicionar branch no edge function para gerar imagem real via Lovable AI gateway
- Adicionar nota "O primeiro frame do seu vídeo deve mostrar exatamente o que está no thumbnail"

### 6. 30-Day Plan Rebuild (Seção 3)
- Reescrever o system prompt em `generate-30day-plan/index.ts`
- Estrutura hardcoded: Days 1-3 (Launch Setup), 4-7 (Dual Launch), 8-14 (CTR War), 15-21 (Hype Strategy), 22-28 (Micro Sponsorship), 29-30 (YPP Check)
- Media Kit Generator como novo componente para Days 22-28
- Auto-cálculo de pricing baseado em avg views

---

## Fase 3 — Inteligência + Warnings (Seções 9, 8, 2, 10, 11)

### 7. Hype Feature (Seção 9)
- Seção "Hype Strategy" no Tracker para dias 15-30
- Task type HYPE_PUSH com Community Post template auto-gerado
- Hype Score no ScriptPerformanceTracker com countdown de 7 dias

### 8. Niche Monetization Speed (Seção 8)
- Score "⚡ Velocidade de Monetização" no NicheExplorer
- Fórmula: RPM + affiliate availability + sponsorship accessibility + competition inverse
- Estimativas hardcoded por nicho (finanças 21d, tech 18d, etc.)

### 9. Algorithm Levers in Prompts (Seção 2)
- Widget "Algorithm Score" na página Scripts com CTR potential, retention risks, binge path
- Injetar "[EDITOR: pattern interrupt]" a cada 45-60s nos scripts gerados
- Binge hook obrigatório no final de cada script
- Atualizar system prompts em `generate-script/index.ts`

### 10. Kill Warnings (Seção 10)
- 5 warnings hardcoded no TrackerWizard, Onboarding e Script Generator
- Modal obrigatório para "Shorts only" strategy
- YPP alert no dual-score evaluation para conteúdo AI-sounding
- Horário ideal de publicação baseado em OAuth ou default 17h-20h

### 11. Knowledge Base Update (Seção 11)
- Atualizar `MONETIZATION_KNOWLEDGE` em `monetization-coach/index.ts` com dados 2025-2026

---

## Detalhes Técnicos

**Arquivos novos a criar:**
- `src/components/scripts/AffiliateLinksGenerator.tsx`
- `src/components/dashboard/ConsistencyGuardian.tsx`
- `src/components/dashboard/MonetizationTrack.tsx`
- `src/components/dashboard/PostUploadDiagnostic.tsx`
- `src/components/dashboard/MediaKitGenerator.tsx`
- `supabase/functions/consistency-guardian/index.ts`

**Arquivos a editar:**
- `src/pages/Scripts.tsx` — adicionar tab Monetizar + Algorithm Score widget
- `src/pages/Dashboard.tsx` — adicionar ConsistencyGuardian banner + MonetizationTrack
- `src/pages/Tracker30Days.tsx` — MonetizationTrack + Hype tasks + PostUploadDiagnostic tab
- `src/pages/NicheExplorer.tsx` — Monetization Speed score
- `supabase/functions/generate-30day-plan/index.ts` — rebuild system prompt
- `supabase/functions/generate-script/index.ts` — retention checkpoints + binge hooks
- `supabase/functions/monetization-coach/index.ts` — knowledge base update
- `src/components/scripts/ThumbnailGenerator.tsx` — real image generation
- `src/components/tracker/TrackerWizard.tsx` — kill warnings

**Nenhuma migração de banco necessária** — toda a lógica usa tabelas existentes (saved_scripts, video_performance, onboarding_plans, etc.) e dados hardcoded.

**Sem dependências externas novas** — usa Lovable AI gateway para thumbnails e Gemini para planos.

