

# DubSpy — Diagnóstico Completo + Correções

## O que funciona bem

- **Multi-query AI search**: Gemini Flash-Lite gera 4 queries de busca diversas por nicho — cobertura ampla confirmada nos logs
- **Enrichment pipeline**: Viral Score, Growth Potential, Algorithm Boost são calculados com fórmula sólida (views/sub, velocity 72h, engagement, like ratio, upload frequency)
- **Modo Escapees**: Retornou 38 canais reais com dados ricos (ex: "Olhar Curioso" — 27 dias, 4.6M views, viral score 76)
- **UI**: Cards com ViralScoreRing, filtros avançados, sort por 8 critérios, saved searches — bem construído
- **Dedup**: Vídeos são deduplicados entre queries paralelas

## Bugs encontrados (3 bugs reais)

### Bug 1: Feedback loop completamente quebrado
**Linha 426**: `ch.topVideos` não existe. O campo correto é `ch.videos`. Resultado: os títulos virais descobertos pelo DubSpy NUNCA alimentam o `viral_titles_db` nem o `hook_library`. O loop de aprendizagem prometido não funciona.

### Bug 2: Modo Emerging filtra demais — 0 resultados
Teste real: "true crime" BR → 56 canais analisados → 0 passaram nos filtros. O problema: o YouTube Search API com `order=viewCount` retorna vídeos de canais grandes (que têm >20 vídeos), e o filtro `isEmerging` exige `videoCount <= 20 AND ageDays <= 180`. Resultado: canais genuinamente novos com poucos vídeos raramente aparecem no top por views.

**Correção**: Adicionar uma segunda busca com `order=date` para encontrar canais realmente novos, não só os com mais views.

### Bug 3: Micro-niche-drill timeout
O modo faz: AI query generation → 3 YouTube searches → video stats → channel stats → AI clustering → drill por cluster (mais YouTube searches). Isso excede o timeout de 60s do Edge Function. 

**Correção**: Limitar drill a máximo 3 clusters e reduzir `maxResults` por query de 50 para 25 no modo drill.

## Melhorias propostas

### Melhoria 1: Gold Score (prometido na spec, não implementado)
O `viralScore` atual é bom mas não calcula o "Gold Score" prometido na spec: `multiplier * 0.4 + engagement * 0.3 + efficiency * 0.3`. Adicionar como campo separado para identificar canais pequenos com vídeos outlier.

### Melhoria 2: Contagem de vídeos recentes insuficiente
O sistema só pega vídeos dos últimos 30-180 dias via Search API (máximo ~50 por query). Para calcular `uploadFrequencyDays` corretamente, precisa do `uploads` playlist. Mas isso consumiria mais quota. 

**Solução pragmática**: Usar os vídeos encontrados mas indicar no UI quando os dados são baseados em amostra parcial.

### Melhoria 3: Indicador de confiança dos dados
O UI mostra `uploadFrequencyDays: 0` quando só tem 1 vídeo na amostra. Deve mostrar "—" ou "N/A" em vez de 0, e indicar quando o score é baseado em poucos vídeos.

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dubspy-scan/index.ts` | Fix `topVideos→videos`, add `order=date` search for emerging, timeout-proof drill, Gold Score |
| `src/components/dubspy/EmergingChannelsTab.tsx` | Indicador de confiança, melhor empty state |

## Detalhes técnicos
- 2 arquivos editados (1 edge function, 1 componente)
- 0 migrations
- Deploy + teste real com curl após correção

