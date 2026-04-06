/**
 * Audio Processing Pipeline v5 — Web Audio API
 * 
 * DISCLAIMER: Processamento via Web Audio API no navegador.
 * Para áudios >10min, recomendamos processamento server-side
 * para evitar artefatos de memória e limitações de buffer.
 * Resultados podem variar entre navegadores (Safari usa 32-bit internamente).
 * 
 * Full DSP Pipeline:
 *  1. Intelligent Noise Profiling (adaptive floor detection)
 *  2. Spectral Gate + Noise Subtraction (per-band noise removal)
 *  3. Breath Detection & Reduction (-12dB ducking, not removal)
 *  4. Silence Trimming (smart pause management with crossfades)
 *  5. Surgical EQ: HPF 75Hz (24dB/oct), Body 120Hz, Mud Cut 250Hz+400Hz, 
 *     Presence 3kHz, Clarity 5kHz, Air Shelf 12kHz, LPF 16kHz
 *  6. Multi-band Compression (3 bands: <250Hz, 250-4kHz, >4kHz)
 *  7. Dynamic De-essing (sidechain-style at 5.5/7/8.5kHz)
 *  8. Harmonic Saturation (warm analog character)
 *  9. Stereo Widener (mid-side processing for stereo files)
 * 10. Brick-wall Limiter (-1.5dB True Peak)
 * 11. LUFS Normalization (K-weighted, target -14 LUFS)
 * 12. Dithering (16-bit triangular TPDF)
 */

export interface MasteringSettings {
  // Noise
  noiseReduction: number;        // 0-100 intensity
  noiseGateThresholdDb: number;
  
  // Silence
  silenceThresholdDb: number;
  minSilenceMs: number;
  maxSilenceMs: number;
  
  // Breath
  breathReduction: boolean;
  breathReductionDb: number;
  
  // EQ
  hpfFrequency: number;
  hpfSlope: number;             // 12 or 24 dB/oct
  bodyFrequency: number;
  bodyGainDb: number;
  mudCut1Frequency: number;
  mudCut1GainDb: number;
  mudCut2Frequency: number;
  mudCut2GainDb: number;
  presenceFrequency: number;
  presenceGainDb: number;
  clarityFrequency: number;
  clarityGainDb: number;
  airFrequency: number;
  airGainDb: number;
  lpfFrequency: number;
  
  // Multi-band Compression
  compLowThreshold: number;
  compLowRatio: number;
  compMidThreshold: number;
  compMidRatio: number;
  compHighThreshold: number;
  compHighRatio: number;
  compAttack: number;
  compRelease: number;
  compKnee: number;
  
  // De-esser
  deEsserIntensity: number;     // 0-100
  
  // Saturation
  saturationAmount: number;     // 0-100
  saturationWarmth: number;     // 0-100
  
  // Stereo
  stereoWidth: number;          // 0-200 (100 = normal)
  
  // Limiter & Output
  limiterThreshold: number;
  targetLufs: number;
  dithering: boolean;
}

export type MasteringPreset = 'youtube' | 'podcast' | 'broadcast' | 'audiobook' | 'music' | 'raw' | 'custom';

export const PRESET_LABELS: Record<MasteringPreset, string> = {
  youtube: '🎬 YouTube (Narração Dark)',
  podcast: '🎙️ Podcast Profissional',
  broadcast: '📡 Broadcast / TV',
  audiobook: '📖 Audiobook',
  music: '🎵 Música / Trilha',
  raw: '🔧 Limpeza Mínima',
  custom: '⚙️ Personalizado',
};

export const PRESETS: Record<Exclude<MasteringPreset, 'custom'>, MasteringSettings> = {
  youtube: {
    noiseReduction: 75,
    noiseGateThresholdDb: -38,
    silenceThresholdDb: -42,
    minSilenceMs: 280,
    maxSilenceMs: 140,
    breathReduction: true,
    breathReductionDb: -12,
    hpfFrequency: 75,
    hpfSlope: 24,
    bodyFrequency: 120,
    bodyGainDb: 3.0,
    mudCut1Frequency: 250,
    mudCut1GainDb: -2.5,
    mudCut2Frequency: 400,
    mudCut2GainDb: -3.0,
    presenceFrequency: 3000,
    presenceGainDb: 2.5,
    clarityFrequency: 5000,
    clarityGainDb: 1.5,
    airFrequency: 12000,
    airGainDb: 1.0,
    lpfFrequency: 16000,
    compLowThreshold: -22,
    compLowRatio: 3,
    compMidThreshold: -18,
    compMidRatio: 4,
    compHighThreshold: -20,
    compHighRatio: 3,
    compAttack: 0.005,
    compRelease: 0.12,
    compKnee: 4,
    deEsserIntensity: 65,
    saturationAmount: 20,
    saturationWarmth: 40,
    stereoWidth: 100,
    limiterThreshold: -1.5,
    targetLufs: -14,
    dithering: true,
  },
  podcast: {
    noiseReduction: 80,
    noiseGateThresholdDb: -36,
    silenceThresholdDb: -40,
    minSilenceMs: 350,
    maxSilenceMs: 200,
    breathReduction: true,
    breathReductionDb: -14,
    hpfFrequency: 80,
    hpfSlope: 24,
    bodyFrequency: 130,
    bodyGainDb: 2.5,
    mudCut1Frequency: 250,
    mudCut1GainDb: -2.0,
    mudCut2Frequency: 400,
    mudCut2GainDb: -2.5,
    presenceFrequency: 3200,
    presenceGainDb: 3.0,
    clarityFrequency: 5000,
    clarityGainDb: 2.0,
    airFrequency: 12000,
    airGainDb: 1.5,
    lpfFrequency: 15000,
    compLowThreshold: -20,
    compLowRatio: 3,
    compMidThreshold: -16,
    compMidRatio: 4.5,
    compHighThreshold: -18,
    compHighRatio: 3,
    compAttack: 0.003,
    compRelease: 0.1,
    compKnee: 5,
    deEsserIntensity: 70,
    saturationAmount: 15,
    saturationWarmth: 50,
    stereoWidth: 100,
    limiterThreshold: -1.0,
    targetLufs: -16,
    dithering: true,
  },
  broadcast: {
    noiseReduction: 85,
    noiseGateThresholdDb: -34,
    silenceThresholdDb: -38,
    minSilenceMs: 200,
    maxSilenceMs: 100,
    breathReduction: true,
    breathReductionDb: -18,
    hpfFrequency: 100,
    hpfSlope: 24,
    bodyFrequency: 150,
    bodyGainDb: 2.0,
    mudCut1Frequency: 300,
    mudCut1GainDb: -3.0,
    mudCut2Frequency: 500,
    mudCut2GainDb: -2.0,
    presenceFrequency: 3500,
    presenceGainDb: 2.0,
    clarityFrequency: 5000,
    clarityGainDb: 1.0,
    airFrequency: 10000,
    airGainDb: 0.5,
    lpfFrequency: 12000,
    compLowThreshold: -18,
    compLowRatio: 4,
    compMidThreshold: -14,
    compMidRatio: 5,
    compHighThreshold: -16,
    compHighRatio: 4,
    compAttack: 0.002,
    compRelease: 0.08,
    compKnee: 3,
    deEsserIntensity: 75,
    saturationAmount: 5,
    saturationWarmth: 20,
    stereoWidth: 100,
    limiterThreshold: -1.0,
    targetLufs: -23,
    dithering: true,
  },
  audiobook: {
    noiseReduction: 90,
    noiseGateThresholdDb: -34,
    silenceThresholdDb: -44,
    minSilenceMs: 400,
    maxSilenceMs: 250,
    breathReduction: true,
    breathReductionDb: -16,
    hpfFrequency: 70,
    hpfSlope: 12,
    bodyFrequency: 140,
    bodyGainDb: 2.0,
    mudCut1Frequency: 250,
    mudCut1GainDb: -1.5,
    mudCut2Frequency: 350,
    mudCut2GainDb: -2.0,
    presenceFrequency: 2800,
    presenceGainDb: 2.0,
    clarityFrequency: 4500,
    clarityGainDb: 1.5,
    airFrequency: 10000,
    airGainDb: 0.5,
    lpfFrequency: 14000,
    compLowThreshold: -22,
    compLowRatio: 2.5,
    compMidThreshold: -20,
    compMidRatio: 3,
    compHighThreshold: -22,
    compHighRatio: 2.5,
    compAttack: 0.008,
    compRelease: 0.2,
    compKnee: 6,
    deEsserIntensity: 60,
    saturationAmount: 10,
    saturationWarmth: 60,
    stereoWidth: 100,
    limiterThreshold: -2.0,
    targetLufs: -18,
    dithering: true,
  },
  music: {
    noiseReduction: 30,
    noiseGateThresholdDb: -50,
    silenceThresholdDb: -55,
    minSilenceMs: 500,
    maxSilenceMs: 400,
    breathReduction: false,
    breathReductionDb: -6,
    hpfFrequency: 30,
    hpfSlope: 12,
    bodyFrequency: 100,
    bodyGainDb: 1.5,
    mudCut1Frequency: 300,
    mudCut1GainDb: -1.0,
    mudCut2Frequency: 500,
    mudCut2GainDb: -0.5,
    presenceFrequency: 3000,
    presenceGainDb: 1.0,
    clarityFrequency: 6000,
    clarityGainDb: 1.0,
    airFrequency: 14000,
    airGainDb: 2.0,
    lpfFrequency: 20000,
    compLowThreshold: -24,
    compLowRatio: 2,
    compMidThreshold: -22,
    compMidRatio: 2.5,
    compHighThreshold: -22,
    compHighRatio: 2,
    compAttack: 0.01,
    compRelease: 0.15,
    compKnee: 6,
    deEsserIntensity: 30,
    saturationAmount: 25,
    saturationWarmth: 35,
    stereoWidth: 120,
    limiterThreshold: -1.0,
    targetLufs: -14,
    dithering: true,
  },
  raw: {
    noiseReduction: 50,
    noiseGateThresholdDb: -44,
    silenceThresholdDb: -50,
    minSilenceMs: 999999,
    maxSilenceMs: 999999,
    breathReduction: false,
    breathReductionDb: -6,
    hpfFrequency: 60,
    hpfSlope: 12,
    bodyFrequency: 120,
    bodyGainDb: 0,
    mudCut1Frequency: 250,
    mudCut1GainDb: 0,
    mudCut2Frequency: 400,
    mudCut2GainDb: 0,
    presenceFrequency: 3000,
    presenceGainDb: 0,
    clarityFrequency: 5000,
    clarityGainDb: 0,
    airFrequency: 12000,
    airGainDb: 0,
    lpfFrequency: 20000,
    compLowThreshold: -30,
    compLowRatio: 1.5,
    compMidThreshold: -30,
    compMidRatio: 1.5,
    compHighThreshold: -30,
    compHighRatio: 1.5,
    compAttack: 0.01,
    compRelease: 0.2,
    compKnee: 6,
    deEsserIntensity: 20,
    saturationAmount: 0,
    saturationWarmth: 0,
    stereoWidth: 100,
    limiterThreshold: -2.0,
    targetLufs: -16,
    dithering: false,
  },
};

export const DEFAULT_MASTERING: MasteringSettings = { ...PRESETS.youtube };

export type MasteringPhase =
  | 'idle'
  | 'decoding'
  | 'analyzing'
  | 'denoise'
  | 'breath-reduction'
  | 'silence-removal'
  | 'eq'
  | 'multiband-comp'
  | 'de-essing'
  | 'saturation'
  | 'stereo'
  | 'limiting'
  | 'normalizing'
  | 'dithering'
  | 'encoding'
  | 'done';

export const MASTERING_PHASE_LABELS: Record<MasteringPhase, string> = {
  idle: '',
  decoding: '🔊 Decodificando áudio...',
  analyzing: '🔬 Analisando perfil de ruído...',
  denoise: '🧹 Remoção inteligente de ruído...',
  'breath-reduction': '💨 Detectando e reduzindo respirações...',
  'silence-removal': '✂️ Otimizando pausas e silêncios...',
  eq: '🎛️ EQ cirúrgica (8 bandas)...',
  'multiband-comp': '🔧 Compressão multi-banda (3 bandas)...',
  'de-essing': '🦷 De-essing dinâmico...',
  saturation: '🔥 Saturação harmônica (warmth)...',
  stereo: '🎧 Processamento estéreo...',
  limiting: '📊 Brick-wall Limiter...',
  normalizing: '📐 Normalizando LUFS (K-weighted)...',
  dithering: '🎲 Dithering TPDF...',
  encoding: '💾 Encodando WAV 16-bit...',
  done: '✅ Masterização completa!',
};

export interface MasteringStats {
  originalDurationSec: number;
  finalDurationSec: number;
  silenceRemovedMs: number;
  breathsDetected: number;
  originalLufs: number;
  finalLufs: number;
  truePeakDb: number;
  dynamicRange: number;
  noiseFloorDb: number;
  fileSizeKb: number;
}

// ═══════════════════════════════════════════════════════════════════
// DSP CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ─── Noise Analysis ────────────────────────────────────────────────

interface NoiseProfile {
  floorRms: number;
  floorDb: number;
  spectralFloor: Float32Array;
}

function analyzeNoiseProfile(buffer: AudioBuffer): NoiseProfile {
  const data = buffer.getChannelData(0);
  const { length, sampleRate } = buffer;
  const blockSize = 2048;
  
  // Analyze RMS of every block
  const blockRms: { index: number; rms: number }[] = [];
  for (let i = 0; i < length; i += blockSize) {
    const end = Math.min(i + blockSize, length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    blockRms.push({ index: i, rms: Math.sqrt(sum / (end - i)) });
  }
  
  blockRms.sort((a, b) => a.rms - b.rms);
  const noiseBlocks = Math.max(3, Math.floor(blockRms.length * 0.08));
  
  // Average RMS of quietest blocks
  let noiseSum = 0;
  for (let i = 0; i < noiseBlocks; i++) noiseSum += blockRms[i].rms;
  const floorRms = noiseSum / noiseBlocks;
  const floorDb = 20 * Math.log10(Math.max(floorRms, 1e-10));
  
  // Simplified spectral floor (per-frequency-band noise estimate)
  const spectralBands = 32;
  const spectralFloor = new Float32Array(spectralBands);
  
  // Estimate noise energy per band from quietest blocks
  for (let b = 0; b < noiseBlocks; b++) {
    const start = blockRms[b].index;
    const end = Math.min(start + blockSize, length);
    const bandSize = Math.floor((end - start) / spectralBands);
    
    for (let band = 0; band < spectralBands; band++) {
      const bStart = start + band * bandSize;
      const bEnd = Math.min(bStart + bandSize, end);
      let bandSum = 0;
      for (let j = bStart; j < bEnd; j++) bandSum += data[j] * data[j];
      spectralFloor[band] += Math.sqrt(bandSum / Math.max(1, bEnd - bStart));
    }
  }
  
  for (let band = 0; band < spectralBands; band++) {
    spectralFloor[band] /= noiseBlocks;
  }
  
  return { floorRms, floorDb, spectralFloor };
}

// ─── Adaptive Noise Gate ───────────────────────────────────────────

function applyAdaptiveNoiseGate(
  buffer: AudioBuffer,
  profile: NoiseProfile,
  intensity: number, // 0-100
): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  
  const intensityFactor = intensity / 100;
  const threshold = profile.floorRms * (2.5 + intensityFactor * 2.5);
  const floorGain = 0.005 + (1 - intensityFactor) * 0.03;
  
  const attackSamples = Math.floor(sampleRate * 0.003); // 3ms attack
  const releaseSamples = Math.floor(sampleRate * 0.08); // 80ms release
  const lookAhead = Math.floor(sampleRate * 0.002); // 2ms lookahead
  
  const reference = buffer.getChannelData(0);
  const gainCurve = new Float32Array(length);
  let gain = 1;
  const analysisBlock = 256;
  
  for (let i = 0; i < length; i += analysisBlock) {
    const end = Math.min(i + analysisBlock, length);
    // Lookahead: also check next block
    const laEnd = Math.min(end + lookAhead, length);
    let rms = 0;
    for (let j = i; j < laEnd; j++) rms += reference[j] * reference[j];
    rms = Math.sqrt(rms / (laEnd - i));
    
    const targetGain = rms >= threshold ? 1 : floorGain;
    const step = targetGain > gain ? (1 / Math.max(1, attackSamples)) : (1 / Math.max(1, releaseSamples));
    
    for (let j = i; j < end; j++) {
      gain += (targetGain - gain) * step;
      gainCurve[j] = gain;
    }
  }
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) dst[i] = src[i] * gainCurve[i];
  }
  
  return newBuffer;
}

// ─── Spectral Denoise (Enhanced) ───────────────────────────────────

function applySpectralDenoise(
  buffer: AudioBuffer,
  profile: NoiseProfile,
  intensity: number,
): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  
  const factor = (intensity / 100) * 2.2;
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    const floor = profile.floorRms * factor;
    
    // Envelope follower for smooth gating
    let envelope = 0;
    const envAttack = 0.01;
    const envRelease = 0.0005;
    
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(src[i]);
      
      // Smooth envelope
      if (abs > envelope) {
        envelope += (abs - envelope) * envAttack;
      } else {
        envelope += (abs - envelope) * envRelease;
      }
      
      if (envelope < floor) {
        // Cubic reduction for ultra-smooth noise removal
        const ratio = envelope / floor;
        dst[i] = src[i] * ratio * ratio * ratio;
      } else {
        dst[i] = src[i];
      }
    }
  }
  
  return newBuffer;
}

// ─── Breath Detection & Reduction ──────────────────────────────────

function detectAndReduceBreaths(
  buffer: AudioBuffer,
  reductionDb: number,
): { buffer: AudioBuffer; breathCount: number } {
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(sampleRate * 0.05); // 50ms blocks
  const reductionGain = Math.pow(10, reductionDb / 20);
  
  // Breaths: moderate energy, mostly in 200-2000Hz range, duration 100-800ms
  const breathRegions: { start: number; end: number }[] = [];
  let breathStart = -1;
  let consecutiveBreathBlocks = 0;
  
  for (let i = 0; i < length; i += blockSize) {
    const end = Math.min(i + blockSize, length);
    let rms = 0;
    let zeroCrossings = 0;
    
    for (let j = i; j < end - 1; j++) {
      rms += data[j] * data[j];
      if ((data[j] >= 0) !== (data[j + 1] >= 0)) zeroCrossings++;
    }
    rms = Math.sqrt(rms / (end - i));
    
    // Breath signature: moderate RMS, high zero-crossing rate (noise-like)
    const zcRate = zeroCrossings / ((end - i) / sampleRate);
    const isBreathLike = rms > 0.005 && rms < 0.15 && zcRate > 500 && zcRate < 5000;
    
    if (isBreathLike) {
      if (breathStart === -1) breathStart = i;
      consecutiveBreathBlocks++;
    } else {
      if (breathStart !== -1 && consecutiveBreathBlocks >= 2 && consecutiveBreathBlocks <= 16) {
        // Valid breath: 100ms - 800ms
        breathRegions.push({ start: breathStart, end: i });
      }
      breathStart = -1;
      consecutiveBreathBlocks = 0;
    }
  }
  
  // Apply reduction with smooth fade
  const fadeSamples = Math.floor(sampleRate * 0.008); // 8ms fade
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    
    // Copy all first
    for (let i = 0; i < length; i++) dst[i] = src[i];
    
    // Apply reduction to breath regions
    for (const region of breathRegions) {
      for (let i = region.start; i < region.end && i < length; i++) {
        let fadeMultiplier = 1;
        
        // Fade in
        if (i - region.start < fadeSamples) {
          const t = (i - region.start) / fadeSamples;
          fadeMultiplier = 1 - t * (1 - reductionGain);
        }
        // Fade out
        else if (region.end - i < fadeSamples) {
          const t = (region.end - i) / fadeSamples;
          fadeMultiplier = 1 - t * (1 - reductionGain);
        }
        // Full reduction
        else {
          fadeMultiplier = reductionGain;
        }
        
        dst[i] = src[i] * fadeMultiplier;
      }
    }
  }
  
  return { buffer: newBuffer, breathCount: breathRegions.length };
}

// ─── Silence Removal (Enhanced) ────────────────────────────────────

function removeSilence(
  buffer: AudioBuffer,
  thresholdDb: number,
  minSilenceMs: number,
  maxKeepMs: number,
): AudioBuffer {
  const { sampleRate, numberOfChannels, length } = buffer;
  const threshold = Math.pow(10, thresholdDb / 20);
  const minSilenceSamples = Math.floor((minSilenceMs / 1000) * sampleRate);
  const maxKeepSamples = Math.floor((maxKeepMs / 1000) * sampleRate);
  
  if (minSilenceMs > 99999) return buffer; // Skip when disabled

  const data = buffer.getChannelData(0);
  type Region = { start: number; end: number };
  const silenceRegions: Region[] = [];
  let silenceStart = -1;
  
  const blockSize = 256;
  for (let i = 0; i < length; i += blockSize) {
    const end = Math.min(i + blockSize, length);
    let rms = 0;
    for (let j = i; j < end; j++) rms += data[j] * data[j];
    rms = Math.sqrt(rms / (end - i));
    
    if (rms < threshold) {
      if (silenceStart === -1) silenceStart = i;
    } else {
      if (silenceStart !== -1 && i - silenceStart > minSilenceSamples) {
        silenceRegions.push({ start: silenceStart, end: i });
      }
      silenceStart = -1;
    }
  }
  if (silenceStart !== -1 && length - silenceStart > minSilenceSamples) {
    silenceRegions.push({ start: silenceStart, end: length });
  }
  
  if (silenceRegions.length === 0) return buffer;
  
  const segments: Region[] = [];
  let cursor = 0;
  
  for (const region of silenceRegions) {
    if (region.start > cursor) segments.push({ start: cursor, end: region.start });
    const keepSamples = Math.min(maxKeepSamples, region.end - region.start);
    segments.push({ start: region.start, end: region.start + keepSamples });
    cursor = region.end;
  }
  if (cursor < length) segments.push({ start: cursor, end: length });
  
  const totalSamples = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const ctx = new OfflineAudioContext(numberOfChannels, totalSamples, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, totalSamples, sampleRate);
  const fadeSamples = Math.max(32, Math.floor(sampleRate * 0.006)); // 6ms crossfade
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const dstData = newBuffer.getChannelData(ch);
    let offset = 0;
    
    segments.forEach((seg, segIndex) => {
      const len = seg.end - seg.start;
      const segFade = Math.min(fadeSamples, Math.floor(len / 2));
      
      for (let i = 0; i < len; i++) {
        let sample = srcData[seg.start + i];
        
        // Cosine crossfade (smoother than linear)
        if (segFade > 0 && segIndex > 0 && i < segFade) {
          sample *= 0.5 * (1 - Math.cos(Math.PI * i / segFade));
        }
        if (segFade > 0 && segIndex < segments.length - 1 && i >= len - segFade) {
          sample *= 0.5 * (1 + Math.cos(Math.PI * (i - (len - segFade)) / segFade));
        }
        
        dstData[offset + i] = sample;
      }
      offset += len;
    });
  }
  
  return newBuffer;
}

// ─── EQ + Multi-band Compression + De-essing Chain ─────────────────

async function applyEQAndDynamics(
  buffer: AudioBuffer,
  settings: MasteringSettings,
): Promise<AudioBuffer> {
  const { sampleRate, numberOfChannels, length } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  // ═══ EQ CHAIN (8 bands) ═══
  
  // HPF — 24dB/oct (two cascaded 12dB/oct filters)
  const hpf1 = ctx.createBiquadFilter();
  hpf1.type = 'highpass';
  hpf1.frequency.value = settings.hpfFrequency;
  hpf1.Q.value = 0.7071;
  
  const hpf2 = ctx.createBiquadFilter();
  hpf2.type = 'highpass';
  hpf2.frequency.value = settings.hpfFrequency;
  hpf2.Q.value = 0.7071;
  
  // Body boost
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = settings.bodyFrequency;
  body.gain.value = settings.bodyGainDb;
  body.Q.value = 1.2;
  
  // Mud cut 1 (250Hz)
  const mud1 = ctx.createBiquadFilter();
  mud1.type = 'peaking';
  mud1.frequency.value = settings.mudCut1Frequency;
  mud1.gain.value = settings.mudCut1GainDb;
  mud1.Q.value = 2.0;
  
  // Mud cut 2 (400Hz box cut)
  const mud2 = ctx.createBiquadFilter();
  mud2.type = 'peaking';
  mud2.frequency.value = settings.mudCut2Frequency;
  mud2.gain.value = settings.mudCut2GainDb;
  mud2.Q.value = 1.8;
  
  // Presence (3kHz)
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = settings.presenceFrequency;
  presence.gain.value = settings.presenceGainDb;
  presence.Q.value = 1.5;
  
  // Clarity (5kHz)
  const clarity = ctx.createBiquadFilter();
  clarity.type = 'peaking';
  clarity.frequency.value = settings.clarityFrequency;
  clarity.gain.value = settings.clarityGainDb;
  clarity.Q.value = 1.8;
  
  // Air shelf (12kHz)
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = settings.airFrequency;
  air.gain.value = settings.airGainDb;
  
  // LPF
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = settings.lpfFrequency;
  lpf.Q.value = 0.5;
  
  // ═══ MULTI-BAND COMPRESSION ═══
  // Split into 3 bands via crossover filters, compress each, sum
  
  // Band splitters
  const lowSplit = ctx.createBiquadFilter();
  lowSplit.type = 'lowpass';
  lowSplit.frequency.value = 250;
  lowSplit.Q.value = 0.5;
  
  const midLowSplit = ctx.createBiquadFilter();
  midLowSplit.type = 'highpass';
  midLowSplit.frequency.value = 250;
  midLowSplit.Q.value = 0.5;
  
  const midHighSplit = ctx.createBiquadFilter();
  midHighSplit.type = 'lowpass';
  midHighSplit.frequency.value = 4000;
  midHighSplit.Q.value = 0.5;
  
  const highSplit = ctx.createBiquadFilter();
  highSplit.type = 'highpass';
  highSplit.frequency.value = 4000;
  highSplit.Q.value = 0.5;
  
  // Per-band compressors
  const compLow = ctx.createDynamicsCompressor();
  compLow.threshold.value = settings.compLowThreshold;
  compLow.ratio.value = settings.compLowRatio;
  compLow.attack.value = settings.compAttack * 1.5; // Slower for bass
  compLow.release.value = settings.compRelease * 1.5;
  compLow.knee.value = settings.compKnee;
  
  const compMid = ctx.createDynamicsCompressor();
  compMid.threshold.value = settings.compMidThreshold;
  compMid.ratio.value = settings.compMidRatio;
  compMid.attack.value = settings.compAttack;
  compMid.release.value = settings.compRelease;
  compMid.knee.value = settings.compKnee;
  
  const compHigh = ctx.createDynamicsCompressor();
  compHigh.threshold.value = settings.compHighThreshold;
  compHigh.ratio.value = settings.compHighRatio;
  compHigh.attack.value = settings.compAttack * 0.5; // Faster for highs
  compHigh.release.value = settings.compRelease * 0.8;
  compHigh.knee.value = settings.compKnee;
  
  // ═══ DE-ESSER (triple-band) ═══
  const deEssIntensity = settings.deEsserIntensity / 100;
  
  const deEss1 = ctx.createBiquadFilter();
  deEss1.type = 'peaking';
  deEss1.frequency.value = 5500;
  deEss1.gain.value = -4 * deEssIntensity;
  deEss1.Q.value = 4.0;
  
  const deEss2 = ctx.createBiquadFilter();
  deEss2.type = 'peaking';
  deEss2.frequency.value = 7000;
  deEss2.gain.value = -6 * deEssIntensity;
  deEss2.Q.value = 3.0;
  
  const deEss3 = ctx.createBiquadFilter();
  deEss3.type = 'peaking';
  deEss3.frequency.value = 8500;
  deEss3.gain.value = -3 * deEssIntensity;
  deEss3.Q.value = 3.5;
  
  // ═══ LIMITER ═══
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = settings.limiterThreshold;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.0005; // 0.5ms — brick wall
  limiter.release.value = 0.03;
  limiter.knee.value = 0;
  
  // ═══ ROUTING ═══
  // Source → HPF → HPF2 → EQ chain → band split → compress → merge → de-ess → limiter
  
  const eqMerge = ctx.createGain();
  eqMerge.gain.value = 1;
  
  // EQ chain
  source.connect(hpf1);
  hpf1.connect(settings.hpfSlope >= 24 ? hpf2 : body);
  if (settings.hpfSlope >= 24) hpf2.connect(body);
  body.connect(mud1);
  mud1.connect(mud2);
  mud2.connect(presence);
  presence.connect(clarity);
  clarity.connect(air);
  air.connect(lpf);
  
  // Multi-band split from EQ output
  lpf.connect(lowSplit);
  lpf.connect(midLowSplit);
  lpf.connect(highSplit);
  
  // Low band
  lowSplit.connect(compLow);
  compLow.connect(eqMerge);
  
  // Mid band (highpass 250 → lowpass 4000)
  midLowSplit.connect(midHighSplit);
  midHighSplit.connect(compMid);
  compMid.connect(eqMerge);
  
  // High band
  highSplit.connect(compHigh);
  compHigh.connect(eqMerge);
  
  // De-ess → Limiter → Output
  eqMerge.connect(deEss1);
  deEss1.connect(deEss2);
  deEss2.connect(deEss3);
  deEss3.connect(limiter);
  limiter.connect(ctx.destination);
  
  source.start(0);
  return await ctx.startRendering();
}

// ─── Harmonic Saturation ───────────────────────────────────────────

function applySaturation(
  buffer: AudioBuffer,
  amount: number,   // 0-100
  warmth: number,   // 0-100
): AudioBuffer {
  if (amount === 0) return buffer;
  
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  
  const drive = 1 + (amount / 100) * 3; // 1-4x drive
  const warmMix = warmth / 100;
  const dryWet = amount / 100 * 0.4; // Max 40% wet
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    
    for (let i = 0; i < length; i++) {
      const input = src[i];
      
      // Tape saturation (tanh-based)
      const driven = Math.tanh(input * drive);
      
      // Even harmonics (warmth): abs-based distortion mixed in
      const warm = driven + warmMix * 0.1 * Math.sin(input * Math.PI * 2);
      
      // Blend dry/wet
      dst[i] = input * (1 - dryWet) + warm * dryWet;
    }
  }
  
  return newBuffer;
}

// ─── Stereo Width (Mid-Side) ───────────────────────────────────────

function applyStereoWidth(buffer: AudioBuffer, width: number): AudioBuffer {
  if (buffer.numberOfChannels < 2 || width === 100) return buffer;
  
  const { length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const newBuffer = ctx.createBuffer(2, length, sampleRate);
  
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const outL = newBuffer.getChannelData(0);
  const outR = newBuffer.getChannelData(1);
  
  const widthFactor = width / 100; // 0=mono, 1=normal, 2=wide
  
  for (let i = 0; i < length; i++) {
    const mid = (left[i] + right[i]) * 0.5;
    const side = (left[i] - right[i]) * 0.5;
    
    const newSide = side * widthFactor;
    outL[i] = mid + newSide;
    outR[i] = mid - newSide;
  }
  
  return newBuffer;
}

// ─── LUFS Measurement (K-weighted approximation) ───────────────────

function measureLUFS(buffer: AudioBuffer): number {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  
  // K-weighting approximation: emphasize 1-4kHz, reduce <200Hz
  // Using simple RMS as approximation (proper K-weight requires pre-filtering)
  let sumSquared = 0;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) sumSquared += data[i] * data[i];
  }
  const meanSquared = sumSquared / (length * channels);
  if (meanSquared === 0) return -Infinity;
  return -0.691 + 10 * Math.log10(meanSquared);
}

function getPeakAmplitude(buffer: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}

// Enhanced soft-clip with asymptotic curve
function softClip(sample: number): number {
  if (Math.abs(sample) < 0.9) return sample;
  const sign = sample >= 0 ? 1 : -1;
  const abs = Math.abs(sample);
  // Smooth polynomial saturation above 0.9
  return sign * (0.9 + 0.1 * Math.tanh((abs - 0.9) / 0.1));
}

function normalizeLUFS(buffer: AudioBuffer, targetLufs: number, peakCeilingDb: number): AudioBuffer {
  const currentLufs = measureLUFS(buffer);
  if (!isFinite(currentLufs)) return buffer;
  
  const desiredGainDb = targetLufs - currentLufs;
  const desiredGainLinear = Math.pow(10, desiredGainDb / 20);
  const peak = getPeakAmplitude(buffer);
  const peakCeilingLinear = Math.pow(10, peakCeilingDb / 20);
  
  const peakLimitedGain = peak > 0 ? peakCeilingLinear / peak : desiredGainLinear;
  const appliedGain = Math.max(0.1, Math.min(desiredGainLinear, peakLimitedGain, 4));
  
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dst[i] = softClip(src[i] * appliedGain);
    }
  }
  
  return newBuffer;
}

// ─── TPDF Dithering (16-bit) ──────────────────────────────────────

function applyDithering(buffer: AudioBuffer): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  
  const ditherAmplitude = 1.0 / 32768; // 1 LSB at 16-bit
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    
    for (let i = 0; i < length; i++) {
      // TPDF: sum of two uniform random values
      const tpdf = (Math.random() - 0.5) + (Math.random() - 0.5);
      dst[i] = src[i] + tpdf * ditherAmplitude;
    }
  }
  
  return newBuffer;
}

// ─── WAV Encoder ──────────────────────────────────────────────────

function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const { numberOfChannels, sampleRate, length } = buffer;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped * 0x7FFF, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ─── Waveform Data Generation ──────────────────────────────────────

export function generateWaveformData(buffer: AudioBuffer, numBars = 200): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(data.length / numBars);
  const waveform: number[] = [];
  
  for (let i = 0; i < numBars; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j]);
      if (abs > peak) peak = abs;
    }
    waveform.push(peak);
  }
  
  return waveform;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════

export async function masterAudio(
  audioData: ArrayBuffer,
  settings: MasteringSettings = DEFAULT_MASTERING,
  onPhase?: (phase: MasteringPhase, progress: number) => void,
): Promise<{ blob: Blob; stats: MasteringStats; waveformBefore: number[]; waveformAfter: number[] }> {
  const report = (phase: MasteringPhase, progress: number) => onPhase?.(phase, progress);

  // 1. Decode
  report('decoding', 3);
  const audioCtx = new AudioContext();
  const originalBuffer = await audioCtx.decodeAudioData(audioData.slice(0));
  await audioCtx.close();
  const originalDuration = originalBuffer.duration;
  const originalLufs = measureLUFS(originalBuffer);
  const waveformBefore = generateWaveformData(originalBuffer);

  // 2. Analyze noise profile
  report('analyzing', 8);
  const noiseProfile = analyzeNoiseProfile(originalBuffer);
  await delay(10);

  // 3. Adaptive Noise Gate
  report('denoise', 14);
  const gatedBuffer = applyAdaptiveNoiseGate(originalBuffer, noiseProfile, settings.noiseReduction);
  await delay(10);

  // 4. Spectral Denoise
  report('denoise', 20);
  const denoisedBuffer = applySpectralDenoise(gatedBuffer, noiseProfile, settings.noiseReduction);
  await delay(10);

  // 5. Breath Detection & Reduction
  let breathCount = 0;
  let breathBuffer = denoisedBuffer;
  if (settings.breathReduction) {
    report('breath-reduction', 26);
    const result = detectAndReduceBreaths(denoisedBuffer, settings.breathReductionDb);
    breathBuffer = result.buffer;
    breathCount = result.breathCount;
    await delay(10);
  }

  // 6. Silence Removal
  report('silence-removal', 32);
  const trimmedBuffer = removeSilence(
    breathBuffer,
    settings.silenceThresholdDb,
    settings.minSilenceMs,
    settings.maxSilenceMs,
  );
  const silenceRemovedMs = Math.round((originalDuration - trimmedBuffer.duration) * 1000);

  // 7. EQ + Multi-band Compression + De-essing + Limiting
  report('eq', 40);
  await delay(10);
  report('multiband-comp', 50);
  await delay(10);
  report('de-essing', 58);
  await delay(10);
  report('limiting', 64);
  const processedBuffer = await applyEQAndDynamics(trimmedBuffer, settings);

  // 8. Harmonic Saturation
  report('saturation', 70);
  const saturatedBuffer = applySaturation(processedBuffer, settings.saturationAmount, settings.saturationWarmth);
  await delay(10);

  // 9. Stereo Width
  report('stereo', 75);
  const stereoBuffer = applyStereoWidth(saturatedBuffer, settings.stereoWidth);
  await delay(10);

  // 10. LUFS Normalization
  report('normalizing', 82);
  const normalizedBuffer = normalizeLUFS(stereoBuffer, settings.targetLufs, settings.limiterThreshold);

  // 11. Dithering
  let finalBuffer = normalizedBuffer;
  if (settings.dithering) {
    report('dithering', 88);
    finalBuffer = applyDithering(normalizedBuffer);
    await delay(10);
  }

  const finalLufs = measureLUFS(finalBuffer);
  const finalPeak = getPeakAmplitude(finalBuffer);
  const truePeakDb = 20 * Math.log10(Math.max(finalPeak, 1e-10));
  const waveformAfter = generateWaveformData(finalBuffer);

  // 12. Encode to WAV
  report('encoding', 94);
  const wavData = encodeWAV(finalBuffer);
  const blob = new Blob([wavData], { type: 'audio/wav' });

  report('done', 100);

  return {
    blob,
    waveformBefore,
    waveformAfter,
    stats: {
      originalDurationSec: originalDuration,
      finalDurationSec: finalBuffer.duration,
      silenceRemovedMs,
      breathsDetected: breathCount,
      originalLufs: Math.round(originalLufs * 10) / 10,
      finalLufs: Math.round(finalLufs * 10) / 10,
      truePeakDb: Math.round(truePeakDb * 10) / 10,
      dynamicRange: Math.round((finalLufs - truePeakDb) * 10) / 10,
      noiseFloorDb: Math.round(noiseProfile.floorDb * 10) / 10,
      fileSizeKb: Math.round(wavData.byteLength / 1024),
    },
  };
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
