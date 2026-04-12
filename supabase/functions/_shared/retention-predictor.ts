/**
 * RETENTION PREDICTOR V3 — 10/10 Quality System
 * 
 * Second-by-second retention prediction based on:
 * 1. Script structural analysis (hooks, pattern interrupts, open loops)
 * 2. Real performance data from content_dna + video_performance
 * 3. Niche-specific decay curves from attention_curves
 * 4. NEW: Dopamine trigger detection
 * 5. NEW: Information density analysis
 * 6. NEW: Emotional arc scoring
 * 7. NEW: Pacing rhythm analysis
 * 
 * Used by: score-script, generate-script, video-orchestrator
 */

interface RetentionPoint {
  second: number;
  predicted_retention: number;
  event: string | null;
  risk_level: 'safe' | 'warning' | 'danger';
}

interface RetentionAnalysis {
  curve: RetentionPoint[];
  avg_predicted_retention: number;
  drop_zones: { second: number; severity: number; cause: string; fix: string }[];
  hook_strength: number;
  pattern_interrupt_count: number;
  open_loop_count: number;
  binge_loop_detected: boolean;
  emotion_transitions: number;
  estimated_avd_seconds: number;
  grade: string;
  // NEW v3 fields
  dopamine_triggers: number;
  info_density_score: number;
  pacing_score: number;
  narrative_weapons_detected: string[];
  improvement_suggestions: string[];
}

// Niche-specific base retention curves (expanded in v3)
const NICHE_BASE_CURVES: Record<string, { decay_rate: number; hook_bonus: number; avg_retention: number; death_zones: number[] }> = {
  'true_crime': { decay_rate: 0.008, hook_bonus: 15, avg_retention: 55, death_zones: [30, 150, 420] },
  'terror': { decay_rate: 0.007, hook_bonus: 12, avg_retention: 58, death_zones: [30, 180, 480] },
  'curiosidades': { decay_rate: 0.012, hook_bonus: 10, avg_retention: 45, death_zones: [25, 120, 300] },
  'finanças': { decay_rate: 0.010, hook_bonus: 8, avg_retention: 48, death_zones: [30, 150, 360] },
  'tecnologia': { decay_rate: 0.011, hook_bonus: 9, avg_retention: 46, death_zones: [25, 120, 300] },
  'documentário': { decay_rate: 0.006, hook_bonus: 14, avg_retention: 60, death_zones: [30, 180, 480] },
  'storytelling': { decay_rate: 0.005, hook_bonus: 16, avg_retention: 62, death_zones: [30, 180, 540] },
  'mitologia': { decay_rate: 0.007, hook_bonus: 13, avg_retention: 56, death_zones: [30, 180, 420] },
  'gaming': { decay_rate: 0.013, hook_bonus: 11, avg_retention: 42, death_zones: [20, 90, 240] },
  'educativo': { decay_rate: 0.009, hook_bonus: 7, avg_retention: 50, death_zones: [30, 150, 360] },
  'ciência': { decay_rate: 0.008, hook_bonus: 10, avg_retention: 52, death_zones: [30, 150, 360] },
  'webdocumentário': { decay_rate: 0.005, hook_bonus: 15, avg_retention: 63, death_zones: [30, 180, 540] },
  'default': { decay_rate: 0.010, hook_bonus: 10, avg_retention: 48, death_zones: [30, 150, 360] },
};

// Script event detectors (expanded v3)
const HOOK_PATTERNS = [
  /^.{0,200}(imagine|e se eu|você não vai|prepare-se|atenção|cuidado|alerta|urgente)/i,
  /^.{0,200}(\$[\d,.]+|R\$[\d,.]+|\d{1,3}(,\d{3})+)/,
  /^.{0,200}(morreu|matou|desapareceu|explodiu|destruiu)/i,
  /^.{0,200}(ninguém|nunca|impossível|proibido|secreto|escondido)/i,
  /^.{0,100}["""]/,  // Starts with dialogue
  /^.{0,50}\d+\.?\d*/,  // Starts with number
];

const PATTERN_INTERRUPT_MARKERS = [
  /\.\s*\n\n[A-Z]/g, // Abrupt paragraph breaks
  /\.\.\.\s*\n/g, // Ellipsis breaks
  /[!?]\s*\n\n/g, // Exclamation/question breaks
  /\n\n.{3,20}\.\s*\n\n/g, // Short solo paragraph (impact)
];

const OPEN_LOOP_MARKERS = [
  /mas (antes|primeiro|espera)/gi,
  /o (problema|detalhe|segredo) é/gi,
  /e (foi aí|aqui é onde|é aqui) que/gi,
  /ninguém (percebeu|sabia|esperava)/gi,
  /\.\.\.\s*$/gm,
  /daqui a pouco/gi,
  /vou te (contar|mostrar|explicar)/gi,
  /lembra d[eoa]/gi,
];

const EMOTION_SHIFT_MARKERS = [
  /\n\n.*?(mas|porém|contudo|no entanto)/gi,
  /(riso|gargalh|humor).*?(morte|morr|destrui)/gi,
  /(esperança|alegria|felicidade).*?(devastação|horror|tragédia)/gi,
  /\n\n.{5,30}\.\s*\n/g, // Short emotional punch line
];

// NEW v3: Dopamine trigger detection
const DOPAMINE_MARKERS = [
  /\d{3,}[\d,.]*\s*(milhõ|bilhõ|trilhõ|dólar|real|reais|\$|%)/gi, // Specific numbers
  /pela primeira vez/gi,
  /nunca (antes|mais|ninguém)/gi,
  /(maior|menor|primeiro|último|único) (da|do|de) (todo|toda|todos)/gi,
  /o que (ninguém|poucos|apenas)/gi,
  /a resposta é/gi,
  /e foi (exatamente|aí|quando)/gi,
];

// NEW v3: Narrative weapon detection
const NARRATIVE_WEAPON_PATTERNS: Record<string, RegExp[]> = {
  'chekhov_gun': [/lembra d[eoa]|você deve estar pensando.*?por quê/gi],
  'emotional_whiplash': [/(ri[uo]|gargalh|feliz|alegr).*?\n.*?(morr|caixão|funeral|destrui|devastad)/gi],
  'rule_of_three': [/(primeir|segund|terceir).+\.\s*(primeir|segund|terceir).+\.\s*(primeir|segund|terceir)/gi],
  'unreliable_narrator': [/(eu ia dizer|espera.*errei|na verdade.*risca|eu confesso)/gi],
  'temporal_juxtaposition': [/em \d{4}.*em \d{4}/gi, /\d+ (anos|meses|dias) (antes|depois)/gi],
  'silence': [/nunca mais fal|nunca respondeu|silêncio.*que (dur|peso)/gi],
};

// NEW v3: Pacing analysis
function analyzePacing(script: string): { score: number; issues: string[] } {
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length < 5) return { score: 50, issues: [] };

  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const issues: string[] = [];
  let score = 70;

  // Check for short-long alternation (good pacing)
  let alternations = 0;
  for (let i = 1; i < lengths.length; i++) {
    const prevShort = lengths[i - 1] <= 8;
    const currShort = lengths[i] <= 8;
    if (prevShort !== currShort) alternations++;
  }
  const alternationRate = alternations / (lengths.length - 1);
  if (alternationRate > 0.5) score += 15;
  else if (alternationRate < 0.2) {
    score -= 15;
    issues.push('Ritmo monótono — alterne frases curtas (3-8 palavras) com longas');
  }

  // Check for impact sentences (very short, standalone)
  const impactSentences = lengths.filter(l => l <= 4).length;
  if (impactSentences >= 3) score += 10;
  else {
    issues.push('Faltam frases de impacto (1-4 palavras sozinhas como parágrafo)');
  }

  // Check for uniform sentence length (bad)
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((s, l) => s + Math.pow(l - avgLen, 2), 0) / lengths.length;
  if (variance < 10) {
    score -= 10;
    issues.push('Variância de comprimento muito baixa — texto soa robótico');
  } else if (variance > 40) {
    score += 5;
  }

  // Check for consecutive long sentences (fatigue)
  let maxConsecutiveLong = 0;
  let consecutiveLong = 0;
  for (const l of lengths) {
    if (l > 15) { consecutiveLong++; maxConsecutiveLong = Math.max(maxConsecutiveLong, consecutiveLong); }
    else consecutiveLong = 0;
  }
  if (maxConsecutiveLong >= 3) {
    score -= 10;
    issues.push(`${maxConsecutiveLong} frases longas consecutivas — quebra de atenção provável`);
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// NEW v3: Information density analysis
function analyzeInfoDensity(script: string): number {
  const words = script.split(/\s+/).length;
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 5);

  // Count "insight markers" — numbers, comparisons, revelations
  const numbers = (script.match(/\d+/g) || []).length;
  const comparisons = (script.match(/(como se|é como|equivalente|vezes? (maior|menor|mais)|%|por cento)/gi) || []).length;
  const revelations = (script.match(/(descobr|revel|secret|escon|desconhecid|pela primeira vez|nunca antes)/gi) || []).length;
  const questions = (script.match(/\?/g) || []).length;

  const totalInsights = numbers + comparisons + revelations + questions;
  const insightsPerSentence = totalInsights / Math.max(1, sentences.length);

  // Target: ~0.5-1.0 insights per sentence
  if (insightsPerSentence >= 0.8) return 90;
  if (insightsPerSentence >= 0.5) return 75;
  if (insightsPerSentence >= 0.3) return 55;
  return 35;
}

export function predictRetention(
  script: string,
  durationSeconds: number,
  niche: string = 'default',
  realBenchmarks?: { avg_retention: number; sample_count: number }
): RetentionAnalysis {
  const nicheKey = Object.keys(NICHE_BASE_CURVES).find(k => niche.toLowerCase().includes(k)) || 'default';
  const baseCurve = NICHE_BASE_CURVES[nicheKey];

  const baseRetention = realBenchmarks?.avg_retention && realBenchmarks.sample_count >= 10
    ? realBenchmarks.avg_retention
    : baseCurve.avg_retention;

  const words = script.split(/\s+/);
  const totalWords = words.length;
  const wordsPerSecond = totalWords / durationSeconds;

  // Detect structural elements
  const hookStrength = calculateHookStrength(script);
  const patternInterrupts = detectPatternInterrupts(script);
  const openLoops = detectOpenLoops(script);
  const emotionTransitions = detectEmotionShifts(script);
  const hasBingeLoop = detectBingeLoop(script);
  const dopamineTriggers = detectDopamineTriggers(script);
  const narrativeWeapons = detectNarrativeWeapons(script);
  const pacing = analyzePacing(script);
  const infoDensity = analyzeInfoDensity(script);

  // Build second-by-second curve
  const curve: RetentionPoint[] = [];
  const dropZones: { second: number; severity: number; cause: string; fix: string }[] = [];

  let retention = Math.min(100, baseRetention + hookStrength * 0.5);

  const eventMap = buildEventMap(script, durationSeconds, wordsPerSecond);

  for (let sec = 0; sec <= durationSeconds; sec += 5) {
    const decayFactor = baseCurve.decay_rate * (1 + sec / durationSeconds * 0.3);
    retention -= decayFactor * 5;

    // Hook bonus (first 30s)
    if (sec <= 30) {
      retention += (baseCurve.hook_bonus * hookStrength / 100) * (1 - sec / 30) * 0.2;
    }

    // Death zones with niche-specific timing
    for (const dz of baseCurve.death_zones) {
      if (sec >= dz - 10 && sec <= dz + 10) retention -= 1.2;
    }

    // Pattern interrupt boost
    const nearbyPI = eventMap.filter(e => e.type === 'pattern_interrupt' && Math.abs(e.second - sec) < 15);
    if (nearbyPI.length > 0) retention += 2.5 * nearbyPI.length;

    // Open loop boost
    const nearbyOL = eventMap.filter(e => e.type === 'open_loop' && Math.abs(e.second - sec) < 20);
    if (nearbyOL.length > 0) retention += 1.5 * nearbyOL.length;

    // Emotion shift boost
    const nearbyES = eventMap.filter(e => e.type === 'emotion_shift' && Math.abs(e.second - sec) < 10);
    if (nearbyES.length > 0) retention += 3.0;

    // NEW: Dopamine trigger boost
    const nearbyDT = eventMap.filter(e => e.type === 'dopamine_trigger' && Math.abs(e.second - sec) < 15);
    if (nearbyDT.length > 0) retention += 2.0 * nearbyDT.length;

    // Binge loop at end
    if (hasBingeLoop && sec >= durationSeconds - 30) retention += 2.0;

    // Pacing bonus (good pacing reduces decay)
    if (pacing.score > 70) retention += 0.3;

    // Clamp
    retention = Math.max(5, Math.min(100, retention));

    const event = eventMap.find(e => Math.abs(e.second - sec) < 3)?.type || null;
    const riskLevel: 'safe' | 'warning' | 'danger' =
      retention >= 50 ? 'safe' : retention >= 30 ? 'warning' : 'danger';

    curve.push({ second: sec, predicted_retention: Math.round(retention * 10) / 10, event, risk_level: riskLevel });

    // Detect drops with fix suggestions
    if (curve.length >= 2) {
      const prev = curve[curve.length - 2];
      const drop = prev.predicted_retention - retention;
      if (drop > 5) {
        let cause = 'natural_decay';
        let fix = 'Insira dado chocante ou virada narrativa';
        
        for (const dz of baseCurve.death_zones) {
          if (sec >= dz - 10 && sec <= dz + 10) {
            cause = `death_zone_${dz}s`;
            if (dz <= 35) fix = 'O hook não criou urgência suficiente — reescreva com COLD OPEN ou DADO IMPOSSÍVEL';
            else if (dz <= 200) fix = 'Falta escalada narrativa — insira revelação surpreendente ou emotional whiplash';
            else fix = 'Fadiga de atenção — insira MAIOR pattern interrupt (mudança brusca de perspectiva/tom)';
            break;
          }
        }
        
        dropZones.push({ second: sec, severity: Math.round(drop * 10) / 10, cause, fix });
      }
    }
  }

  const avgRetention = curve.reduce((s, p) => s + p.predicted_retention, 0) / curve.length;
  const estimatedAvd = durationSeconds * (avgRetention / 100);

  // Generate improvement suggestions
  const suggestions: string[] = [];
  if (hookStrength < 60) suggestions.push('Hook fraco — use COLD OPEN com detalhe sensorial + número específico');
  if (patternInterrupts < Math.floor(durationSeconds / 60)) suggestions.push(`Faltam pattern interrupts — deveria ter ~${Math.floor(durationSeconds / 60)} para este vídeo`);
  if (openLoops < 3) suggestions.push('Poucos open loops — plante pelo menos 3 mistérios para resolver depois');
  if (emotionTransitions < Math.floor(durationSeconds / 120)) suggestions.push('Monotonia emocional — varie emoções a cada 45-60s');
  if (!hasBingeLoop) suggestions.push('Sem binge hook no final — adicione gancho para próximo vídeo');
  if (dopamineTriggers < 5) suggestions.push('Poucos gatilhos de dopamina — adicione números específicos, revelações e conexões');
  if (narrativeWeapons.length < 2) suggestions.push('Poucas armas narrativas — use Chekhov\'s Gun, Emotional Whiplash ou Rule of Three');
  if (pacing.score < 60) suggestions.push(...pacing.issues);
  if (infoDensity < 50) suggestions.push('Densidade informacional baixa — cada frase deve avançar a narrativa');

  let grade = 'F';
  if (avgRetention >= 70) grade = 'S';
  else if (avgRetention >= 60) grade = 'A';
  else if (avgRetention >= 50) grade = 'B';
  else if (avgRetention >= 40) grade = 'C';
  else if (avgRetention >= 30) grade = 'D';

  return {
    curve,
    avg_predicted_retention: Math.round(avgRetention * 10) / 10,
    drop_zones: dropZones,
    hook_strength: hookStrength,
    pattern_interrupt_count: patternInterrupts,
    open_loop_count: openLoops,
    binge_loop_detected: hasBingeLoop,
    emotion_transitions: emotionTransitions,
    estimated_avd_seconds: Math.round(estimatedAvd),
    grade,
    dopamine_triggers: dopamineTriggers,
    info_density_score: infoDensity,
    pacing_score: pacing.score,
    narrative_weapons_detected: narrativeWeapons,
    improvement_suggestions: suggestions,
  };
}

function calculateHookStrength(script: string): number {
  const first300 = script.slice(0, 300);
  let score = 20; // base (lower start in v3 for stricter grading)

  for (const p of HOOK_PATTERNS) {
    if (p.test(first300)) score += 12;
  }

  const firstSentence = first300.split(/[.!?]/)[0] || '';
  const firstWords = firstSentence.split(/\s+/).length;
  if (firstWords <= 5) score += 15;
  else if (firstWords <= 8) score += 10;
  else if (firstWords <= 12) score += 5;

  if (/\d/.test(firstSentence)) score += 8;
  if (/\?/.test(first300.slice(0, 150))) score += 5;

  // v3: Check for sensory details in hook
  if (/trem|suor|frio|calor|cheiro|gosto|silêncio|escuro/i.test(first300)) score += 8;

  // v3: Check for dialogue in hook
  if (/["""""]/g.test(first300.slice(0, 100))) score += 5;

  // v3: Penalty for weak openings
  if (/^(neste|hoje|vamos|olá|e aí|fala|bom dia)/i.test(first300.trim())) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function detectPatternInterrupts(script: string): number {
  let count = 0;
  for (const marker of PATTERN_INTERRUPT_MARKERS) {
    const matches = script.match(marker);
    if (matches) count += matches.length;
  }
  return count;
}

function detectOpenLoops(script: string): number {
  let count = 0;
  for (const marker of OPEN_LOOP_MARKERS) {
    const matches = script.match(marker);
    if (matches) count += matches.length;
  }
  return count;
}

function detectEmotionShifts(script: string): number {
  let count = 0;
  for (const marker of EMOTION_SHIFT_MARKERS) {
    const matches = script.match(marker);
    if (matches) count += matches.length;
  }
  return count;
}

function detectDopamineTriggers(script: string): number {
  let count = 0;
  for (const marker of DOPAMINE_MARKERS) {
    const matches = script.match(marker);
    if (matches) count += matches.length;
  }
  return count;
}

function detectNarrativeWeapons(script: string): string[] {
  const found: string[] = [];
  for (const [weapon, patterns] of Object.entries(NARRATIVE_WEAPON_PATTERNS)) {
    for (const p of patterns) {
      if (p.test(script)) {
        found.push(weapon);
        break;
      }
    }
  }
  return found;
}

function detectBingeLoop(script: string): boolean {
  const last500 = script.slice(-500);
  const goodbyePatterns = /obrigad[oa]|tchau|até (a próxima|mais)|se inscrev|deixe? (o|seu) like/i;
  const bingePatterns = /mas isso|no próximo|o que acontece|a história não|continua|parte (2|dois|II)|próximo vídeo/i;

  if (goodbyePatterns.test(last500)) return false;
  if (bingePatterns.test(last500)) return true;

  const lastLine = last500.split('\n').filter(l => l.trim()).pop() || '';
  if (/\.{3}|\?$/.test(lastLine.trim())) return true;

  return false;
}

interface ScriptEvent {
  second: number;
  type: 'pattern_interrupt' | 'open_loop' | 'emotion_shift' | 'dopamine_trigger';
}

function buildEventMap(script: string, duration: number, wps: number): ScriptEvent[] {
  const events: ScriptEvent[] = [];
  const lines = script.split('\n');
  let wordCount = 0;

  for (const line of lines) {
    const lineWords = line.split(/\s+/).filter(Boolean).length;
    const second = Math.round(wordCount / wps);

    for (const marker of PATTERN_INTERRUPT_MARKERS) {
      if (marker.test(line)) { events.push({ second, type: 'pattern_interrupt' }); break; }
    }
    for (const marker of OPEN_LOOP_MARKERS) {
      if (marker.test(line)) { events.push({ second, type: 'open_loop' }); break; }
    }
    for (const marker of EMOTION_SHIFT_MARKERS) {
      if (marker.test(line)) { events.push({ second, type: 'emotion_shift' }); break; }
    }
    for (const marker of DOPAMINE_MARKERS) {
      if (marker.test(line)) { events.push({ second, type: 'dopamine_trigger' }); break; }
    }

    wordCount += lineWords;
  }

  return events.filter(e => e.second <= duration);
}
