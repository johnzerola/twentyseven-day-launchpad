// ═══════════════════════════════════════════════════════════════
// PROMPT COMPOSER — Dynamic, sharded prompt assembly
// ═══════════════════════════════════════════════════════════════
// Solves "instruction dilution": Flash ignores the last 40% of
// prompts above ~8k tokens. We compose only modules relevant to
// the chosen style + duration + tier, capped at ~6k tokens.
// ═══════════════════════════════════════════════════════════════

import {
  HOOK_BLUEPRINTS,
  TRANSITION_BRIDGES,
  MICRO_HOOKS,
  EMOTION_WHEEL,
  DOPAMINE_ARCHITECTURE,
  SENSORY_DETAILS,
  NARRATIVE_WEAPONS,
  AUDIENCE_PSYCHOLOGY,
  INFORMATION_DENSITY,
  CLOSING_FORMULAS,
} from "./scriptwriting-skills.ts";

// Rough token estimator (4 chars ≈ 1 token for PT/EN mix).
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Style families — used to pick relevant modules only
const NARRATIVE_STYLES = new Set([
  "storytelling", "cinematográfico", "cinematografico", "novela",
  "novela_style", "filme_style", "serie_style", "terror", "mitologia",
  "reddit", "emocionante", "superacao", "superação", "sobrevivencia",
]);
const FACTUAL_STYLES = new Set([
  "documentário", "documentario", "webdocumentário", "webdocumentario",
  "educativo", "tutorial", "ciência", "ciencia", "história", "historia",
]);
const HIGH_DENSITY_STYLES = new Set([
  "dopaminérgico", "dopaminergico", "mrbeast", "listicle",
  "curiosidades", "polêmica", "polemica",
]);

// ═══════════════════════════════════════════════════════════════
// CORE RULES — always injected (~1.2k tokens). Hard format,
// language, anti-tag rules. Compressed from full ANTI_SLOP.
// ═══════════════════════════════════════════════════════════════
export const CORE_RULES = `
═══ 🚫 REGRAS ABSOLUTAS (NÃO NEGOCIÁVEIS) ═══

FORMATO DE SAÍDA:
- APENAS texto de narração falada. ZERO tags, ZERO marcações entre [colchetes].
- ZERO timestamps, ZERO "Narrador:", "Cena:", "VFX:", "SFX:", "TRILHA:", "B-ROLL".
- Parágrafos curtos (2-3 frases). Quebras naturais a cada ~60s de fala.
- Valores monetários sempre em $ com números específicos ($847.392 > "milhares").

FRASES PROIBIDAS (NUNCA literalmente):
"Neste vasto", "Vamos mergulhar", "É crucial notar", "Jornada incrível",
"Mundo acelerado", "Desbloqueie o potencial", "Sem mais delongas",
"Mente explodida", "E se eu te dissesse" (como abertura), "Imagine um mundo onde",
"Vale ressaltar", "Em suma", "Diante disso", "Como veremos a seguir",
"Obrigado por assistir", "Deixe o like" (DESTRÓI Session Time).

PADRÕES PROIBIDOS:
- 3+ frases longas seguidas (quebre o ritmo)
- 3+ superlativos genéricos no mesmo parágrafo
- Parágrafos consecutivos com mesmo início
- Resumos que não adicionam informação nova
- Despedidas no final (use Binge Loop em vez disso)

MAS / PORTANTO (mecânica narrativa):
Conecte ideias com "MAS" (conflito) ou "PORTANTO" (consequência).
NUNCA "E depois...", "Em seguida...", "Agora vamos falar sobre..."
`;

// ═══════════════════════════════════════════════════════════════
// COMPRESSED YPP DIRECTIVE (~600 tokens, was ~2k)
// ═══════════════════════════════════════════════════════════════
export const YPP_COMPRESSED = `
═══ 🛡️ YPP 2025 — REGRAS ESSENCIAIS ═══
1. VALOR HUMANO: opinião forte, análise, perspectiva pessoal — NÃO compilação de fatos
2. PROMESSA CLARA nos primeiros 30s: o espectador sabe O QUE ganha ficando
3. DIFERENCIAÇÃO: 1+ insight original que outros canais não teriam
4. QUEBRAS DE PADRÃO regulares: muda ritmo/tom para manter atenção
5. NUNCA pareça "compilação automática" — transforme info em narrativa
`;

// ═══════════════════════════════════════════════════════════════
// COMPRESSED HOLLYWOOD DNA (~500 tokens, was ~1.5k)
// Only top 5 of 10 principles, calibrated by style
// ═══════════════════════════════════════════════════════════════
function buildHollywoodCore(style: string): string {
  const isNarrative = NARRATIVE_STYLES.has(style);
  const isFactual = FACTUAL_STYLES.has(style);

  if (isNarrative) {
    return `
═══ 🎬 HOLLYWOOD DNA (estilo narrativo) ═══
1. STAKES REAIS: consequências PERMANENTES e IRREVERSÍVEIS estabelecidas cedo
2. SUBTEXTO > TEXTO: mostre mãos tremendo, não diga "ele tinha medo"
3. ESPECIFICIDADE = UNIVERSALIDADE: $847.000 > "muito dinheiro"
4. DELAYED GRATIFICATION: plante sementes cedo, payoff após 70%
5. CHEKHOV'S GUN: detalhe plantado no 1º bloco DETONA no clímax
`;
  }
  if (isFactual) {
    return `
═══ 🎬 HOLLYWOOD DNA (estilo factual) ═══
1. TRANSFORMAÇÃO > INFORMAÇÃO: cada minuto deve mudar algo no espectador
2. SISTEMA COMO VILÃO: conflitos contra estruturas (burocracia, ciência) ressoam mais
3. ESPECIFICIDADE = UNIVERSALIDADE: dados exatos com fonte > generalidades
4. INEVITABILIDADE COMO HORROR: dramatic irony — o espectador sabe o final
5. ESCALAÇÃO SEM PLATÔ: cada bloco MAIS intenso, cada revelação MAIOR
`;
  }
  return `
═══ 🎬 HOLLYWOOD DNA (alta densidade) ═══
1. ESCALAÇÃO SEM PLATÔ: cada bloco MAIS intenso. NUNCA platô no meio
2. ESPECIFICIDADE: $847.000 > "muito dinheiro". 14% > "alguns"
3. CONTRASTE EMOCIONAL ABRUPTO: máx 2x por roteiro — impacto vem da raridade
4. PEAK-END RULE: invista 80% do esforço no pico + final
5. RULE OF THREE: setup → reforço → SUBVERSÃO no 3º
`;
}

// ═══════════════════════════════════════════════════════════════
// HOOK BLUEPRINT FILTER — only inject 3 most relevant of 10
// ═══════════════════════════════════════════════════════════════
function pickRelevantHooks(style: string): string {
  // Hook indices most aligned with each style family
  const map: Record<string, number[]> = {
    narrative: [1, 6, 10], // Cold Open, In Medias Res, Detalhe que não deveria existir
    factual: [2, 9, 8],    // Dato Impossível, Escala Absurda, Promessa+Prova
    density: [3, 5, 7],    // Contradição, Ameaça Direta, Pergunta Impossível
    confession: [4, 1, 10], // Confissão, Cold Open, Detalhe
  };

  let family: keyof typeof map = "density";
  if (NARRATIVE_STYLES.has(style)) family = "narrative";
  else if (FACTUAL_STYLES.has(style)) family = "factual";
  else if (style === "reddit" || style === "storytelling") family = "confession";

  const picks = new Set(map[family]);
  // Extract only chosen blueprints from full HOOK_BLUEPRINTS
  const blocks = HOOK_BLUEPRINTS.split(/BLUEPRINT \d+/);
  const header = blocks[0];
  const filtered: string[] = [header.trim()];
  for (let i = 1; i < blocks.length; i++) {
    if (picks.has(i)) filtered.push(`BLUEPRINT ${i}${blocks[i]}`);
  }
  return filtered.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPOSER
// ═══════════════════════════════════════════════════════════════
export interface ComposerOptions {
  style: string;
  durationMin: number;
  niche?: string;
  tier?: "starter" | "pro" | "studio";
  // Optional pre-built blocks from caller (RAG, voice, intel etc)
  knowledgeBlock?: string;
  voiceBlock?: string;
  referenceBlock?: string;
  channelKnowledgeBlock?: string;
  intelBlock?: string;
  hookText?: string;
  topic?: string;
  language?: string;
  isShort?: boolean;
  targetWords?: number;
  minWords?: number;
  wpm?: number;
  // Force-include specific modules
  forceModules?: Array<"dopamine" | "weapons" | "psychology" | "sensory" | "emotion" | "density">;
}

export interface ComposedPrompt {
  systemPrompt: string;
  userMessage: string;
  estimatedTokens: number;
  modulesIncluded: string[];
}

export function composeScriptPrompt(opts: ComposerOptions): ComposedPrompt {
  const {
    style, durationMin, niche, tier = "starter",
    knowledgeBlock = "", voiceBlock = "", referenceBlock = "",
    channelKnowledgeBlock = "", intelBlock = "", hookText = "",
    topic = "", language = "português", isShort = false,
    targetWords = 0, minWords = 0, wpm = 150,
    forceModules = [],
  } = opts;

  const styleLC = (style || "").toLowerCase();
  const modulesIncluded: string[] = ["core", "hollywood-core", "hooks-filtered", "ypp-compressed"];

  // ── ALWAYS include (Tier 1) ──
  let parts: string[] = [
    `Você é o MELHOR ROTEIRISTA DO MUNDO para YouTube. 95%+ retenção.`,
    `Sua força: escrita criativa com profundidade emocional, voz autêntica.`,
    CORE_RULES,
    buildHollywoodCore(styleLC),
    pickRelevantHooks(styleLC),
    YPP_COMPRESSED,
  ];

  // ── CONDITIONAL (Tier 2) — based on duration ──
  // Transitions: cheap and high ROI, always include
  parts.push(TRANSITION_BRIDGES);
  modulesIncluded.push("transitions");

  // >5min: micro-hooks + density (retention engineering)
  if (durationMin > 5 || forceModules.includes("density")) {
    parts.push(MICRO_HOOKS);
    modulesIncluded.push("micro-hooks");
  }
  if ((durationMin > 5 && HIGH_DENSITY_STYLES.has(styleLC)) || forceModules.includes("density")) {
    parts.push(INFORMATION_DENSITY);
    modulesIncluded.push("density");
  }

  // >10min OR narrative style: emotion wheel + dopamine
  if (durationMin > 10 || NARRATIVE_STYLES.has(styleLC) || forceModules.includes("emotion")) {
    parts.push(EMOTION_WHEEL);
    modulesIncluded.push("emotion-wheel");
  }
  if (durationMin > 10 || forceModules.includes("dopamine")) {
    parts.push(DOPAMINE_ARCHITECTURE);
    modulesIncluded.push("dopamine");
  }

  // >15min OR narrative: sensory + weapons
  if ((durationMin > 15 || NARRATIVE_STYLES.has(styleLC)) || forceModules.includes("sensory")) {
    parts.push(SENSORY_DETAILS);
    modulesIncluded.push("sensory");
  }
  if (durationMin > 15 || forceModules.includes("weapons")) {
    parts.push(NARRATIVE_WEAPONS);
    modulesIncluded.push("weapons");
  }

  // >20min: audience psychology
  if (durationMin > 20 || forceModules.includes("psychology")) {
    parts.push(AUDIENCE_PSYCHOLOGY);
    modulesIncluded.push("psychology");
  }

  // ── Always: closings (binge loop is critical) ──
  parts.push(CLOSING_FORMULAS);
  modulesIncluded.push("closings");

  // ── External context blocks (caller-provided) ──
  if (knowledgeBlock) { parts.push(`\n🧠 KNOWLEDGE (RAG):\n${knowledgeBlock.slice(0, 2500)}`); modulesIncluded.push("rag"); }
  if (voiceBlock) { parts.push(voiceBlock); modulesIncluded.push("voice"); }
  if (channelKnowledgeBlock) { parts.push(channelKnowledgeBlock); modulesIncluded.push("channel-knowledge"); }
  if (intelBlock) { parts.push(intelBlock); modulesIncluded.push("intel"); }
  if (referenceBlock) { parts.push(referenceBlock); modulesIncluded.push("reference"); }
  if (hookText) { parts.push(`\n🪝 HOOK PRÉ-GERADO (USE COMO BASE):\n${hookText}`); modulesIncluded.push("pre-hook"); }

  // ── Final hard constraints (placed at END so model sees them last) ──
  parts.push(`
═══ ⚠️ CONSTRAINTS FINAIS (CHECK ANTES DE ENVIAR) ═══
- Nicho: ${niche || "geral"} | Idioma: ${language} | Formato: ${isShort ? "SHORT 9:16" : `LONGFORM ${durationMin}min`}
${isShort ? `- Hook em 2s, ${targetWords} palavras, frases ≤8 palavras` : `- ALVO: ${targetWords} palavras (mín ${minWords}). Taxa: ${wpm} wpm`}
- BINGE LOOP no final (NÃO despedida) — o final é a intro do próximo vídeo
- Apenas narração pura. ZERO tags técnicas.
`);

  const systemPrompt = parts.join("\n");
  const estimatedTokens = estimateTokens(systemPrompt);

  const userMessage = isShort
    ? `Escreva um SHORT VIRAL de ${Math.round(durationMin * 60)}s sobre: "${topic}"\nAlvo: ${targetWords} palavras. Hook de CHOQUE em 2s. Apenas narração.\nComece IMEDIATAMENTE pelo hook.`
    : `Escreva roteiro MAGNÉTICO de ${durationMin}min sobre: "${topic}"\nMeta: ${targetWords} palavras (mín ${minWords}). Hook devastador. Pattern interrupts a cada 45s. ${hookText ? "USE O HOOK PRÉ-GERADO." : ""}\nSe ainda não cobriu ${durationMin} minutos, CONTINUE expandindo até atingir a duração. Apenas narração pura.\nComece IMEDIATAMENTE.`;

  return { systemPrompt, userMessage, estimatedTokens, modulesIncluded };
}

// ═══════════════════════════════════════════════════════════════
// SLIM CONTINUATION PROMPT — for multi-act acts 2+
// (saves ~25k tokens per video)
// ═══════════════════════════════════════════════════════════════
export function composeContinuationPrompt(opts: {
  actNumber: number;
  language?: string;
  voiceBlock?: string;
  isLastAct?: boolean;
}): string {
  const { actNumber, language = "português", voiceBlock = "", isLastAct = false } = opts;
  return `Você é o MELHOR ROTEIRISTA DO MUNDO para YouTube. 95%+ retenção.

═══ CONTINUIDADE (ATO ${actNumber}) ═══
- MESMO tom, voz, estilo e personagens do ato anterior
- NÃO repita conteúdo. NÃO faça resumo. Continue fluindo.
- Parágrafos curtos (2-3 frases). Linguagem conversacional.
- APENAS narração pura — ZERO tags, timestamps, anotações
- Valores em $. Idioma: ${language}
- Conector: "MAS" (conflito) ou "PORTANTO" (consequência). NUNCA "E depois".
- Cliffhanger no final de cada bloco narrativo (~45-60s)
${voiceBlock ? `\n${voiceBlock.slice(0, 400)}` : ""}
${isLastAct ? `\n═══ ATO FINAL ═══\nCLÍMAX completo + RESOLUÇÃO satisfatória + Binge Loop (gancho próximo vídeo, NUNCA despedida).` : ""}`;
}
