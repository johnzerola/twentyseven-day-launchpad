# ESTUDO TÉCNICO APROFUNDADO — VEO3 PARA YOUTUBE DE ALTA RETENÇÃO

**Data:** 2026-03-13  
**Fontes:** Google DeepMind Prompt Guide, Vertex AI Docs, Skywork AI Research, PromptHero, Medium (James 99), DEV Community, Segmind, comunidade Google AI Developers Forum  
**Objetivo:** Explorar 100% das capacidades do Veo3 para geração de vídeos cinematográficos sincronizados com narração, otimizados para retenção no YouTube.

---

## 1. ENGENHARIA DE PROMPTS PARA VEO3

### 1.1 Estrutura Ideal de Prompt (Fórmula 7 Elementos)

Baseado no guia oficial do Google DeepMind e validado por dezenas de testes da comunidade, a estrutura ideal segue **7 camadas**:

```
[SHOT FRAMING + CAMERA MOTION] + [SUBJECT/CHARACTER] + [ACTION] + [ENVIRONMENT/LOCATION] + [LIGHTING] + [STYLE/MOOD] + [AUDIO DIRECTION]
```

**Exemplo profissional:**
```
Slow dolly-in, 85mm anamorphic lens with shallow depth of field. A weathered cartographer 
in his sixties, silver beard, ink-stained fingers, wearing a linen shirt with rolled sleeves, 
sits in a cluttered study filled with ancient maps and brass instruments. He traces a faded 
coastline on a centuries-old sea chart, his eyes widening with discovery. Warm lamplight 
illuminates the scene with Rembrandt lighting, casting deep golden shadows across stacked 
leather-bound journals. Dust particles drift through volumetric light beams from a small 
window. Atmospheric, mysterious, scholarly mood. Kodak Vision3 500T film grain, natural 
skin pores, chromatic aberration on highlights. Quiet ambient room tone, soft paper rustle, 
distant clock ticking. masterpiece, award-winning cinematography, 8K UHD. 
(no subtitles, no text, no titles, no captions, no logos, no watermarks)
```

### 1.2 Nível de Detalhamento

| Nível | Resultado | Uso Recomendado |
|-------|-----------|-----------------|
| **Baixo** (10-20 palavras) | Genérico, imprevisível | ❌ Nunca |
| **Médio** (40-80 palavras) | Bom, com controle parcial | Cenas simples, B-roll |
| **Alto** (100-200 palavras) | Cinematográfico, controle total | ✅ Produção profissional |
| **Ultra** (200-400 palavras) | Máximo controle, micro-detalhes | Cenas complexas com ação |

**DESCOBERTA CRÍTICA:** O Google DeepMind confirma: *"The more detail you add, the more control you'll have over the final output."* Prompts com 100-200 palavras geram resultados consistentemente superiores.

### 1.3 Direção Cinematográfica no Prompt

O Veo3 **entende terminologia profissional de cinema**. Use exatamente estas palavras:

**Tipos de Shot (Enquadramento):**
- `extreme close-up (ECU)` — detalhes micro (olhos, mãos, texturas)
- `close-up (CU)` — rosto, expressão emocional
- `medium close-up (MCU)` — busto, ombros acima
- `medium shot (MS)` — cintura acima
- `medium long shot (MLS)` — joelhos acima
- `full shot (FS)` — corpo inteiro
- `long shot (LS)` — personagem no ambiente
- `extreme long shot (ELS)` — paisagem épica, escala
- `over-the-shoulder (OTS)` — perspectiva de conversa
- `bird's eye view` — vista aérea de cima
- `worm's eye view` — vista do chão olhando para cima
- `Dutch angle` — câmera inclinada, tensão

**Movimentos de Câmera (Veo3 executa bem):**
- `slow dolly-in` — aproximação suave, tensão crescente
- `tracking shot` — câmera segue o sujeito lateralmente
- `crane shot` — movimento vertical + horizontal
- `steadicam` — seguimento fluido, cinema vérité
- `slow pan` — rotação horizontal suave
- `orbit shot` — câmera gira ao redor do sujeito
- `push-in` — avanço dramático
- `pull-out` — revelação de contexto
- `rack focus` — mudança de foco entre planos
- `handheld` — realismo, urgência documental

**Lentes (Veo3 diferencia):**
- `24mm wide angle` — paisagens épicas, distorção dramática
- `35mm` — documentário, cinema vérité
- `50mm` — perspectiva natural, "olho humano"
- `85mm portrait` — retratos, bokeh cremoso, isolamento
- `135mm telephoto` — compressão, intimidade à distância
- `anamorphic` — flares horizontais, aspecto cinematográfico widescreen

### 1.4 Iluminação

O Veo3 renderiza iluminação com alta fidelidade:

- `golden hour` — luz dourada, sombras longas, calor emocional
- `Rembrandt lighting` — triângulo de luz no rosto, drama clássico
- `butterfly lighting` — luz acima, glamour, Hollywood clássico
- `split lighting` — metade luz/metade sombra, dualidade
- `rim lighting / edge light` — contorno brilhante, separação do fundo
- `volumetric lighting / god rays` — raios de luz através de partículas
- `chiaroscuro` — contraste extremo luz/sombra, Caravaggio
- `practical lights` — luzes diegéticas visíveis na cena (lâmpadas, velas)
- `neon glow` — cyberpunk, noite urbana

### 1.5 Composição

- `rule of thirds` — posicionamento clássico
- `centered symmetrical composition` — Wes Anderson, poder
- `leading lines` — guiar o olho do espectador
- `negative space` — solidão, vastidão, impacto
- `shallow depth of field f/1.4-2.8` — foco seletivo, bokeh

---

## 2. TIPOS DE CENAS COM MELHOR QUALIDADE

### 2.1 Ranking de Qualidade por Tipo de Cena

Baseado na pesquisa e nos relatos da comunidade:

| Tipo de Cena | Qualidade Veo3 | Notas |
|---|---|---|
| **Paisagens naturais / Drone** | ⭐⭐⭐⭐⭐ | Excelente. Terrenos, montanhas, oceanos, florestas. |
| **Cenários urbanos** | ⭐⭐⭐⭐⭐ | Cidades, ruas, neon, tráfego — muito realista. |
| **Cenas documentais** | ⭐⭐⭐⭐⭐ | Ambientes históricos, museus, bibliotecas. |
| **Cenas cinematográficas (drama)** | ⭐⭐⭐⭐⭐ | Iluminação dramática, composição narrativa. |
| **Cenas históricas** | ⭐⭐⭐⭐ | Bom para civilizações antigas, batalhas épicas. Cuidado com detalhes anatômicos. |
| **Close-ups de objetos/comida** | ⭐⭐⭐⭐⭐ | Macro, texturas, materiais — excelente. |
| **POV / Primeira pessoa** | ⭐⭐⭐⭐ | Funciona bem com descrição clara de perspectiva. |
| **Restauração / Construção** | ⭐⭐⭐⭐ | Bom para processos visuais. Especificar etapas. |
| **Cenas com drone** | ⭐⭐⭐⭐⭐ | Uma das forças do Veo3. Sweep, reveal, tracking aéreo. |
| **Ambientes subaquáticos** | ⭐⭐⭐⭐ | Bom com iluminação volumétrica e partículas. |
| **Mãos humanas em detalhe** | ⭐⭐⭐ | ⚠️ Ponto fraco. Usar negativePrompt agressivo. |
| **Multidões complexas** | ⭐⭐⭐ | ⚠️ Pode gerar artefatos. Limitar número de pessoas. |

### 2.2 Cenas que Funcionam Excepcionalmente

1. **Drone cinematográfico sobre paisagem** — Veo3 é excelente nisso
2. **Tabletop / Product shot** — macro com iluminação controlada
3. **Atmosfera noturna urbana com neon** — cyberpunk, noir
4. **Natureza macro (flores, água, insetos)** — time-lapse, detalhes
5. **Ambientes arquitetônicos interiores** — luz natural, archviz
6. **Character moments (close-up emocional)** — expressões faciais

### 2.3 Cenas a Evitar ou Usar com Cuidado

- ❌ **Mãos fazendo tarefas complexas** (articulação imprecisa)
- ❌ **Texto legível na cena** (Veo3 não renderiza texto)
- ❌ **Muitas pessoas simultâneas** (>4 pode gerar artefatos)
- ❌ **Ações físicas muito rápidas** (pode perder coerência temporal)
- ⚠️ **Rostos muito próximos em conversa** (lip-sync não garantido)

---

## 3. QUALIDADE CINEMATOGRÁFICA

### 3.1 CGI e VFX no Prompt

O Veo3 consegue renderizar efeitos visuais impressionantes quando instruído:

```
// Partículas e atmosfera
"atmospheric dust particles floating through volumetric light beams"
"ember particles rising slowly in warm backlight"
"rain droplets catching rim light on a dark background"
"dense morning fog rolling across a valley"

// Efeitos de lente
"anamorphic lens flare streaking across the frame"
"subtle chromatic aberration on highlight edges"
"natural lens breathing on focus pull"
"oval anamorphic bokeh in background highlights"

// Pós-produção implícita
"color graded in teal and orange Hollywood palette"
"crushed blacks with lifted shadows, cinematic LUT applied"
"Kodak Vision3 500T film emulation with natural grain"
"ACES color science, warm skin tones, lifted blacks"
```

### 3.2 Depth of Field

```
"shallow depth of field at f/1.4, subject tack-sharp, background melting into creamy bokeh"
"deep focus f/11, every plane razor-sharp from foreground to infinity"
"rack focus pulling from foreground element to subject in background"
```

### 3.3 Motion Blur

```
"natural motion blur on fast-moving hands, 180-degree shutter angle"
"long exposure motion trails on city traffic at night"
"subtle camera shake suggesting handheld documentary feel"
```

### 3.4 Color Grading Estilos

```
// Hollywood Blockbuster
"teal and orange color grade, crushed blacks, warm highlights"

// Documentário Netflix
"natural color palette, slightly desaturated, cool shadows, warm skin"

// Dark/Noir
"deep crushed blacks, cyan and magenta accent lighting, high contrast"

// Vintage/Nostálgico
"faded warm tones, lifted blacks, slight magenta shift, film grain"

// Épico/Histórico
"golden warm tones, deep amber shadows, bronze highlights"
```

### 3.5 Como Incluir no Prompt

**Regra de ouro:** Inclua TODOS os elementos técnicos naturalmente na descrição:

```
Steadicam tracking shot, anamorphic 35mm lens with shallow depth of field 
f/2.0. [SUBJECT + ACTION]. [ENVIRONMENT]. Volumetric golden hour lighting 
streaming through [element], casting long dramatic shadows. Atmospheric 
dust particles floating in light beams. Color graded in warm amber tones 
with Kodak Vision3 500T film grain. Natural motion blur, chromatic 
aberration on highlights. masterpiece, 8K UHD, award-winning cinematography.
(no subtitles, no text, no titles, no captions, no logos, no watermarks)
```

---

## 4. DURAÇÃO MÍNIMA DOS VÍDEOS

### 4.1 Descobertas Confirmadas

| Modelo | Durações Disponíveis | Resolução |
|--------|---------------------|-----------|
| **Veo 3** (AI Studio) | **8 segundos** fixo | 720p / 1080p |
| **Veo 3.1** (Vertex AI) | **4, 6 ou 8 segundos** | 720p / 1080p |
| **Veo 3 Fast** | **8 segundos** (50% mais rápido) | 720p / 1080p (92-99% qualidade) |

### 4.2 Análise Técnica

**✅ SIM, é possível gerar vídeos menores que 8 segundos — mas apenas com Veo 3.1 via Vertex AI.**

A API do Vertex AI para Veo 3.1 aceita o parâmetro `durationSeconds` com valores: `4`, `6` ou `8`.

```json
{
  "model": "veo-3.1-generate-preview",
  "contents": { "parts": [{ "text": "prompt here" }] },
  "generationConfig": {
    "durationSeconds": 4  // ← aceita 4, 6 ou 8
  }
}
```

**⚠️ LIMITAÇÃO:** O Veo 3 "padrão" (via Gemini/AI Studio) gera **apenas 8 segundos**. Não há hack para reduzir.

### 4.3 Extensão de Vídeos

O Veo 3.1 permite extensão via API:
- **+7 segundos** por step
- Até **20 extensões**
- Total máximo: **148 segundos** (≈2:28)

### 4.4 Recomendação para o Sistema

```
LONGFORM (16:9):
- Cena padrão: 8 segundos (Veo 3)
- Cena de ação rápida: 6 segundos (Veo 3.1 - se disponível)
- Hook: 8 segundos (máximo impacto)

SHORTS (9:16):
- Cena padrão: 8 segundos 
- Para 60s = 7-8 cenas de 8s
- Para 30s = 4 cenas de 8s (cortar no editor)
```

---

## 5. SOLUÇÃO PARA LIMITAÇÃO DE 8 SEGUNDOS

### 5.1 Micro-Narrativa Interna (Técnica Principal)

A melhor solução é **projetar múltiplos momentos visuais dentro de um único vídeo de 8 segundos**, usando transições naturais no prompt.

**Exemplo — Egito:**
```
Handheld medium shot inside a dimly lit classroom, a student traces 
hieroglyphs in a textbook with their finger, eyes widening — the camera 
smoothly tracks forward past the book as the scene seamlessly transforms 
into a documentary screen showing aerial footage of the Pyramids of Giza 
at golden hour — the camera pushes through the screen into the actual 
landscape, becoming a sweeping drone shot over the ancient monuments with 
the Nile River glinting in warm sunset light. Volumetric god rays 
streaming through desert haze. Kodak Vision3 film grain, 8K UHD.
(no subtitles, no text, no titles, no captions, no logos, no watermarks)
```

### 5.2 Técnicas de Multi-Momento

| Técnica | Descrição | Exemplo no Prompt |
|---------|-----------|-------------------|
| **Morph Transition** | Cena A se transforma em cena B | "the scene seamlessly transforms into..." |
| **Camera Push-Through** | Câmera atravessa um elemento | "camera pushes through the doorway into..." |
| **Rack Focus Reveal** | Foco muda revelando novo elemento | "rack focus pulls from foreground to reveal..." |
| **Time-Skip** | Salto temporal dentro da cena | "as hours pass in timelapse, the sky shifts from..." |
| **Perspective Shift** | Muda o ponto de vista | "POV shifts from observer to participant as..." |
| **Split Action** | Dois eventos simultâneos | "in the foreground... while in the background..." |

### 5.3 Regras para Micro-Narrativa

1. **Máximo 2-3 momentos** por vídeo de 8s (mais que isso perde coerência)
2. Use **conectores de transição natural**: "seamlessly transforms into", "as the camera pulls back to reveal", "dissolving into"
3. Mantenha **continuidade visual**: mesma paleta de cores, mesma iluminação base
4. O **primeiro momento** deve ocupar ~2-3s (hook)
5. O **último momento** deve ser o mais impactante (payoff visual)

### 5.4 Prompt Template Multi-Momento

```
[CAMERA + LENS]. [MOMENTO 1: sujeito + ação + ambiente] — [TRANSIÇÃO 
NATURAL] — [MOMENTO 2: novo sujeito/perspectiva + ação] — [TRANSIÇÃO] — 
[MOMENTO 3: payoff visual épico]. [ILUMINAÇÃO]. [ESTILO + QUALIDADE]. 
(anti-text block)
```

---

## 6. SINCRONIZAÇÃO COM NARRAÇÃO

### 6.1 Princípio Fundamental

**O vídeo deve ILUSTRAR exatamente o que a narração está dizendo naquele instante.**

Isso significa:
- Se a narração diz "pirâmides do Egito" → o vídeo MOSTRA pirâmides
- Se a narração diz "cientistas descobriram" → o vídeo MOSTRA laboratório/cientista
- Se a narração diz "algo terrível aconteceu" → o vídeo MOSTRA atmosfera sombria/tensão

### 6.2 Mapeamento Semântico

O sistema deve realizar **mapeamento semântico** entre narração e visual:

```
Narração: "Esqueça tudo que você aprendeu na escola sobre o Egito"
                    ↓
Mapeamento Semântico:
- "escola" → sala de aula, estudante, livro
- "Egito" → pirâmides, faraós, hieróglifos
- "esqueça/aprendeu" → revelação, descoberta, impacto
                    ↓
Visual: Estudante fecha livro → câmera penetra na página → 
        emerge em vista aérea das pirâmides
```

### 6.3 Tipos de Sincronização

| Tipo | Quando Usar | Exemplo |
|------|-------------|---------|
| **Literal** | Objetos concretos mencionados | "pirâmides" → mostra pirâmides |
| **Metafórica** | Conceitos abstratos | "medo" → sombras crescentes, escuridão |
| **Emocional** | Tom da narração | narração triste → cores frias, movimento lento |
| **Contrastante** | Ironia/surpresa narrativa | "tudo estava calmo..." → ambiente ameaçador |
| **Progressiva** | Escalação narrativa | tom cresce → câmera se aproxima, cores aquecem |

### 6.4 Regra dos 3 Segundos

**Nos primeiros 3 segundos de cada cena**, o visual DEVE:
1. Estabelecer o contexto do que a narração está dizendo
2. Incluir um elemento visual magnético (movimento, contraste, detalhe)
3. Criar curiosidade visual (algo incompleto, parcialmente revelado)

### 6.5 Anti-Padrões a Evitar

- ❌ Visual genérico que não corresponde à narração
- ❌ Mesmo tipo de cena repetido (ex: 3 cenas de drone seguidas)
- ❌ Desconexão emocional (narração tensa + visual calmo)
- ❌ Visual que "spoila" o que a narração ainda vai revelar

---

## 7. RETENÇÃO DE AUDIÊNCIA ATRAVÉS DAS IMAGENS

### 7.1 Neurociência da Retenção Visual

O cérebro humano processa imagens 60.000x mais rápido que texto. Para YouTube:

- **0-3 segundos:** Hook visual — decide se o espectador fica
- **A cada 5-8 segundos:** Mudança visual necessária para manter atenção
- **Dopamina:** Liberada por novidade, revelação, beleza inesperada
- **Atenção decresce:** Monotonia visual causa abandono imediato

### 7.2 Técnicas de Retenção Visual para Prompts

| Técnica | Efeito | Implementação no Prompt |
|---------|--------|------------------------|
| **Pattern Interrupt** | Quebra expectativa visual | Mudar ângulo/perspectiva radicalmente entre cenas |
| **Reveal Progressivo** | Curiosidade visual | "camera slowly reveals..." / rack focus |
| **Contraste Dramático** | Atenção automática | Cena escura → explosão de luz |
| **Movimento Constante** | Engajamento ocular | Sempre incluir camera motion ou ação |
| **Micro-Detalhes** | Fascínio visual | Extreme close-up de texturas, gotas, partículas |
| **Escala Épica** | Awe/admiração | Drone reveal de paisagem massiva |
| **Velocidade Variável** | Ritmo dopaminérgico | Alternar slow-motion e velocidade normal |

### 7.3 Fórmula de Cena Dopaminérgica

```
DOPAMINE = (NOVIDADE × BELEZA × MOVIMENTO) / PREVISIBILIDADE
```

**Para maximizar:**
1. Cada cena deve ter algo que o espectador NUNCA viu antes
2. Qualidade visual deve ser impressionante (iluminação perfeita)
3. Câmera SEMPRE em movimento (nunca estática por >2s)
4. Nunca repetir o mesmo tipo de visual em cenas consecutivas

### 7.4 Sequência Visual Anti-Drop-Off

```
Cena 1 (HOOK): Impacto máximo, ECU dramático, reveal
Cena 2: Contexto, wide shot atmosférico
Cena 3: Escalação, tracking dinâmico
Cena 4: Micro-detalhe, ECU textural (pattern interrupt)
Cena 5: Perspectiva aérea, escala épica
Cena 6: Close emocional, intimidade
Cena 7: Cena de ação/movimento rápido
Cena 8: Reveal dramático, câmera pull-out
Cena N: Loop visual (conecta com Cena 1)
```

### 7.5 Erros de Retenção Visual

- ❌ Câmera estática por 8 segundos
- ❌ Mesmo ângulo em 2+ cenas consecutivas
- ❌ Visual sem movimento ou ação
- ❌ Cores monótonas sem contraste
- ❌ Cenas sem elemento humano/emocional

---

## 8. ANÁLISE DO SISTEMA ATUAL DE ROTEIROS

### 8.1 Pontos Fortes

✅ **Script Engine com RAG (knowledge base):** O sistema consulta 15+ tabelas de conhecimento antes de gerar roteiros  
✅ **Estilos especializados:** Templates HVM para Conspiração, Mitologia, Reddit, Horror, Documentário  
✅ **Script Score com 6 métricas:** Gancho (25%), Curiosity Gap (15%), Intensidade Emocional (20%), Tensão Narrativa (20%), Retenção (10%), Pacing (10%)  
✅ **Narração contínua sem marcadores técnicos:** Otimizado para TTS  
✅ **Bypass inteligente de pesquisa:** Estilos criativos não são limitados por dados factuais  
✅ **Separação Long/Short:** Pipelines independentes  

### 8.2 Gaps Identificados

#### ⚠️ Gap 1: Falta de "Visual Blueprint" no Roteiro
O roteiro não instrui explicitamente quais visuais devem acompanhar cada trecho. O sistema tenta inferir isso depois, mas a intenção visual deveria nascer COM o roteiro.

**Solução:** Adicionar campo `scene_blueprint` no output do roteiro:
```json
{
  "block": 1,
  "narrative_summary": "Hook — revelação chocante sobre o Egito",
  "visual_hint": "close-up de hieróglifos brilhando, transição para drone sobre pirâmides",
  "mood": "mysterious → epic",
  "camera_suggestion": "macro → drone sweep",
  "characters_present": ["narrator"]
}
```
*(Nota: este campo `sceneBlueprintFromScript` JÁ existe no sistema — está parcialmente implementado)*

#### ⚠️ Gap 2: Hook Pode Ser Mais Agressivo
O sistema usa hooks bons, mas pode ser mais dopaminérgico nos primeiros 3 segundos. Deveria incluir "impossibility hooks" e "counter-intuitive statements" mais frequentemente.

#### ⚠️ Gap 3: Loop Ending Inconsistente
Nem todos os roteiros terminam com loop efetivo. O sistema deveria FORÇAR um final que crie urgência para o próximo vídeo.

#### ⚠️ Gap 4: Falta de "Retention Markers"
O roteiro não marca explicitamente onde estão os "attention resets" — pontos onde o espectador está prestes a sair e precisa de um boost de curiosidade.

### 8.3 Avaliação Geral

| Critério | Nota (1-10) | Status |
|----------|-------------|--------|
| Storytelling | 8/10 | ✅ Forte, especialmente estilos HVM |
| Hooks | 7/10 | ⚠️ Bom, pode ser mais agressivo |
| Narrativa progressiva | 8/10 | ✅ Estrutura de escalação presente |
| Loops de curiosidade | 7/10 | ⚠️ Presente mas inconsistente |
| Momentos emocionais | 8/10 | ✅ Bem implementado |
| Magnetismo (é impossível parar de ouvir?) | 7/10 | ⚠️ Pode melhorar com pattern interrupts |
| Dopaminérgico (cada frase recompensa?) | 6/10 | ⚠️ Gap — falta "information reward" consistente |
| Envolvente (espectador se identifica?) | 7/10 | ⚠️ Bom, pode usar mais "you language" |

---

## 9. FRAMEWORK FINAL

### 9.1 Estrutura Ideal de Prompt Veo3

```
VEO3 MASTER PROMPT TEMPLATE v2.0

[SHOT_TYPE + CAMERA_MOTION], [LENS_SPEC] with [DOF_SETTING]. 
[CHARACTER_DESCRIPTION if applicable — FULL identity, VERBATIM every time]. 
[ACTION — what is happening, described cinematically]. 
[ENVIRONMENT — specific, sensory, atmospheric]. 
[LIGHTING_SETUP — exact type + modifiers]. 
[ATMOSPHERIC_ELEMENTS — particles, fog, rain, etc.]. 
[COLOR_GRADE — specific palette or film stock reference]. 
[ANTI_AI_REALISM — skin pores, motion blur, film grain, lens artifacts]. 
[QUALITY_TAGS]: masterpiece, award-winning cinematography, 8K UHD, 
photorealistic, Kodak Vision3 film grain, ACES color science. 
[AUDIO_DIRECTION]: ambient sounds, foley, music mood.
(no subtitles, no text, no titles, no captions, no logos, no watermarks, 
no on-screen graphics, no writing)
```

### 9.2 Estrutura Ideal de Cenas

**LONGFORM (16:9) — 10-15 minutos:**
```
Cena 1 (HOOK): 8s — ECU dramático + reveal épico
Cena 2: 8s — Wide establishing + atmosfera
Cena 3: 6s — Tracking + contexto narrativo  
Cena 4: 8s — Close emocional + tensão
Cena 5: 6s — Pattern interrupt (mudança radical de visual)
... (repetir ciclo de variedade)
Cena N-1: 8s — Climax visual
Cena N: 8s — Loop (visual que conecta ao hook)
```

**SHORTS (9:16) — 30-60 segundos:**
```
Cena 1 (HOOK): 8s — Impacto IMEDIATO, vertical 9:16, centro do frame
Cena 2: 8s — Curiosidade, revelação parcial
Cena 3: 8s — Micro-narrativa, escalação
Cena 4: 8s — Payoff visual
Cena 5-7: 8s cada — (para 60s: twist + revelação + loop)
Cena Final: 8s — Loop ending (conecta visualmente ao início)
```

### 9.3 Estrutura Ideal de Roteiro

**LONGFORM:**
```
[0-15s] HOOK: Impossibility statement / visual shock
[15-60s] CONTEXTO: Setup do mundo / problema
[1-3min] CONFLITO: O que está errado / mistério
[3-6min] ESCALAÇÃO: Stakes crescentes, revelações parciais
[6-8min] CLIMAX: Revelação principal / momento emocional
[8-9min] RESOLUÇÃO: Síntese + nova perspectiva
[Final 10s] LOOP: "Mas isso é apenas o começo..." / visual callback
```

**SHORTS:**
```
[0-2s] HOOK: Frase impossível de ignorar + visual magnético
[2-15s] CURIOSIDADE: "Você sabia que..." + visual revelador
[15-35s] MICRO-NARRATIVA: Story comprimida com escalação
[35-50s] PAYOFF: Revelação / twist / momento emocional
[50-60s] LOOP: Visual/frase que conecta ao início
```

### 9.4 Modelo de Sincronização Roteiro-Vídeo

```
PIPELINE DE SINCRONIZAÇÃO:

1. ROTEIRO gera → scene_blueprint[] (intenção visual por bloco)
2. ÁUDIO (TTS) gera → transcription_blocks[] (timestamps reais)
3. SYNC ENGINE cruza → blueprint + timestamps = synced_scenes[]
4. VEO3 PROMPT ENGINE gera → visual_prompts[] (prompt por cena)
5. VEO3 API gera → video_clips[] (8s cada)
6. EDITOR monta → video_final (com cortes nos timestamps)

Regra de Ouro: 
O ÁUDIO é a âncora temporal absoluta.
O ROTEIRO define a intenção.
O VISUAL serve ambos.
```

### 9.5 Modelo de Retenção Visual

```
RETENTION VISUAL MODEL v2.0

Para cada cena, calcular:

VISUAL_RETENTION_SCORE = Σ (
  hook_impact × 0.25,        // Quão impactante é o primeiro frame?
  narrative_sync × 0.20,     // Visual corresponde à narração?
  camera_variety × 0.15,     // Diferente da cena anterior?
  motion_energy × 0.15,      // Quanto movimento há?
  emotional_resonance × 0.15,// Provoca emoção?
  detail_richness × 0.10     // Texturas, partículas, profundidade?
)

REGRAS:
- Score < 6: REJEITAR e regenerar
- Score 6-7: ACEITÁVEL com ajustes
- Score 8-9: BOM
- Score 10: EXCELENTE

ANTI-DROP-OFF RULES:
- Nunca 2 cenas consecutivas com mesmo shot type
- Nunca 3 cenas consecutivas sem close-up humano
- A cada 4 cenas: obrigatório "pattern interrupt" visual
- Primeira cena de cada minuto: deve ter score ≥ 8
```

---

## APÊNDICE: PROMPT EXAMPLES PROFISSIONAIS

### A. Hook Cinematográfico (Egito)
```
Extreme close-up, anamorphic 50mm lens with ultra-shallow depth of field 
f/1.4. A weathered hand with sun-darkened skin traces golden hieroglyphs 
carved into ancient limestone, fingertips brushing centuries of sand and 
dust. The camera slowly racks focus to reveal the vast interior of an 
unexplored tomb, torchlight casting dancing shadows across walls covered 
in pristine painted murals — colors impossibly vivid after millennia in 
darkness. Volumetric light beams cut through settled dust particles. 
Warm amber Rembrandt lighting mixed with cool blue ambient fill. Kodak 
Vision3 500T film grain, natural lens breathing, subtle chromatic 
aberration. Mysterious, awe-inspiring, archaeological. masterpiece, 
award-winning cinematography, 8K UHD, photorealistic. Soft ambient 
cave echo, distant wind, faint musical drone.
(no subtitles, no text, no titles, no captions, no logos, no watermarks, 
no on-screen graphics, no writing)
```

### B. Drone Épico (Natureza)
```
Wide aerial drone sweep, 24mm ultra-wide lens. Epic bird's eye view 
soaring over an ancient volcanic island at golden hour, emerald 
rainforest canopy giving way to black volcanic cliffs plunging into 
turquoise ocean. Mist rising from hidden waterfalls catches golden 
sunlight, creating prismatic rainbows. The drone descends smoothly 
towards a secluded beach with pristine white sand. Golden hour rim 
lighting illuminating sea spray. Natural atmospheric haze creating 
depth layers. Film grain, motion blur on vegetation, lens flare from 
low sun angle. Epic, pristine, untouched paradise. masterpiece, 
award-winning cinematography, 8K UHD, photorealistic, ACES color. 
Distant ocean waves, tropical bird calls, gentle wind.
(no subtitles, no text, no titles, no captions, no logos, no watermarks)
```

### C. Multi-Momento (Transição Interna)
```
Steadicam medium shot, 35mm lens. Inside a modern classroom, a 
university student leans forward studying an old map of ancient trade 
routes, afternoon sunlight filtering through venetian blinds — the 
camera pushes in past the student's shoulder INTO the map itself as 
the illustration seamlessly transforms into a real aerial landscape — 
emerging as a sweeping cinematic drone shot over the actual Silk Road 
mountain passes with camel caravans moving through golden desert valleys 
at sunrise. Volumetric morning mist in mountain valleys. Color shifts 
from cool academic blue to warm epic golden. Kodak Vision3 film grain, 
anamorphic bokeh transition. Scholarly becoming epic. masterpiece, 8K.
(no subtitles, no text, no titles, no captions, no logos, no watermarks)
```

### D. Dark/Noir (Conspiração)
```
Slow dolly-in, 85mm portrait lens with shallow DOF f/2.0. A lone 
figure in a dark hooded coat stands at the edge of an abandoned rooftop, 
silhouetted against a rain-drenched neon cityscape below. Water drips 
from the hood's edge. The figure's face is barely visible — just the 
faint glow of a phone screen illuminating sharp cheekbones and one 
intense eye. Lightning flashes in the distance, briefly revealing the 
massive scale of the dark city. Chiaroscuro lighting with cyan neon 
rim light from below, magenta accent from a distant billboard. Rain 
streaks catching light. Blade Runner 2049 meets Se7en. Film noir, 
cyberpunk noir, dense atmospheric fog. masterpiece, 8K UHD. Rain 
ambience, distant thunder, low electronic drone.
(no subtitles, no text, no titles, no captions, no logos, no watermarks)
```

---

## CONCLUSÃO

O Veo3 é um modelo extraordinariamente capaz quando alimentado com prompts profissionais. As principais descobertas:

1. **Prompts de 100-200 palavras** com terminologia cinematográfica geram resultados muito superiores
2. **8 segundos é a duração padrão** — contornável com micro-narrativas internas e Veo 3.1 (4/6/8s)
3. **Paisagens, drone, close-ups e atmosfera noturna** são os pontos fortes do modelo
4. **Sincronização narração-visual** requer mapeamento semântico + áudio como âncora temporal
5. **Retenção visual** depende de variedade de câmera, movimento constante e "pattern interrupts"
6. **O sistema atual de roteiros é sólido (7-8/10)** mas pode melhorar em hooks agressivos, information rewards e loop endings
7. **A fórmula de prompt ideal** combina: Shot + Character + Action + Environment + Lighting + Atmosphere + Anti-AI + Quality + Audio + Anti-text

Este framework deve ser integrado no `scene_prompt_knowledge` e usado como base para todas as gerações futuras.
