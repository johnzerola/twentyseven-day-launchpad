

# Plano: Rebuild "Meus Canais" — Inteligência Real

## Problemas Identificados

1. **Growth rate incorreto**: Os dados de "concorrentes" vêm da tabela `channel_intelligence` com growth_rate estimado por IA, sem cálculo real. A busca é genérica (filtra apenas por país), não por similaridade real ao canal do usuário.

2. **Concorrentes falsos**: A função `loadCompetitors` apenas consulta `channel_intelligence` por país e faz match de string no nicho. Não busca concorrentes reais via YouTube API (canais que competem pelo mesmo público/keywords).

3. **Visão Geral vazia**: O `analysis_json` nunca é preenchido porque `resolve-channel` só retorna stats básicas. A função `analyze-channel` existe mas nunca é chamada ao adicionar canal.

4. **Sugestões genéricas**: `suggest-themes` recebe nicho genérico, sem contexto dos top vídeos reais do canal.

## O Que Será Implementado

### 1. Análise Automática ao Adicionar Canal
- Após adicionar um canal via `resolve-channel`, chamar automaticamente `analyze-channel` para obter análise completa (SEO, forças, fraquezas, estratégia)
- Salvar o resultado em `analysis_json` na tabela `user_channels`
- Detectar e salvar o nicho real do canal

### 2. Visão Geral Rica
- Mostrar a análise completa: SEO score, pontos fortes/fracos, estratégia de conteúdo, estimativa de receita, frequência recomendada
- Exibir os top vídeos e vídeos recentes com views (dados retornados pelo `analyze-channel`)
- Mostrar growth potential e competitor insights do AI

### 3. Concorrentes Reais via YouTube API
- Criar nova Edge Function `find-competitors` que:
  - Pega os top 5 títulos do canal do usuário
  - Busca vídeos similares no YouTube por keyword + país
  - Identifica canais pequenos (< subs do usuário × 2) com vídeos performando acima da média
  - Retorna com métricas reais: subs, avg views, multiplier, top vídeos
- Substituir a busca no `channel_intelligence` por chamada real ao YouTube

### 4. Sugestões Contextualizadas
- Passar os top vídeos do canal, nicho detectado e dados dos concorrentes como contexto para `suggest-themes`
- Incluir os títulos dos vídeos virais dos concorrentes como referência
- Sugestões focadas em "gaps" — temas que os concorrentes cobrem mas o usuário não

### 5. Fix Growth Rate
- Calcular growth rate com dados reais: comparar views recentes vs. média histórica
- Se views recentes > 2× média → "explosive"; > 1.3× → "fast"; else "steady"

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/find-competitors/index.ts` | **Novo** — busca concorrentes reais via YouTube API |
| `src/pages/Channels.tsx` | Rewrite: análise auto, overview rico, concorrentes reais, sugestões contextuais |
| `supabase/config.toml` | Adicionar config da nova function |

## Fluxo do Usuário

```text
Adiciona canal → resolve-channel (stats) → analyze-channel (AI analysis)
                                                     ↓
                                              Salva analysis_json
                                                     ↓
                              ┌─────────────┬────────────────┬──────────────┐
                              │ Visão Geral │  Concorrentes  │  Sugestões   │
                              │ SEO, forças │ find-competitors│ suggest-themes│
                              │ receita,    │ YouTube API    │ + contexto   │
                              │ top vídeos  │ canais reais   │ top vídeos   │
                              └─────────────┴────────────────┴──────────────┘
```

