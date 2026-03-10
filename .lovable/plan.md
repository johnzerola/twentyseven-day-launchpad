

# Redesign Completo: HacksLab → Growth Command Center

## Diagnóstico

O HacksLab atual tem vários problemas:
- Dados fallback estáticos que aparecem antes da IA gerar (parece fake)
- Muita sobreposição com Niche Explorer (keywords, competitors, monetização)
- Não é interativo — gera tudo de uma vez e mostra dados estáticos
- Não tem nada que outros tools não ofereçam

## Visão: O que um CEO que monetizou 25K canais faria

Transformar o HacksLab em um **Growth Command Center** — o hub estratégico que nenhum concorrente tem. Foco em ferramentas ÚNICAS que não existem nas outras páginas:

### Módulos do novo HacksLab

**1. Revenue Simulator (Simulador de Receita Interativo)**
- Sliders interativos: nicho, país, frequência de upload, duração média, tipo (faceless/face)
- Calcula em tempo real: RPM estimado, views projetadas, receita AdSense + infoprodutos + afiliados
- Gráfico de projeção de 12 meses mostrando crescimento de receita
- Usa dados reais do `youtube_knowledge` DB

**2. Brand Kit Generator (Gerador de Marca — versão melhorada)**
- Mantém o core atual (nomes, paleta, prompts) mas sem fallback fake
- Adiciona: geração de imagens reais via IA (logo, banner, thumbnail concept)
- Preview visual com as cores aplicadas num mockup de canal

**3. Thumbnail Lab (Laboratório de Thumbnails)**
- IA analisa thumbnails de concorrentes e gera conceitos otimizados
- Score de CTR estimado para cada conceito
- Prompts prontos para Midjourney/DALL-E

**4. Growth Checklist (Checklist de Crescimento Personalizado)**
- IA gera checklist adaptado ao estágio do usuário (0 subs, 1K, 10K, 100K)
- Progresso persistido no banco (user_progress)
- Cada item tem explicação e link para o módulo relevante da plataforma

**5. Content Matrix (Matriz de Conteúdo)**
- Mostra o mix ideal: % long-form, % shorts, % community posts
- Sugestões de temas baseadas no nicho via IA
- Calendário semanal visual drag-free

## Implementação Técnica

### Edge Function `generate-branding` — Refatorar
- Separar em chamadas menores por módulo (revenue calc é client-side, brand kit usa IA, thumbnail usa IA)
- Remover os dados fallback do frontend
- Usar `gemini-3-flash-preview` para respostas mais rápidas

### Frontend `src/pages/Branding.tsx` — Reescrever do zero
- Layout: tabs horizontais com ícones grandes
- Cada módulo carrega sob demanda (não tudo de uma vez)
- Revenue Simulator: sliders com Recharts para gráficos
- Brand Kit: cards com preview visual
- Thumbnail Lab: grid de conceitos com scores
- Growth Checklist: lista interativa com checkboxes persistidos
- Content Matrix: grid visual com percentuais

### Dados
- Revenue Simulator usa constantes de RPM por nicho/país (client-side, sem API call)
- Brand Kit e Thumbnail Lab usam a edge function com IA
- Growth Checklist usa `user_progress` table existente

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/Branding.tsx` | Reescrever completamente |
| `supabase/functions/generate-branding/index.ts` | Refatorar para suportar módulos separados |
| `src/lib/constants.ts` | Adicionar RPM data por nicho/país |

## Ordem de Execução
1. Adicionar dados de RPM/nicho em constants.ts
2. Reescrever Branding.tsx com os 5 módulos
3. Refatorar edge function generate-branding
4. Testar cada módulo

