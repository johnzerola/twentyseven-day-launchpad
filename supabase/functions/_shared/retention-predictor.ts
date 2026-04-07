/**
 * RETENTION PREDICTOR V2
 * 
 * Second-by-second retention prediction based on:
 * 1. Script structural analysis (hooks, pattern interrupts, open loops)
 * 2. Real performance data from content_dna + video_performance
 * 3. Niche-specific decay curves from attention_curves
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
  drop_zones: { second: number; severity: number; cause: string }[];
  hook_strength: number; // 0-100
  pattern_interrupt_count: number;
  open_loop_count: number;
  binge_loop_detected: boolean;
  emotion_transitions: number;
  estimated_avd_seconds: number; // Average View Duration
  grade: string;
}

// Niche-specific base retention curves (from real data patterns)
const NICHE_BASE_CURVES: Record<string, { decay_rate: number; hook_bonus: number; avg_retention: number }> = {
  'true_crime': { decay_rate: 0.008, hook_bonus: 15, avg_retention: 55 },
  'terror': { decay_rate: 0.007, hook_bonus: 12, avg_retention: 58 },
  'curiosidades': { decay_rate: 0.012, hook_bonus: 10, avg_retention: 45 },
  'finanças': { decay_rate: 0.010, hook_bonus: 8, avg_retention: 48 },
  'tecnologia': { decay_rate: 0.011, hook_bonus: 9, avg_retention: 46 },
  'documentário': { decay_rate: 0.006, hook_bonus: 14, avg_retention: 60 },
  'storytelling': { decay_rate: 0.005, hook_bonus: 16, avg_retention: 62 },
  'mitologia': { decay_rate: 0.007, hook_bonus: 13, avg_retention: 56 },
  'gaming': { decay_rate: 0.013, hook_bonus: 11, avg_retention: 42 },
  'educativo': { decay_rate: 0.009, hook_bonus: 7, avg_retention: 50 },
  'default': { decay_rate: 0.010, hook_bonus: 10, avg_retention: 48 },
};

// Script event detectors
const HOOK_PATTERNS = [
  /^.{0,200}(imagine|e se eu|você não vai|prepare-se|atenção|cuidado|alerta|urgente)/i,
  /^.{0,200}(\$[\d,.]+|R\$[\d,.]+|\d{1,3}(,\d{3})+)/,
  /^.{0,200}(morreu|matou|desapareceu|explodiu|destruiu)/i,
  /^.{0,200}(ninguém|nunca|impossível|proibido|secreto|escondido)/i,
];

const PATTERN_INTERRUPT_MARKERS = [
  /\[ÁUDIO:/gi, /\[TRILHA:/gi, /\[SFX:/gi, /\[CORTAR MÚSICA\]/gi,
  /\[J-CUT\]/gi, /\[B-ROLL\]/gi, /\[BLENDER:/gi, /\[AFTER EFFECTS:/gi,
  /\.\s*\n\n[A-Z]/g, // Abrupt paragraph breaks
  /\.\.\.\s*\n/g, // Ellipsis breaks
];

const OPEN_LOOP_MARKERS = [
  /mas (antes|primeiro|espera)/gi,
  /o (problema|detalhe|segredo) é/gi,
  /e (foi aí|aqui é onde|é aqui) que/gi,
  /ninguém (percebeu|sabia|esperava)/gi,
  /\.\.\.\s*$/gm,
];

const EMOTION_SHIFT_MARKERS = [
  /\n\n.*?(mas|porém|contudo|no entanto)/gi,
  /(riso|gargalh|humor).*?(morte|morr|destrui)/gi,
  /(esperança|alegria|felicidade).*?(devastação|horror|tragédia)/gi,
];

export function predictRetention(
  script: string,
  durationSeconds: number,
  niche: string = 'default',
  realBenchmarks?: { avg_retention: number; sample_count: number }
): RetentionAnalysis {
  const nicheKey = Object.keys(NICHE_BASE_CURVES).find(k => niche.toLowerCase().includes(k)) || 'default';
  const baseCurve = NICHE_BASE_CURVES[nicheKey];

  // Override with real benchmarks if available
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

  // Build second-by-second curve
  const curve: RetentionPoint[] = [];
  const dropZones: { second: number; severity: number; cause: string }[] = [];

  let retention = Math.min(100, baseRetention + hookStrength * 0.5);

  // Map structural events to timestamps
  const eventMap = buildEventMap(script, durationSeconds, wordsPerSecond);

  for (let sec = 0; sec <= durationSeconds; sec += 5) {
    // Natural decay
    const decayFactor = baseCurve.decay_rate * (1 + sec / durationSeconds * 0.3); // Accelerating decay
    retention -= decayFactor * 5;

    // Hook bonus (first 30s)
    if (sec <= 30) {
      retention += (baseCurve.hook_bonus * hookStrength / 100) * (1 - sec / 30) * 0.2;
    }

    // Death zones: apply extra penalty
    if (sec >= 25 && sec <= 35) retention -= 1.5; // 30s death zone
    if (sec >= 120 && sec <= 200) retention -= 0.8; // 2-3min death zone
    if (sec >= 300 && sec <= 420) retention -= 1.0; // 5-7min death zone

    // Pattern interrupt boost
    const nearbyPI = eventMap.filter(e => e.type === 'pattern_interrupt' && Math.abs(e.second - sec) < 15);
    if (nearbyPI.length > 0) retention += 2.5 * nearbyPI.length;

    // Open loop boost
    const nearbyOL = eventMap.filter(e => e.type === 'open_loop' && Math.abs(e.second - sec) < 20);
    if (nearbyOL.length > 0) retention += 1.5 * nearbyOL.length;

    // Emotion shift boost
    const nearbyES = eventMap.filter(e => e.type === 'emotion_shift' && Math.abs(e.second - sec) < 10);
    if (nearbyES.length > 0) retention += 3.0;

    // Binge loop at end
    if (hasBingeLoop && sec >= durationSeconds - 30) retention += 2.0;

    // Clamp
    retention = Math.max(5, Math.min(100, retention));

    const event = eventMap.find(e => Math.abs(e.second - sec) < 3)?.type || null;
    const riskLevel: 'safe' | 'warning' | 'danger' =
      retention >= 50 ? 'safe' : retention >= 30 ? 'warning' : 'danger';

    curve.push({ second: sec, predicted_retention: Math.round(retention * 10) / 10, event, risk_level: riskLevel });

    // Detect drops
    if (curve.length >= 2) {
      const prev = curve[curve.length - 2];
      const drop = prev.predicted_retention - retention;
      if (drop > 5) {
        let cause = 'natural_decay';
        if (sec >= 25 && sec <= 35) cause = '30s_death_zone';
        else if (sec >= 120 && sec <= 200) cause = '2-3min_fatigue';
        else if (sec >= 300 && sec <= 420) cause = '5-7min_fatigue';
        dropZones.push({ second: sec, severity: Math.round(drop * 10) / 10, cause });
      }
    }
  }

  const avgRetention = curve.reduce((s, p) => s + p.predicted_retention, 0) / curve.length;
  const estimatedAvd = durationSeconds * (avgRetention / 100);

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
  };
}

function calculateHookStrength(script: string): number {
  const first300 = script.slice(0, 300);
  let score = 30; // base

  // Check hook patterns
  for (const p of HOOK_PATTERNS) {
    if (p.test(first300)) score += 15;
  }

  // Short first sentence = stronger hook
  const firstSentence = first300.split(/[.!?]/)[0] || '';
  if (firstSentence.split(/\s+/).length <= 8) score += 10;
  if (firstSentence.split(/\s+/).length <= 5) score += 10;

  // Contains number in first sentence
  if (/\d/.test(firstSentence)) score += 5;

  // Contains question
  if (/\?/.test(first300.slice(0, 150))) score += 5;

  return Math.min(100, score);
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

function detectBingeLoop(script: string): boolean {
  const last500 = script.slice(-500);
  const goodbyePatterns = /obrigad[oa]|tchau|até (a próxima|mais)|se inscrev|deixe? (o|seu) like/i;
  const bingePatterns = /mas isso|no próximo|o que acontece|a história não|continua|parte (2|dois|II)/i;

  if (goodbyePatterns.test(last500)) return false;
  if (bingePatterns.test(last500)) return true;

  // Check if it ends on a cliffhanger (ellipsis, question, or incomplete thought)
  const lastLine = last500.split('\n').filter(l => l.trim()).pop() || '';
  if (/\.{3}|\?$/.test(lastLine.trim())) return true;

  return false;
}

interface ScriptEvent {
  second: number;
  type: 'pattern_interrupt' | 'open_loop' | 'emotion_shift';
}

function buildEventMap(script: string, duration: number, wps: number): ScriptEvent[] {
  const events: ScriptEvent[] = [];
  const lines = script.split('\n');
  let wordCount = 0;

  for (const line of lines) {
    const lineWords = line.split(/\s+/).filter(Boolean).length;
    const second = Math.round(wordCount / wps);

    // Check for pattern interrupts
    for (const marker of PATTERN_INTERRUPT_MARKERS) {
      if (marker.test(line)) {
        events.push({ second, type: 'pattern_interrupt' });
        break;
      }
    }

    // Check for open loops
    for (const marker of OPEN_LOOP_MARKERS) {
      if (marker.test(line)) {
        events.push({ second, type: 'open_loop' });
        break;
      }
    }

    // Check for emotion shifts
    for (const marker of EMOTION_SHIFT_MARKERS) {
      if (marker.test(line)) {
        events.push({ second, type: 'emotion_shift' });
        break;
      }
    }

    wordCount += lineWords;
  }

  return events.filter(e => e.second <= duration);
}
