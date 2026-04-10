

# Plano: Sistema 10/10 — Webdocumentário + Normalização + Melhorias Críticas

## Diagnóstico Atual (8.5/10)

**Dados no banco:**
- 19.257 canais | 6.611 títulos virais | 1.013 content DNA | 3.274 embeddings | 401 hooks | 290 script knowledge | 15 structures | 6 attention curves | 242 ai_learnings

**Problemas identificados:**
1. **Nichos fragmentados** — 95+ variações de "Documentary" (ex: "Documentary", "documentary", "Nature Documentary", "nature documentaries", "Documentary/History"). Mesmo problema em True Crime, Horror, etc.
2. **Sem estilo Webdocumentário** — O sistema tem "documentário" genérico mas falta o estilo específico de webdocumentários (LEMMiNO, Kurzgesagt, Real Stories, Veritasium, canais BR como JJ)
3. **Apenas 6 attention curves** — Falta curva específica para documentário/webdoc
4. **Apenas 15 script structures** — Falta template webdocumentário com pesquisa profunda
5. **Hook types fragmentados** — 80+ tipos não normalizados (curiosity vs Curiosity vs curiosidade)

## O que será feito

### 1. Normalização de Nichos (Migration SQL)
Criar migration que normaliza os nichos duplicados nas tabelas `channel_intelligence` e `viral_titles_db`:
- "documentary" → "Documentary"
- "true crime" → "True Crime"
- "horror" → "Horror"
- ~20 normalizações nos nichos mais fragmentados
- Criar função SQL reutilizável para normalização futura

### 2. Normalização de Hook Types (Migration SQL)
Unificar hook_library:
- "curiosity" / "Curiosity" / "curiosidade" → "curiosity"
- "shock" / "Shocking stat" / "shocking stat" → "shock"
- ~15 normalizações

### 3. Novo Estilo: Webdocumentário (generate-script + refine-script)
Adicionar estilo "webdocumentário" no `styleGuides` e `GENRE_DIRECTIONS`:

**Características do estilo webdocumentário:**
- Pesquisa profunda com fontes acadêmicas, livros, bibliografias
- Tom investigativo-científico (não sensacionalista)
- Estrutura: Pergunta provocativa → Investigação em camadas → Revelações baseadas em evidência → Conclusão que muda perspectiva
- Referências: LEMMiNO, Kurzgesagt, Veritasium, Real Stories, JJ (BR), PBS Eons, RealLifeLore
- Suporta: animais/natureza (Discovery Channel), civilizações antigas (Egito, Maias), ciência, tecnologia, biografias históricas
- Narração calma, inteligente, sem pressa — mas com curiosity gaps estratégicos
- Dados com fontes reais, citações de estudos, contexto histórico profundo

### 4. Nova Attention Curve: Webdocumentário (Insert SQL)
Adicionar curva de atenção específica para documentários de 15-20 min:
- Opening fact → Context build → Investigation → Evidence reveal → Counter-perspective → Deep reveal → Synthesis → Reflection

### 5. Novas Script Structures (Insert SQL)
Adicionar 3 templates:
- **Web Documentary Deep Research** — LEMMiNO/Kurzgesagt style
- **Nature/Animal Documentary** — Discovery/NatGeo style
- **Ancient Civilizations Documentary** — History Channel style

### 6. Script Knowledge para Webdocumentário (Insert SQL)
Adicionar 5-8 técnicas específicas:
- Pesquisa em camadas (livro → estudo → entrevista → dado primário)
- Narração omnisciente com empatia
- Visualização de dados complexos em linguagem simples
- Transições tipo "viagem no tempo" (presente → passado → presente)
- Técnica "zoom in/zoom out" (macro → micro → macro)

### 7. Brave/Perplexity Research para Webdocumentário
No `generate-script`, habilitar pesquisa web para estilo webdocumentário (atualmente bloqueado para estilos criativos). Webdocumentários PRECISAM de dados reais.

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-script/index.ts` | Adicionar estilo "webdocumentário" em styleGuides, nicheGuides e GENRE_DIRECTIONS. Habilitar pesquisa web para este estilo. |
| `supabase/functions/refine-script/index.ts` | Instruções específicas de refinamento para webdocumentário (preservar fontes, não sensacionalizar). |
| Migration SQL #1 | Normalização de nichos em channel_intelligence e viral_titles_db |
| Migration SQL #2 | Normalização de hook_types em hook_library |
| Insert SQL | Novas attention curves, script structures e script knowledge para webdocumentário |

## Resultado esperado
- Sistema sobe de 8.5 → 9.5/10
- Nichos organizados e limpos
- Suporte nativo a webdocumentários (Discovery, NatGeo, LEMMiNO)
- Dados mais confiáveis para TubeBot e RAG semântico
- Hooks normalizados para análise precisa

