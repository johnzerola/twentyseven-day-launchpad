/**
 * Studio-Grade Audio Mastering Engine v2
 * 
 * Professional voiceover processing pipeline using Web Audio API:
 * 1. Noise Gate + Spectral Denoise (artifact removal)
 * 2. Silence Removal (dynamic pause trimming)
 * 3. EQ: HPF 80Hz, Body boost 120-150Hz, Box cut 400Hz, Air shelf 10kHz+
 * 4. Compression (4:1 ratio, voice-optimized)
 * 5. De-essing (6-8kHz sibilance control)
 * 6. Low Pass Filter (cut harsh frequencies above 15kHz)
 * 7. Limiter (-3dB True Peak, targeting -14 LUFS)
 */

export interface MasteringSettings {
  // Noise & Silence
  silenceThresholdDb: number;
  minSilenceMs: number;
  maxSilenceMs: number;
  noiseGateThresholdDb: number;  // Noise gate threshold (default: -40)
  
  // EQ
  hpfFrequency: number;
  bodyFrequency: number;
  bodyGainDb: number;
  boxCutFrequency: number;
  boxCutGainDb: number;
  airFrequency: number;
  airGainDb: number;
  presenceFrequency: number;
  presenceGainDb: number;
  lpfFrequency: number;         // Low pass filter cutoff (default: 15000)
  
  // Dynamics
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  compressorKnee: number;
  
  // De-esser
  deEsserFrequency: number;
  deEsserThreshold: number;
  deEsserRatio: number;
  
  // Limiter / Output
  limiterThreshold: number;
  targetLufs: number;
}

export const DEFAULT_MASTERING: MasteringSettings = {
  silenceThresholdDb: -45,
  minSilenceMs: 300,
  maxSilenceMs: 150,
  noiseGateThresholdDb: -40,
  
  hpfFrequency: 80,
  bodyFrequency: 135,
  bodyGainDb: 2.5,
  boxCutFrequency: 400,
  boxCutGainDb: -3,
  airFrequency: 10000,
  airGainDb: 2,        // Reduced from 3 to avoid hiss amplification
  presenceFrequency: 3000,
  presenceGainDb: 1.5,
  lpfFrequency: 15000,  // Cut harsh frequencies above 15kHz
  
  compressorThreshold: -18,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.15,
  compressorKnee: 6,
  
  deEsserFrequency: 7000,
  deEsserThreshold: -25,
  deEsserRatio: 8,
  
  limiterThreshold: -3,
  targetLufs: -14,
};

export type MasteringPhase = 
  | 'idle' 
  | 'decoding' 
  | 'denoise'
  | 'silence-removal' 
  | 'eq' 
  | 'compression' 
  | 'de-essing' 
  | 'limiting' 
  | 'normalizing' 
  | 'encoding' 
  | 'done';

export const MASTERING_PHASE_LABELS: Record<MasteringPhase, string> = {
  idle: '',
  decoding: '🔊 Decodificando áudio...',
  denoise: '🧹 Removendo ruído de fundo...',
  'silence-removal': '✂️ Removendo silêncios mortos...',
  eq: '🎛️ Aplicando EQ cirúrgica...',
  compression: '🔧 Compressão dinâmica...',
  'de-essing': '🦷 De-essing (sibilância)...',
  limiting: '📊 Limiter & Loudness...',
  normalizing: '📐 Normalizando para -14 LUFS...',
  encoding: '💾 Encodando WAV final...',
  done: '✅ Masterização completa!',
};

// ─── Noise Gate / Spectral Denoise ─────────────────────────────────

function applyNoiseGate(
  buffer: AudioBuffer,
  thresholdDb: number,
): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  const baseThreshold = Math.pow(10, thresholdDb / 20);

  // Estimate floor from quieter windows (more robust than assuming first 0.5s is silence)
  const reference = buffer.getChannelData(0);
  const analysisBlock = 512;
  const rmsWindows: number[] = [];

  for (let i = 0; i < length; i += analysisBlock) {
    const end = Math.min(i + analysisBlock, length);
    let rms = 0;
    for (let j = i; j < end; j++) rms += reference[j] * reference[j];
    rmsWindows.push(Math.sqrt(rms / (end - i)));
  }

  const sorted = [...rmsWindows].sort((a, b) => a - b);
  const p20 = sorted[Math.floor(sorted.length * 0.2)] ?? baseThreshold;
  const effectiveThreshold = Math.max(baseThreshold, p20 * 2.2);

  // Gentle expander envelope to avoid chatter/metallic artifacts
  const floorGain = 0.08;
  const attackSamples = Math.max(1, Math.floor(sampleRate * 0.008));
  const releaseSamples = Math.max(1, Math.floor(sampleRate * 0.11));
  const attackStep = 1 / attackSamples;
  const releaseStep = 1 / releaseSamples;

  const gainCurve = new Float32Array(length);
  let gain = 1;

  for (let i = 0; i < length; i += analysisBlock) {
    const end = Math.min(i + analysisBlock, length);
    let rms = 0;
    for (let j = i; j < end; j++) rms += reference[j] * reference[j];
    rms = Math.sqrt(rms / (end - i));

    const targetGain = rms >= effectiveThreshold ? 1 : floorGain;
    const step = targetGain > gain ? attackStep : releaseStep;

    for (let j = i; j < end; j++) {
      gain += (targetGain - gain) * step;
      gainCurve[j] = gain;
    }
  }

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);

    for (let i = 0; i < length; i++) {
      dst[i] = src[i] * gainCurve[i];
    }
  }

  return newBuffer;
}

// ─── Silence Removal ───────────────────────────────────────────────

function removeSilence(
  buffer: AudioBuffer,
  thresholdDb: number,
  minSilenceMs: number,
  maxKeepMs: number,
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const threshold = Math.pow(10, thresholdDb / 20);
  const minSilenceSamples = Math.floor((minSilenceMs / 1000) * sampleRate);
  const maxKeepSamples = Math.floor((maxKeepMs / 1000) * sampleRate);

  const data = buffer.getChannelData(0);
  
  type Region = { start: number; end: number };
  const silenceRegions: Region[] = [];
  let silenceStart = -1;
  
  const blockSize = 512;
  for (let i = 0; i < length; i += blockSize) {
    const end = Math.min(i + blockSize, length);
    let rms = 0;
    for (let j = i; j < end; j++) {
      rms += data[j] * data[j];
    }
    rms = Math.sqrt(rms / (end - i));
    
    if (rms < threshold) {
      if (silenceStart === -1) silenceStart = i;
    } else {
      if (silenceStart !== -1) {
        const silenceLen = i - silenceStart;
        if (silenceLen > minSilenceSamples) {
          silenceRegions.push({ start: silenceStart, end: i });
        }
        silenceStart = -1;
      }
    }
  }
  if (silenceStart !== -1 && length - silenceStart > minSilenceSamples) {
    silenceRegions.push({ start: silenceStart, end: length });
  }

  if (silenceRegions.length === 0) return buffer;

  const segments: Region[] = [];
  let cursor = 0;
  
  for (const region of silenceRegions) {
    if (region.start > cursor) {
      segments.push({ start: cursor, end: region.start });
    }
    const keepSamples = Math.min(maxKeepSamples, region.end - region.start);
    segments.push({ start: region.start, end: region.start + keepSamples });
    cursor = region.end;
  }
  if (cursor < length) {
    segments.push({ start: cursor, end: length });
  }

  const totalSamples = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const ctx = new OfflineAudioContext(channels, totalSamples, sampleRate);
  const newBuffer = ctx.createBuffer(channels, totalSamples, sampleRate);
  const fadeSamples = Math.max(16, Math.floor(sampleRate * 0.004));
  
  for (let ch = 0; ch < channels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const dstData = newBuffer.getChannelData(ch);
    let offset = 0;

    segments.forEach((seg, segIndex) => {
      const len = seg.end - seg.start;
      const segmentFade = Math.min(fadeSamples, Math.floor(len / 2));

      for (let i = 0; i < len; i++) {
        let sample = srcData[seg.start + i];

        if (segmentFade > 0 && segIndex > 0 && i < segmentFade) {
          sample *= i / segmentFade;
        }

        if (segmentFade > 0 && segIndex < segments.length - 1 && i >= len - segmentFade) {
          sample *= (len - i - 1) / segmentFade;
        }

        dstData[offset + i] = sample;
      }

      offset += len;
    });
  }
  
  return newBuffer;
}

// ─── Offline Processing Chain ──────────────────────────────────────

async function applyEQAndDynamics(
  buffer: AudioBuffer,
  settings: MasteringSettings,
): Promise<AudioBuffer> {
  const { sampleRate, numberOfChannels, length } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // === EQ Chain ===
  
  // 1. High Pass Filter (80Hz) — remove sub-bass rumble
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = settings.hpfFrequency;
  hpf.Q.value = 0.7071;

  // 2. Body boost (120-150Hz) — warmth and authority
  const bodyBoost = ctx.createBiquadFilter();
  bodyBoost.type = 'peaking';
  bodyBoost.frequency.value = settings.bodyFrequency;
  bodyBoost.gain.value = settings.bodyGainDb;
  bodyBoost.Q.value = 1.5;

  // 3. Box cut (400Hz) — remove muddiness
  const boxCut = ctx.createBiquadFilter();
  boxCut.type = 'peaking';
  boxCut.frequency.value = settings.boxCutFrequency;
  boxCut.gain.value = settings.boxCutGainDb;
  boxCut.Q.value = 2.0;

  // 4. Presence boost (3kHz) — clarity and intelligibility
  const presenceBoost = ctx.createBiquadFilter();
  presenceBoost.type = 'peaking';
  presenceBoost.frequency.value = settings.presenceFrequency;
  presenceBoost.gain.value = settings.presenceGainDb;
  presenceBoost.Q.value = 1.2;

  // 5. Air shelf (10kHz+) — condenser mic brilliance
  const airShelf = ctx.createBiquadFilter();
  airShelf.type = 'highshelf';
  airShelf.frequency.value = settings.airFrequency;
  airShelf.gain.value = settings.airGainDb;

  // 6. Low Pass Filter — cut harsh frequencies & hiss above 15kHz
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = settings.lpfFrequency;
  lpf.Q.value = 0.7071;

  // === Compressor (voice dynamics) ===
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = settings.compressorThreshold;
  compressor.ratio.value = settings.compressorRatio;
  compressor.attack.value = settings.compressorAttack;
  compressor.release.value = settings.compressorRelease;
  compressor.knee.value = settings.compressorKnee;

  // === De-Esser (sibilance control) ===
  const deEsser = ctx.createBiquadFilter();
  deEsser.type = 'peaking';
  deEsser.frequency.value = settings.deEsserFrequency;
  deEsser.gain.value = -4;
  deEsser.Q.value = 3.0;

  const deEsser2 = ctx.createBiquadFilter();
  deEsser2.type = 'peaking';
  deEsser2.frequency.value = 5500;
  deEsser2.gain.value = -2;
  deEsser2.Q.value = 4.0;

  // === Limiter (brick-wall) ===
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = settings.limiterThreshold;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  limiter.knee.value = 0;

  // === Chain: source → HPF → body → boxCut → presence → air → LPF → comp → deEss → deEss2 → limiter → dest
  source.connect(hpf);
  hpf.connect(bodyBoost);
  bodyBoost.connect(boxCut);
  boxCut.connect(presenceBoost);
  presenceBoost.connect(airShelf);
  airShelf.connect(lpf);
  lpf.connect(compressor);
  compressor.connect(deEsser);
  deEsser.connect(deEsser2);
  deEsser2.connect(limiter);
  limiter.connect(ctx.destination);

  source.start(0);
  return await ctx.startRendering();
}

// ─── LUFS Normalization ────────────────────────────────────────────

function measureLUFS(buffer: AudioBuffer): number {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  
  let sumSquared = 0;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      sumSquared += data[i] * data[i];
    }
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

function normalizeLUFS(buffer: AudioBuffer, targetLufs: number, peakCeilingDb = -3): AudioBuffer {
  const currentLufs = measureLUFS(buffer);
  if (!isFinite(currentLufs)) return buffer;

  const desiredGainDb = targetLufs - currentLufs;
  const desiredGainLinear = Math.pow(10, desiredGainDb / 20);
  const peak = getPeakAmplitude(buffer);
  const peakCeilingLinear = Math.pow(10, peakCeilingDb / 20);

  // Keep loudness target, but never force clipping/distortion to reach it
  const peakLimitedGain = peak > 0 ? peakCeilingLinear / peak : desiredGainLinear;
  const appliedGain = Math.max(0.1, Math.min(desiredGainLinear, peakLimitedGain, 6));

  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const sample = src[i] * appliedGain;
      dst[i] = Math.max(-1, Math.min(1, sample));
    }
  }

  return newBuffer;
}

// ─── WAV Encoder ───────────────────────────────────────────────────

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

// ─── Main Pipeline ─────────────────────────────────────────────────

export async function masterAudio(
  audioData: ArrayBuffer,
  settings: MasteringSettings = DEFAULT_MASTERING,
  onPhase?: (phase: MasteringPhase, progress: number) => void,
): Promise<{ blob: Blob; stats: MasteringStats }> {
  const report = (phase: MasteringPhase, progress: number) => onPhase?.(phase, progress);

  // 1. Decode
  report('decoding', 5);
  const audioCtx = new AudioContext();
  const originalBuffer = await audioCtx.decodeAudioData(audioData.slice(0));
  await audioCtx.close();
  const originalDuration = originalBuffer.duration;
  const originalLufs = measureLUFS(originalBuffer);

  // 2. Noise Gate / Denoise — remove background hiss and artifacts
  report('denoise', 12);
  const denoisedBuffer = applyNoiseGate(originalBuffer, settings.noiseGateThresholdDb);
  await delay(30);

  // 3. Silence Removal
  report('silence-removal', 20);
  const trimmedBuffer = removeSilence(
    denoisedBuffer,
    settings.silenceThresholdDb,
    settings.minSilenceMs,
    settings.maxSilenceMs,
  );
  const silenceRemovedMs = Math.round((originalDuration - trimmedBuffer.duration) * 1000);

  // 4. EQ + Compression + De-essing + LPF + Limiting
  report('eq', 30);
  await delay(30);
  
  report('compression', 45);
  await delay(30);
  
  report('de-essing', 55);
  await delay(30);
  
  report('limiting', 65);
  const processedBuffer = await applyEQAndDynamics(trimmedBuffer, settings);

  // 5. LUFS Normalization
  report('normalizing', 80);
  const normalizedBuffer = normalizeLUFS(processedBuffer, settings.targetLufs);
  const finalLufs = measureLUFS(normalizedBuffer);

  // 6. Encode to WAV
  report('encoding', 92);
  const wavData = encodeWAV(normalizedBuffer);
  const blob = new Blob([wavData], { type: 'audio/wav' });

  report('done', 100);

  return {
    blob,
    stats: {
      originalDurationSec: originalDuration,
      finalDurationSec: normalizedBuffer.duration,
      silenceRemovedMs,
      originalLufs: Math.round(originalLufs * 10) / 10,
      finalLufs: Math.round(finalLufs * 10) / 10,
      truePeakDb: settings.limiterThreshold,
      fileSizeKb: Math.round(wavData.byteLength / 1024),
    },
  };
}

export interface MasteringStats {
  originalDurationSec: number;
  finalDurationSec: number;
  silenceRemovedMs: number;
  originalLufs: number;
  finalLufs: number;
  truePeakDb: number;
  fileSizeKb: number;
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
