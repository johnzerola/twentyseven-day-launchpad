// ═══════════════════════════════════════════════════════════════
// SCRIPT VALIDATORS — Post-generation deterministic checks +
// surgical repair detection. Cheaper than re-prompting at length.
// ═══════════════════════════════════════════════════════════════

import { calculateSlopScore } from "./anti-slop-rules.ts";

export interface ValidationResult {
  passed: boolean;
  slopScore: number;
  hookStrength: number; // 0-10
  dopamineCount: number;
  hasBingeLoop: boolean;
  hasTechnicalTags: boolean;
  wordCount: number;
  meetsLengthTarget: boolean;
  issues: string[];
  repairActions: RepairAction[];
}

export interface RepairAction {
  type: "rewrite_hook" | "rewrite_ending" | "remove_tags" | "boost_density";
  reason: string;
  // Char range to repair (for surgical fixes)
  startChar?: number;
  endChar?: number;
}

// ─── Hook patterns from the 10 blueprints ───
const HOOK_SIGNALS = [
  /\d+(?:\.\d+)?(?:\s*(?:milhões|bilhões|mil))?\s+(?:pessoas|anos|vezes|dólares|reais|mortes|casos)/i,
  /\$[\d.,]+/, // money
  /^\w+\.\s+\w+\.\s+\w+\./, // 3 short sentences = punchy opening
  /[Ee]u\s+(?:passei|levei|gastei|investi|estudei)/, // confession
  /[Tt]odo\s+mundo\s+(?:acredita|pensa|acha)/, // contradiction
  /[SsEe]\s+você\s+(?:carrega|usa|faz|tem|come)/, // direct threat
  /[Tt]udo\s+fazia\s+sentido/, // anomaly
  /[Oo]\s+que\s+você\s+faria\s+se/, // impossible question
  /[Pp]ara\s+(?:colocar|ter)\s+(?:em\s+perspectiva|uma\s+ideia)/, // scale
];

// ─── Dopamine markers ───
const DOPAMINE_MARKERS = [
  /[Mm]as\s+(?:antes|primeiro|tem|aí|olha|espera)/g, // open loops
  /[Ll]embra\s+(?:do|da|que)/g, // pattern recognition
  /[Pp]ara\s+colocar\s+em\s+perspectiva/g, // scale dopamine
  /\d{3,}/g, // specific numbers
  /[Pp]ortanto/g, // consequence connector
  /[Mm]as\s+o\s+(?:detalhe|problema|pior|mais)/g, // anticipation
];

// ─── Technical tags that should NEVER appear in output ───
const TAG_PATTERNS = [
  /\[(?:CENA|VISUAL|CÂMERA|CAMERA|VFX|SFX|ÁUDIO|AUDIO|TRILHA|MÚSICA|MUSICA|B-?ROLL|J-?CUT|CORTE|CORTAR|EDITOR|TIMESTAMP|BPM|BLENDER|AFTER\s*EFFECTS|EMOÇÃO|EMOCAO|EMOTION)[^\]]*\]/gi,
  /^(?:Narrador|NARRATOR|Cena|CENA|VISUAL|Voz)\s*:\s*/gm,
  /^\d+:\d+\s*[-–—]\s*\d+:\d+/gm, // timestamps "00:30 - 01:00"
];

// ─── Generic farewell patterns (kill Session Time) ───
const FAREWELL_PATTERNS = [
  /[Oo]brigado\s+por\s+(?:assistir|ver|verem)/i,
  /[Dd]eixe\s+(?:o\s+)?like/i,
  /[Aa]té\s+(?:a\s+)?(?:próxima|proxima|mais\s+ver)/i,
  /[Tt]chau\b/i,
  /[Ss]e\s+inscreva\s+no\s+canal\s*\.?\s*$/im,
];

// ─── Binge loop signals (good ending) ───
const BINGE_LOOP_SIGNALS = [
  /(?:vídeo|video)\s+(?:que\s+aparece|na\s+sua\s+tela|aqui\s+(?:em\s+cima|do\s+lado))/i,
  /(?:explico|conto)\s+(?:tudo|isso|os\s+detalhes)\s+(?:nesse|nesta|naquele)/i,
  /(?:próximo|proximo)\s+(?:vídeo|video)/i,
  /[Cc]lica\s+(?:nele|aqui|no\s+vídeo)/i,
];

export function validateScript(
  script: string,
  opts: { targetWords: number; minWords: number; isShort?: boolean }
): ValidationResult {
  const issues: string[] = [];
  const repairActions: RepairAction[] = [];

  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const meetsLengthTarget = wordCount >= opts.minWords;
  if (!meetsLengthTarget) {
    issues.push(`Roteiro tem ${wordCount} palavras, abaixo do mínimo ${opts.minWords}`);
  }

  // ── Slop score ──
  const slop = calculateSlopScore(script);
  if (slop.score > 30) {
    issues.push(`Slop score alto (${slop.score}/100): ${slop.issues.slice(0, 3).join("; ")}`);
  }
  if (slop.score > 50) {
    repairActions.push({ type: "boost_density", reason: `Slop score ${slop.score} acima de 50` });
  }

  // ── Hook strength (first 400 chars) ──
  const hookSection = script.slice(0, 400);
  let hookHits = 0;
  for (const pat of HOOK_SIGNALS) {
    if (pat.test(hookSection)) hookHits++;
  }
  const hookStrength = Math.min(10, hookHits * 2.5);
  if (hookStrength < 5) {
    issues.push(`Hook fraco: apenas ${hookHits} sinais detectados nos primeiros 400 chars`);
    repairActions.push({
      type: "rewrite_hook",
      reason: `Hook strength ${hookStrength}/10 — refazer primeiros 30s`,
      startChar: 0,
      endChar: 400,
    });
  }

  // ── Dopamine count ──
  let dopamineCount = 0;
  for (const pat of DOPAMINE_MARKERS) {
    const matches = script.match(pat);
    if (matches) dopamineCount += matches.length;
  }
  const expectedDopamine = opts.isShort ? 2 : Math.max(3, Math.floor(wordCount / 200));
  if (dopamineCount < expectedDopamine) {
    issues.push(`Dopamine baixo: ${dopamineCount} (esperado ${expectedDopamine}+)`);
  }

  // ── Technical tags (must not appear) ──
  let tagsFound = 0;
  for (const pat of TAG_PATTERNS) {
    const m = script.match(pat);
    if (m) tagsFound += m.length;
  }
  const hasTechnicalTags = tagsFound > 0;
  if (hasTechnicalTags) {
    issues.push(`${tagsFound} tag(s) técnica(s) encontrada(s) — devem ser removidas`);
    repairActions.push({ type: "remove_tags", reason: `${tagsFound} tag(s) detectada(s)` });
  }

  // ── Ending: farewell vs binge loop ──
  const ending = script.slice(-600);
  const hasFarewell = FAREWELL_PATTERNS.some((p) => p.test(ending));
  const hasBingeLoop = !opts.isShort && BINGE_LOOP_SIGNALS.some((p) => p.test(ending));

  if (hasFarewell) {
    issues.push("Despedida genérica detectada no final (destrói Session Time)");
    repairActions.push({
      type: "rewrite_ending",
      reason: "Substituir despedida por Binge Loop",
      startChar: script.length - 600,
      endChar: script.length,
    });
  } else if (!opts.isShort && !hasBingeLoop) {
    issues.push("Final sem Binge Loop claro — pode reduzir Session Time");
    repairActions.push({
      type: "rewrite_ending",
      reason: "Adicionar Binge Loop nos últimos 60s",
      startChar: script.length - 600,
      endChar: script.length,
    });
  }

  const passed = issues.length === 0 || (
    !hasTechnicalTags &&
    !hasFarewell &&
    hookStrength >= 5 &&
    slop.score <= 50 &&
    meetsLengthTarget
  );

  return {
    passed,
    slopScore: slop.score,
    hookStrength,
    dopamineCount,
    hasBingeLoop,
    hasTechnicalTags,
    wordCount,
    meetsLengthTarget,
    issues,
    repairActions,
  };
}

// ─── Quick local sanitizer: strip tags without LLM call ───
export function stripTechnicalTags(script: string): string {
  let out = script;
  for (const pat of TAG_PATTERNS) {
    out = out.replace(pat, "");
  }
  // Collapse multiple blank lines
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

// ─── Build a surgical repair prompt for a specific issue ───
export function buildRepairPrompt(action: RepairAction, fullScript: string, opts: { topic: string; language: string }): { system: string; user: string } {
  const { topic, language } = opts;

  switch (action.type) {
    case "rewrite_hook":
      return {
        system: `Você é um EDITOR DE HOOKS de YouTube. Sua única missão: reescrever os primeiros 30 segundos para serem IMPOSSÍVEIS de ignorar.
Regras: frases curtas (3-8 palavras), 1 detalhe sensorial específico, 1 número exato, 1 open loop. ZERO tags. Idioma: ${language}.`,
        user: `Tópico: "${topic}"\n\nHook atual (FRACO):\n"${fullScript.slice(0, 400)}"\n\nReescreva APENAS os primeiros ~80 palavras. Use Cold Open ou Dato Impossível. Retorne só o novo hook (texto puro de narração).`,
      };

    case "rewrite_ending":
      return {
        system: `Você é um EDITOR DE FINAIS de YouTube. Substitua o final por um BINGE LOOP que conecta ao próximo vídeo.
Fórmula: "[Resolução]. Mas isso abre uma pergunta ainda mais [adj]: [pergunta]. Eu explico tudo nesse vídeo que aparece na sua tela agora."
PROIBIDO: "Obrigado por assistir", "Deixe o like", qualquer despedida. Idioma: ${language}.`,
        user: `Tópico: "${topic}"\n\nFinal atual (com despedida ou sem binge loop):\n"${fullScript.slice(-600)}"\n\nReescreva APENAS os últimos ~80 palavras com Binge Loop. Mantenha a resolução do tema. Retorne só o novo final.`,
      };

    case "boost_density":
      return {
        system: `Você é um EDITOR ANTI-SLOP. Pegue o roteiro e reescreva os parágrafos com mais frases vazias/genéricas, mantendo a história.
Substitua superlativos ("incrível", "fantástico") por dados específicos. Quebre frases longas. Idioma: ${language}.`,
        user: `Tópico: "${topic}"\n\nRoteiro atual:\n"${fullScript.slice(0, 4000)}"\n\nReescreva mantendo a estrutura mas eliminando frases vazias. Retorne o texto polido.`,
      };

    case "remove_tags":
      // Handled locally by stripTechnicalTags — no LLM needed
      return { system: "", user: "" };
  }
}

// ═══════════════════════════════════════════════════════════════
// FIDELITY SCORE — How closely does the generated script match
// the patterns of the user's reference (model) channel?
// 100% deterministic, zero LLM cost.
// ═══════════════════════════════════════════════════════════════
export interface FidelityBreakdown {
  hook_match: { score: number; detail: string };
  title_pattern: { score: number; detail: string };
  pacing: { score: number; detail: string };
  dopamine_density: { score: number; detail: string };
  angle_alignment: { score: number; detail: string };
}
export interface FidelityResult {
  score: number;            // 0-100 weighted
  channel_name: string | null;
  breakdown: FidelityBreakdown;
}

interface IntelLike {
  patterns?: { title_patterns?: string[]; hook_types?: string[]; pacing?: string };
  strategy?: { angles_to_steal?: string[]; video_ideas?: string[] };
  title_patterns?: string[];
  hook_types?: string[];
  pacing?: string;
}

/**
 * Try to detect simple "patterns" (e.g., "começa com número", "pergunta retórica")
 * inside hook section of the script.
 */
function checkHookMatch(script: string, hookTypes: string[]): { score: number; detail: string } {
  if (!hookTypes || hookTypes.length === 0) return { score: 50, detail: "Sem padrões de hook do canal modelo" };
  const head = script.slice(0, 600).toLowerCase();
  let hits = 0;
  const matched: string[] = [];
  for (const ht of hookTypes.slice(0, 6)) {
    const lower = ht.toLowerCase();
    // crude keyword matching with stems
    const stems = lower.match(/\b[a-záéíóúãõâêô]{4,}\b/gi) || [];
    const stemHits = stems.filter((s) => head.includes(s)).length;
    if (stemHits >= 2 || /número|numero|pergunt|cold.?open|conflito|contradição/.test(lower) && /\d|\?|mas|porém/.test(head)) {
      hits++;
      matched.push(ht);
    }
  }
  const score = Math.min(100, Math.round((hits / Math.max(1, Math.min(hookTypes.length, 6))) * 100));
  return { score, detail: matched.length ? `Padrões detectados: ${matched.slice(0, 2).join("; ")}` : "Nenhum padrão de hook do modelo detectado" };
}

function checkTitlePattern(script: string, titlePatterns: string[]): { score: number; detail: string } {
  if (!titlePatterns || titlePatterns.length === 0) return { score: 50, detail: "Sem padrões de título do canal modelo" };
  // We score the FIRST sentence (often used as on-screen title) against the patterns
  const firstLine = script.split(/[.\n!?]/)[0]?.toLowerCase() || "";
  const hasNumber = /\d/.test(firstLine);
  const hasQuestion = script.slice(0, 300).includes("?");
  const wantsNumber = titlePatterns.some((t) => /\d|número|numero/i.test(t));
  const wantsQuestion = titlePatterns.some((t) => /pergunt|\?/i.test(t));
  let score = 60;
  const notes: string[] = [];
  if (wantsNumber) {
    if (hasNumber) { score += 20; notes.push("✅ número presente"); }
    else { score -= 15; notes.push("❌ falta número"); }
  }
  if (wantsQuestion) {
    if (hasQuestion) { score += 15; notes.push("✅ pergunta presente"); }
    else { score -= 10; notes.push("❌ falta pergunta"); }
  }
  return { score: Math.max(0, Math.min(100, score)), detail: notes.join(" · ") || "padrão neutro" };
}

function checkPacing(script: string, pacingHint: string | undefined, isShort: boolean): { score: number; detail: string } {
  // Approximate pacing by counting paragraph + sentence lengths
  const sentences = script.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return { score: 0, detail: "roteiro vazio" };
  const avgWords = sentences.reduce((s, x) => s + x.trim().split(/\s+/).length, 0) / sentences.length;
  const targetMin = isShort ? 6 : 10;
  const targetMax = isShort ? 14 : 22;
  let score = 70;
  let detail = `~${avgWords.toFixed(1)} palavras/frase`;
  if (avgWords < targetMin) { score -= 15; detail += " (muito curto)"; }
  else if (avgWords > targetMax) { score -= 20; detail += " (muito longo — pode cansar)"; }
  else { score += 20; detail += " (ritmo na faixa)"; }
  if (pacingHint && /rápid|veloz|fast|punch/i.test(pacingHint) && avgWords > 14) score -= 10;
  return { score: Math.max(0, Math.min(100, score)), detail };
}

function checkDopamine(script: string, isShort: boolean): { score: number; detail: string } {
  let count = 0;
  for (const pat of DOPAMINE_MARKERS) {
    const m = script.match(pat);
    if (m) count += m.length;
  }
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const expected = isShort ? 2 : Math.max(3, Math.floor(wordCount / 200));
  const ratio = count / expected;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return { score, detail: `${count} dopamina markers (esperado ${expected}+)` };
}

function checkAngleAlignment(script: string, angles: string[]): { score: number; detail: string } {
  if (!angles || angles.length === 0) return { score: 60, detail: "Sem ângulos definidos no canal modelo" };
  const lower = script.toLowerCase();
  let hits = 0;
  const matched: string[] = [];
  for (const a of angles.slice(0, 5)) {
    const stems = a.toLowerCase().match(/\b[a-záéíóúãõâêô]{5,}\b/gi) || [];
    const stemHits = stems.filter((s) => lower.includes(s)).length;
    if (stemHits >= 2) {
      hits++;
      matched.push(a.slice(0, 60));
    }
  }
  const score = Math.min(100, Math.round((hits / Math.max(1, Math.min(angles.length, 5))) * 100));
  return { score, detail: matched.length ? `${hits} ângulo(s) aplicado(s)` : "Nenhum ângulo do modelo detectado" };
}

export function computeFidelityScore(
  script: string,
  modelChannel: { channel_name: string; intel: IntelLike } | null,
  opts: { isShort?: boolean } = {},
): FidelityResult {
  const isShort = !!opts.isShort;
  if (!modelChannel || !modelChannel.intel) {
    return {
      score: 0,
      channel_name: null,
      breakdown: {
        hook_match: { score: 0, detail: "Sem canal modelo" },
        title_pattern: { score: 0, detail: "Sem canal modelo" },
        pacing: { score: 0, detail: "Sem canal modelo" },
        dopamine_density: { score: 0, detail: "Sem canal modelo" },
        angle_alignment: { score: 0, detail: "Sem canal modelo" },
      },
    };
  }
  const intel = modelChannel.intel;
  const hookTypes = intel.patterns?.hook_types || intel.hook_types || [];
  const titlePatterns = intel.patterns?.title_patterns || intel.title_patterns || [];
  const pacingHint = intel.patterns?.pacing || intel.pacing;
  const angles = intel.strategy?.angles_to_steal || [];

  const breakdown: FidelityBreakdown = {
    hook_match: checkHookMatch(script, hookTypes),
    title_pattern: checkTitlePattern(script, titlePatterns),
    pacing: checkPacing(script, pacingHint, isShort),
    dopamine_density: checkDopamine(script, isShort),
    angle_alignment: checkAngleAlignment(script, angles),
  };

  // Weighted average — hook + angle weigh most because they define editorial fingerprint
  const weighted =
    breakdown.hook_match.score * 0.30 +
    breakdown.angle_alignment.score * 0.25 +
    breakdown.dopamine_density.score * 0.20 +
    breakdown.pacing.score * 0.15 +
    breakdown.title_pattern.score * 0.10;

  return {
    score: Math.round(weighted),
    channel_name: modelChannel.channel_name,
    breakdown,
  };
}
