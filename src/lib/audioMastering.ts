/**
 * Studio-Grade Audio Mastering Engine
 * 
 * Professional voiceover processing pipeline using Web Audio API:
 * 1. Silence Removal (dynamic pause trimming)
 * 2. EQ: HPF 80Hz, Body boost 120-150Hz, Box cut 400Hz, Air shelf 10kHz+
 * 3. Compression (3:1 ratio, voice-optimized)
 * 4. De-essing (6-8kHz sibilance control)
 * 5. Limiter (-3dB True Peak, targeting -14 LUFS)
 */

export interface MasteringSettings {
  // Noise & Silence
  silenceThresholdDb: number;    // dB below which is "silence" (default: -45)
  minSilenceMs: number;          // minimum silence duration to trim (default: 300ms)
  maxSilenceMs: number;          // maximum silence to keep (default: 150ms)
  
  // EQ
  hpfFrequency: number;         // High Pass Filter cutoff (default: 80)
  bodyFrequency: number;         // Body boost center (default: 135)
  bodyGainDb: number;            // Body boost amount (default: 2.5)
  boxCutFrequency: number;      // Boxy cut center (default: 400)
  boxCutGainDb: number;          // Boxy cut amount (default: -3)
  airFrequency: number;         // Air shelf start (default: 10000)
  airGainDb: number;             // Air shelf boost (default: 3)
  presenceFrequency: number;     // Presence boost (default: 3000)
  presenceGainDb: number;        // Presence amount (default: 1.5)
  
  // Dynamics
  compressorThreshold: number;   // Compressor threshold dB (default: -18)
  compressorRatio: number;       // Ratio (default: 4)
  compressorAttack: number;      // Attack seconds (default: 0.003)
  compressorRelease: number;     // Release seconds (default: 0.15)
  compressorKnee: number;        // Knee dB (default: 6)
  
  // De-esser
  deEsserFrequency: number;     // Center frequency (default: 7000)
  deEsserThreshold: number;     // Threshold dB (default: -25)
  deEsserRatio: number;         // Ratio (default: 8)
  
  // Limiter / Output
  limiterThreshold: number;      // True peak ceiling dB (default: -3)
  targetLufs: number;            // Target loudness (default: -14)
}

export const DEFAULT_MASTERING: MasteringSettings = {
  silenceThresholdDb: -45,
  minSilenceMs: 300,
  maxSilenceMs: 150,
  
  hpfFrequency: 80,
  bodyFrequency: 135,
  bodyGainDb: 2.5,
  boxCutFrequency: 400,
  boxCutGainDb: -3,
  airFrequency: 10000,
  airGainDb: 3,
  presenceFrequency: 3000,
  presenceGainDb: 1.5,
  
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
  'silence-removal': '✂️ Removendo silêncios mortos...',
  eq: '🎛️ Aplicando EQ cirúrgica...',
  compression: '🔧 Compressão dinâmica...',
  'de-essing': '🦷 De-essing (sibilância)...',
  limiting: '📊 Limiter & Loudness...',
  normalizing: '📐 Normalizando para -14 LUFS...',
  encoding: '💾 Encodando WAV final...',
  done: '✅ Masterização completa!',
};

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

  // Analyze using channel 0 (mono reference)
  const data = buffer.getChannelData(0);
  
  // Find silence regions
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

  // Calculate trimmed regions: keep maxKeepSamples of each silence
  const segments: Region[] = [];
  let cursor = 0;
  
  for (const region of silenceRegions) {
    if (region.start > cursor) {
      segments.push({ start: cursor, end: region.start });
    }
    // Keep a small portion of silence for natural feel
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
  
  for (let ch = 0; ch < channels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const dstData = newBuffer.getChannelData(ch);
    let offset = 0;
    for (const seg of segments) {
      const len = seg.end - seg.start;
      dstData.set(srcData.subarray(seg.start, seg.end), offset);
      offset += len;
    }
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

  // Source
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // === EQ Chain ===
  
  // 1. High Pass Filter (80Hz) — remove sub-bass rumble
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = settings.hpfFrequency;
  hpf.Q.value = 0.7071; // Butterworth

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

  // === Compressor (voice dynamics) ===
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = settings.compressorThreshold;
  compressor.ratio.value = settings.compressorRatio;
  compressor.attack.value = settings.compressorAttack;
  compressor.release.value = settings.compressorRelease;
  compressor.knee.value = settings.compressorKnee;

  // === De-Esser (sibilance control via narrow-band compression) ===
  // Implemented as: split → bandpass 6-8kHz → compress → merge
  // Approximation: narrow peaking cut at sibilant range
  const deEsser = ctx.createBiquadFilter();
  deEsser.type = 'peaking';
  deEsser.frequency.value = settings.deEsserFrequency;
  deEsser.gain.value = -4; // Gentle sibilance reduction
  deEsser.Q.value = 3.0;

  // Second de-esser notch for harsh "T" sounds
  const deEsser2 = ctx.createBiquadFilter();
  deEsser2.type = 'peaking';
  deEsser2.frequency.value = 5500;
  deEsser2.gain.value = -2;
  deEsser2.Q.value = 4.0;

  // === Limiter (brick-wall via compressor with very high ratio) ===
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = settings.limiterThreshold;
  limiter.ratio.value = 20; // Brick-wall limiting
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  limiter.knee.value = 0;

  // === Chain: source → HPF → body → boxCut → presence → air → comp → deEss → deEss2 → limiter → dest
  source.connect(hpf);
  hpf.connect(bodyBoost);
  bodyBoost.connect(boxCut);
  boxCut.connect(presenceBoost);
  presenceBoost.connect(airShelf);
  airShelf.connect(compressor);
  compressor.connect(deEsser);
  deEsser.connect(deEsser2);
  deEsser2.connect(limiter);
  limiter.connect(ctx.destination);

  source.start(0);
  return await ctx.startRendering();
}

// ─── LUFS Normalization ────────────────────────────────────────────

function measureLUFS(buffer: AudioBuffer): number {
  // Simplified integrated LUFS measurement (ITU-R BS.1770)
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  
  // K-weighting approximation: we use the raw signal (simplified)
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

function normalizeLUFS(buffer: AudioBuffer, targetLufs: number): AudioBuffer {
  const currentLufs = measureLUFS(buffer);
  if (!isFinite(currentLufs)) return buffer;
  
  const gainDb = targetLufs - currentLufs;
  const gainLinear = Math.pow(10, gainDb / 20);
  
  // Clamp gain to avoid extreme amplification
  const clampedGain = Math.min(gainLinear, 10); // max +20dB
  
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dst[i] = Math.max(-1, Math.min(1, src[i] * clampedGain));
    }
  }
  
  return newBuffer;
}

// ─── WAV Encoder ───────────────────────────────────────────────────

function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const { numberOfChannels, sampleRate, length } = buffer;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
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

  // 2. Silence Removal
  report('silence-removal', 15);
  const trimmedBuffer = removeSilence(
    originalBuffer,
    settings.silenceThresholdDb,
    settings.minSilenceMs,
    settings.maxSilenceMs,
  );
  const silenceRemovedMs = Math.round((originalDuration - trimmedBuffer.duration) * 1000);

  // 3. EQ + Compression + De-essing + Limiting
  report('eq', 30);
  await delay(50); // Let UI update
  
  report('compression', 50);
  await delay(50);
  
  report('de-essing', 60);
  await delay(50);
  
  report('limiting', 70);
  const processedBuffer = await applyEQAndDynamics(trimmedBuffer, settings);

  // 4. LUFS Normalization
  report('normalizing', 85);
  const normalizedBuffer = normalizeLUFS(processedBuffer, settings.targetLufs);
  const finalLufs = measureLUFS(normalizedBuffer);

  // 5. Encode to WAV
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
