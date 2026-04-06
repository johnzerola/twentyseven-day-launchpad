

# Plano: Completar Integração da Viral Engine v4.0

## O Que Já Está Implementado (~85%)
Sound Design, VFX Tags, Binge Loop, Mas/Portanto, 3 Archetypes, 5 Title Formulas, Hooks V2, CTAs — tudo já está no sistema.

## Gaps Restantes

### 1. `src/lib/viralDatabase.ts` — Expandir Dados
- **+3 Narrator Archetypes**: Jornalista Sombrio (escândalos, casos reais), Narrador Cinematográfico (guerras, desastres, épicos), Cientista Curioso (ciência bizarra, física quântica)
- **+3 Title Patterns V2**: Negatividade/Aviso ("Pare de fazer [X] imediatamente"), Curiosidade Inversa ("O que acontece quando você [X] por 30 dias"), Promessa Condicional ("Se você fizer isso 1x por dia...")
- **+4 CTAs Psicológicos rotulados**: Escassez, Emocional, Desafio Mental, Identidade — com textos do documento
- **+10 Reference Channels** como nova constante `ELITE_REFERENCE_CHANNELS` com dados estruturados (nome, nicho, inscritos, lições-chave) — 5 US (MrBallen, Infographics Show, Mr. Nightmare, WatchMojo, Daily Dose) + 5 BR (Fatos Desconhecidos, Você Sabia?, INCRÍVEL, Nostalgia, Manual do Mundo)

### 2. `supabase/functions/generate-script/index.ts` — Expandir Seleção de Persona
- Atualizar o bloco `NARRATOR ARCHETYPE` para mapear os 6 archetypes (não apenas 3)
- Adicionar mapeamentos: documentário/escândalo → Jornalista Sombrio; guerra/desastre/épico → Narrador Cinematográfico; ciência/biologia/física → Cientista Curioso

### 3. `supabase/functions/generate-titles/index.ts` — +3 Fórmulas
- Injetar as 3 fórmulas restantes (Negatividade, Curiosidade Inversa, Promessa Condicional) no prompt de geração

## Detalhes Técnicos
- 3 arquivos editados (1 client-side, 2 edge functions)
- Zero mudanças de banco de dados
- Adições puras — sem risco de quebrar funcionalidades existentes

