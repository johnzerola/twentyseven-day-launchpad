import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * CALIBRATION ENGINE
 * Applies learned bias corrections and weight adjustments to AI-predicted scores.
 * Uses data from score_calibration table populated by self-learning-worker.
 */

interface CalibrationResult {
  original: number;
  calibrated: number;
  adjustment: number;
  confidence: number;
  source: string; // "calibration_table" | "default"
}

// Cache calibration data for 5 minutes within a single invocation
let _cache: Map<string, any> | null = null;
let _cacheTime = 0;

async function loadCalibrations(sb: any): Promise<Map<string, any>> {
  if (_cache && Date.now() - _cacheTime < 300_000) return _cache;

  const { data } = await sb.from("score_calibration")
    .select("score_type, niche, weight_adjustment, bias_correction, confidence, samples_count, avg_error")
    .gte("confidence", 0.1)
    .gte("samples_count", 3);

  const map = new Map<string, any>();
  for (const row of (data || [])) {
    map.set(`${row.score_type}:${row.niche}`, row);
    // Also store a "general" fallback per score_type
    const generalKey = `${row.score_type}:__general__`;
    const existing = map.get(generalKey);
    if (!existing || row.samples_count > existing.samples_count) {
      map.set(generalKey, { ...row, niche: "__general__" });
    }
  }

  _cache = map;
  _cacheTime = Date.now();
  return map;
}

/**
 * Calibrate a single score using learned adjustments.
 * Falls back to general niche calibration if specific niche not found.
 */
export async function calibrateScore(
  sb: any,
  scoreType: string, // "viral_probability" | "attention_score" | "ctr_prediction" | "retention_prediction"
  niche: string,
  rawScore: number,
): Promise<CalibrationResult> {
  const calibrations = await loadCalibrations(sb);

  // Try exact niche match first, then general fallback
  const cal = calibrations.get(`${scoreType}:${niche}`) ||
    calibrations.get(`${scoreType}:${niche.split("_")[0]}`) ||
    calibrations.get(`${scoreType}:__general__`);

  if (!cal || cal.confidence < 0.15) {
    return {
      original: rawScore,
      calibrated: rawScore,
      adjustment: 0,
      confidence: 0,
      source: "default",
    };
  }

  // Apply: calibrated = (raw * weight_adjustment) + bias_correction
  const adjusted = Math.round(
    Math.max(0, Math.min(100,
      (rawScore * cal.weight_adjustment) + cal.bias_correction
    )) * 10
  ) / 10;

  return {
    original: rawScore,
    calibrated: adjusted,
    adjustment: Math.round((adjusted - rawScore) * 10) / 10,
    confidence: cal.confidence,
    source: "calibration_table",
  };
}

/**
 * Batch calibrate multiple scores at once.
 */
export async function calibrateScores(
  sb: any,
  scores: Array<{ type: string; niche: string; value: number }>,
): Promise<CalibrationResult[]> {
  // Pre-load calibrations once
  await loadCalibrations(sb);
  return Promise.all(
    scores.map(s => calibrateScore(sb, s.type, s.niche, s.value))
  );
}

/**
 * Get calibration metadata for a niche (useful for UI badges like "est. IA" vs "calibrado")
 */
export async function getCalibrationStatus(
  sb: any,
  niche: string,
): Promise<{ hasRealData: boolean; sampleCount: number; avgError: number; confidence: number }> {
  const calibrations = await loadCalibrations(sb);
  const cal = calibrations.get(`viral_probability:${niche}`) ||
    calibrations.get(`viral_probability:__general__`);

  if (!cal) return { hasRealData: false, sampleCount: 0, avgError: 100, confidence: 0 };

  return {
    hasRealData: cal.samples_count >= 5,
    sampleCount: cal.samples_count,
    avgError: cal.avg_error,
    confidence: cal.confidence,
  };
}
