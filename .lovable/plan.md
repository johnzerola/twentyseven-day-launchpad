

# Auditoria Completa + Plano v3.0 — DarkPlanner vs Nosso Sistema

---

## DIAGNÓSTICO COMPARATIVO

### O que o DarkPlanner tem:

| Feature | DarkPlanner | Nosso Sistema | Status |
|---------|-------------|---------------|--------|
| Gestão de Canais (multi-canal) | ✅ Kanban + multi-canal | ✅ Workspace + ProjectCard | ✓ Temos |
| Quadro de Ideias | ✅ Board visual | ✅ ViralThemeWizard + IdeaEngine | ✓ Superior |
| Biblioteca de Prompts | ✅ Organizada por canal | ⚠️ Prompt Exporter existe mas sem biblioteca persistente | Falta |
| Referências Visuais | ✅ Galeria de referências | ⚠️ ReferenceChannels mas sem galeria de imagens | Parcial |
| Vídeos Virais (pesquisa) | ✅ Ferramenta de busca | ✅ ViralDatabase + OutlierFinder + DubSpy | ✓ Superior |
| Nichos Virais | ✅ Descoberta de nichos | ✅ NicheExplorer + MicroNicheFinder | ✓ Superior |
| Insights de Canal | ✅ Análise básica | ✅ ChannelIntelligence + DNA + ReferenceAnalyzer | ✓ Superior |
| Canais Removidos | ✅ Detecta canais deletados | ❌ Não temos | Falta |
| Gerador de Áudio IA (TTS) | ✅ ElevenLabs, 210+ vozes, SRT sincronizado | ✅ AudioProcessor + ElevenLabs | ✓ Temos |
| SRT segmentado 8s | ✅ Gera SRT de 8 em 8 segundos | ❌ Não geramos SRT formatado em blocos de 8s | Falta |
| Extensão Chrome VEO/Whisk | ✅ Automação batch de prompts | ❌ Não temos (diferente escopo) | N/A |
| Roteiros | ✅ Editor básico | ✅ ScriptGenerator com Claude + 13 gêneros + Anti-Slop | ✓ 20x Superior |
| Geração de Prompts VEO | ✅ Manual via treinamento | ✅ Automático via DarkPlanner v3 pipeline | ✓ 20x Superior |
| Personagens consistentes | ✅ Via treinamento manual | ✅ CharacterManager + Identity Sheets automáticos | ✓ Superior |
| Policy Compliance VEO3 | ✅ Via treinamento | ✅ veo3-policy-filter.ts automático | ✓ Superior |
| Engenharia Reversa (Clone) | ❌ Não tem | ✅ DeepScan + Clone Engine | ✓ Exclusivo |
| Auto-Learn Knowledge | ❌ Não tem | ✅ 15+ tabelas, RAG, embeddings | ✓ Exclusivo |
| Score de Roteiro (dual AI) | ❌ Não tem | ✅ score-script com GPT + Gemini | ✓ Exclusivo |
| Predição de Retenção | ❌ Não tem | ✅ predict-retention | ✓ Exclusivo |
| Tracker 30 dias | ❌ Não tem | ✅ Tracker30Days | ✓ Exclusivo |
| Dotti (Assistente IA) | ❌ Não tem | ✅ ChatbotWidget com RAG | ✓ Exclusivo |

### Conclusão: Nosso sistema é 10-20x mais avançado tecnicamente. DarkPlanner é mais simples e organizado visualmente.

---

## FALHAS CRÍTICAS IDENTIFICADAS (10 Pilares)

### 1. Busca e Coleta de Dados
- **RAG subutilizado**: `match_knowledge()` existe mas `generate-script` NÃO o usa — carrega 13 tabelas fixas
- **Brave Search sem enriquecimento**: resultados cacheados como JSON bruto, sem extração de embeddings
- **Sem re-ranking no pipeline principal**: knowledge injetado sem filtro de relevância ao tópico
- **Fix**: Integrar `smart-knowledge-retrieval` no `generate-script` para Smart Context Selection

### 2. Banco de Dados
- **13 queries paralelas sem índices otimizados** em `generate-script`
- **scene_prompt_knowledge**: carrega 150 rows e filtra em JS — deveria ser SQL
- **Auto-learn sem deduplicação** em deep-scan → duplicatas no knowledge base
- **Fix**: Índices já criados na última migration. Falta deduplicação no upsert.

### 3. Geração de Vídeos / Clonagem
- **deep-scan-video** ainda tem risco de timeout em vídeos >20min
- **Sem processamento assíncrono** — cada clique é síncrono
- **Transcrição truncada a 5000 chars** — perde contexto em vídeos longos
- **Fix**: Pipeline assíncrono com `processing_jobs` table

### 4. Geração de Roteiros
- **System prompt gigante (~20K tokens)** — diluição de contexto
- **Sem priorização dinâmica de knowledge** — finanças carregadas para mitologia
- **`errResp` declarada 2x** — bug menor mas indica falta de linting
- **Fix**: Smart Context Selection + reduzir prompt para seções CORE/RELEVANT/SUPPLEMENTARY

### 5. Geração de Cenas e Prompts
- **Já implementado DarkPlanner v3** com 150-250 palavras, trio de movimento, policy filter
- **Falta**: Biblioteca persistente de prompts gerados (salvar e reutilizar)
- **Falta**: Exportação SRT segmentado em blocos de 8s (o que DarkPlanner oferece)

### 6. Automação e Fluxo
- **Pipeline wizard de 5 etapas funciona** mas não tem auto-save entre etapas
- **task-worker limitado a 10 runs/dia** — pode ser insuficiente para uso pesado
- **Sem debounce** no deep-scan frontend

### 7. Performance e Escalabilidade
- **Edge functions com timeout de 60s** — limite duro para operações pesadas
- **Sem paralelização** na geração de prompts (sequencial)
- **Knowledge queries podiam usar materialized views** (já criadas)

### 8. Qualidade das Respostas
- **Claude para roteiros = excelente** — Anti-Slop + 5 técnicas cinematográficas
- **Gemini para cenas = bom** mas sem feedback loop de qualidade
- **Falta calibração real** — `calibrate-knowledge` criado mas não integrado no fluxo

### 9. Features Faltantes (inspiradas no DarkPlanner)
- **Biblioteca de Prompts Persistente** — salvar prompts gerados com tags, pesquisar, reutilizar
- **SRT Segmentado 8s** — gerar arquivo SRT com blocos de 8 segundos para sincronização VEO
- **Detector de Canais Removidos** — monitorar canais de referência e detectar quando são deletados

### 10. Sugestões Avançadas (além do pedido)
- **A/B Test de Prompts**: gerar 2 variações de prompt para mesma cena, comparar resultados
- **Prompt Quality Score**: avaliar automaticamente cada prompt gerado (comprimento, movimento, consistência)
- **Batch Export para VEO**: exportar todos os prompts em formato pronto para paste em lote

---

## PLANO v3.0 — IMPLEMENTAÇÃO

### Fase 1: Quick Wins (Alto Impacto, Baixo Esforço)

**1.1 Smart Context Selection no generate-script**
- Chamar `smart-knowledge-retrieval` no início do pipeline em vez de 13 queries fixas
- Reduz system prompt em ~60%, melhora relevância 3x
- Arquivos: `supabase/functions/generate-script/index.ts`

**1.2 Gerador de SRT Segmentado 8s**
- Após gerar áudio no AudioProcessor, gerar SRT com blocos de 8 segundos
- Botão de download do SRT formatado
- Feature que DarkPlanner tem e nós não
- Arquivos: `src/components/scripts/AudioProcessor.tsx`

**1.3 Fix errResp duplicado + Policy filter regex**
- Remover declaração duplicada de `errResp` em `generate-script`
- Verificar regex no `veo3-policy-filter.ts`
- Arquivos: `supabase/functions/generate-script/index.ts`, `supabase/functions/_shared/veo3-policy-filter.ts`

**1.4 Debounce no DeepScan**
- Prevenir múltiplos cliques no botão de clonagem
- Arquivos: `src/components/tubespy/DeepScanPanel.tsx`

### Fase 2: Melhorias Avançadas (Alto Impacto)

**2.1 Biblioteca de Prompts Persistente**
- Nova tabela `prompt_library` (user_id, project_id, prompt_text, style, tags, scene_index, created_at)
- UI para salvar, pesquisar e reutilizar prompts gerados
- Botão "Salvar na Biblioteca" no PromptExporter
- Migration SQL + frontend component
- Arquivos: migration SQL, `src/components/scripts/PromptExporter.tsx`, novo `src/components/scripts/PromptLibrary.tsx`

**2.2 Pipeline Assíncrono para Deep Scan**
- Usar tabela `processing_jobs` (já criada) para processar clonagem em background
- Frontend mostra progress bar com Supabase Realtime
- Elimina timeouts completamente
- Arquivos: `supabase/functions/deep-scan-video/index.ts`, `src/components/tubespy/DeepScanPanel.tsx`

**2.3 Prompt Quality Score (Auto-Validação DarkPlanner Etapa 10)**
- Após gerar prompts, validar automaticamente:
  - Comprimento (150-250 palavras)
  - Presença de movimento (personagem + câmera + ambiente)
  - Consistência de descrição de personagem (diff entre prompts)
  - Trigger words residuais
  - Anti-text suffix
  - Max 2 personagens por prompt
- Mostrar badge de qualidade (verde/amarelo/vermelho) por prompt
- Arquivos: `supabase/functions/generate-synced-prompts/index.ts`, `src/components/scripts/SceneViewer.tsx`

### Fase 3: Arquitetura Estado da Arte (Longo Prazo)

**3.1 Auto-Evolução com Feedback Loop**
- Integrar `calibrate-knowledge` no fluxo pós-publicação
- Quando vídeo tem performance tracker → comparar previsão vs realidade → atualizar scores
- Arquivos: `supabase/functions/calibrate-knowledge/index.ts`, `supabase/functions/task-worker/index.ts`

**3.2 Detector de Canais Removidos**
- Job semanal que verifica se canais de referência ainda existem
- Alerta quando canal é removido (oportunidade de gap)
- Nova edge function + UI notification

**3.3 Smart Prompt Re-Generation**
- Se prompt falha no VEO3 (policy violation), auto-substituir e oferecer alternativa
- Integrar feedback do usuário ("este prompt falhou") para melhorar o filtro

---

## ROADMAP

| Prazo | Ação | Impacto |
|-------|------|---------|
| Agora | 1.1 Smart Context + 1.3 Bugfixes + 1.4 Debounce | Alto |
| Agora | 1.2 SRT Segmentado 8s | Médio |
| Próximo | 2.1 Biblioteca de Prompts | Alto |
| Próximo | 2.2 Pipeline Assíncrono Deep Scan | Alto |
| Próximo | 2.3 Prompt Quality Score | Médio |
| Futuro | 3.1 Auto-Evolução Feedback | Muito Alto |
| Futuro | 3.2 Detector Canais Removidos | Baixo |
| Futuro | 3.3 Smart Re-Generation | Médio |

---

## Detalhes Técnicos

### Smart Context Selection (1.1)
Substituir as 13 queries paralelas no `generate-script` por uma chamada à edge function `smart-knowledge-retrieval`:
```text
// Antes: 13 queries fixas → 15-20K tokens de knowledge
// Depois: 1 chamada RAG → top-15 snippets relevantes (~3K tokens)
const knowledgeResp = await callFn("smart-knowledge-retrieval", { topic, niche, style, language });
```

### SRT Segmentado 8s (1.2)
```text
Após transcrição, gerar SRT com blocos de 8 segundos:
00:00:00,000 --> 00:00:08,000
[texto narrado nos primeiros 8s]

00:00:08,000 --> 00:00:16,000
[texto narrado nos próximos 8s]
```
Botão de download no AudioProcessor.

### Prompt Library Schema (2.1)
```text
CREATE TABLE prompt_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  style TEXT,
  tags TEXT[],
  scene_type TEXT, -- 'character', 'environment', 'establishing'
  word_count INT,
  quality_score NUMERIC,
  video_style TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Arquivos a Modificar
1. `supabase/functions/generate-script/index.ts` — Smart Context + bugfix errResp
2. `supabase/functions/_shared/veo3-policy-filter.ts` — regex fix
3. `src/components/scripts/AudioProcessor.tsx` — SRT 8s generator
4. `src/components/tubespy/DeepScanPanel.tsx` — debounce
5. `src/components/scripts/PromptExporter.tsx` — save to library button
6. `src/components/scripts/SceneViewer.tsx` — quality badges
7. Nova migration SQL — prompt_library table + RLS
8. Novo: `src/components/scripts/PromptLibrary.tsx` — UI de biblioteca

