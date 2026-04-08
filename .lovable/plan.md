
# Plano: Multi-Atos Robusto para 40-60 Minutos

## Diagnóstico dos Problemas Atuais

O sistema multi-atos já existe para scripts ≥25min, mas falha em atingir 40-60min por:

1. **Cap artificial no Ato 1**: `Math.min(targetWords * 0.45, 3000)` — limita a 3000 palavras máximo
2. **Máximo de 3 atos**: Para 60min precisamos de ~9000 palavras. Com ~4000 palavras/ato (limite do LLM), precisamos de 3-5 atos
3. **Contexto insuficiente entre atos**: Apenas 500 palavras do ato anterior são passadas
4. **Sem planejamento narrativo**: Os atos são gerados "cegamente" — cada ato não sabe o arco completo
5. **Ato 3 só ativa se `dur >= 35`**: Deveria ativar sempre que faltar palavras

## Solução: Motor de Atos Dinâmico com Planejamento Narrativo

### Mudança 1: Planejamento de Arco Narrativo (pre-flight)
Antes de gerar, fazer uma chamada rápida (não-streaming, flash) para criar um **outline de atos**:
```
Para um roteiro de 60min sobre "X":
- Ato 1 (0-15min): Setup + Hook — ~2500 palavras
- Ato 2 (15-30min): Escalada + Turning Point — ~2500 palavras  
- Ato 3 (30-45min): Clímax + Complicação — ~2500 palavras
- Ato 4 (45-60min): Resolução + Binge Loop — ~1500 palavras
```
Esse outline guia cada geração subsequente.

### Mudança 2: Loop Dinâmico de Atos (substituir código fixo de 3 atos)
- Substituir o bloco fixo (Act1 → Act2 → maybe Act3) por um **loop** que gera atos até atingir `minWords`
- Máximo de 6 atos (safety)
- Cada ato recebe: outline do ato atual + últimas 800 palavras do ato anterior + contagem de palavras restante

### Mudança 3: Tokens e Caps
- Remover cap de 3000 no ato 1
- Cada ato usa `maxTokens: 16384` (mantém, suficiente para ~4000-5000 palavras)
- Ato final recebe instrução explícita de RESOLUÇÃO + BINGE LOOP

### Mudança 4: RAG metadata no multi-act stream
- Injetar `_meta` event no início do multiActStream (como já feito no single-act)

## Arquivos Modificados

### `supabase/functions/generate-script/index.ts`
- Linhas 949-1107: Refatorar bloco multi-atos
- Adicionar chamada de planejamento narrativo (pre-flight)
- Implementar loop dinâmico de atos
- Injetar RAG metadata

## Impacto
- Scripts de 40min: 3-4 atos (~6000-7000 palavras)
- Scripts de 60min: 4-5 atos (~8500-9000 palavras)
- Qualidade narrativa superior com outline guiando cada ato
- Custo: 1 chamada flash extra (outline) + mais atos = ~2-3x custo atual para scripts longos
