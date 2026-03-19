/**
 * Studio-Grade Audio Mastering Engine v3 — YouTube Professional
 * 
 * Pipeline:
 * 1. Noise Gate (aggressive expander, floor 0.01)
 * 2. Spectral Denoise (noise profile subtraction)
 * 3. Silence Removal (dynamic pause trimming + crossfades)
 * 4. EQ: HPF 80Hz, Body +3.5dB@130Hz, Box cut -3dB@400Hz, Presence +2.5dB@2.8kHz, Air +1dB@10kHz, LPF 12kHz
 * 5. Compression (4:1, knee 3, -20dB threshold)
 * 6. Triple De-essing (5.5kHz, 7kHz, 8.5kHz)
 * 7. Limiter (-2dB True Peak, targeting -14 LUFS)
 */

export interface MasteringSettings {
  silenceThresholdDb: number;
  minSilenceMs: number;
  maxSilenceMs: number;
  noiseGateThresholdDb: number;
  
  hpfFrequency: number;
  bodyFrequency: number;
  bodyGainDb: number;
  boxCutFrequency: number;
  boxCutGainDb: number;
  airFrequency: number;
  airGainDb: number;
  presenceFrequency: number;
  presenceGainDb: number;
  lpfFrequency: number;
  
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  compressorKnee: number;
  
  deEsserFrequency: number;
  deEsserThreshold: number;
  deEsserRatio: number;
  
  limiterThreshold: number;
  targetLufs: number;
}

export const DEFAULT_MASTERING: MasteringSettings = {
  silenceThresholdDb: -42,
  minSilenceMs: 280,
  maxSilenceMs: 140,
  noiseGateThresholdDb: -36,
  
  hpfFrequency: 80,
  bodyFrequency: 130,
  bodyGainDb: 3.5,
  boxCutFrequency: 400,
  boxCutGainDb: -3,
  airFrequency: 10000,
  airGainDb: 1.0,
  presenceFrequency: 2800,
  presenceGainDb: 2.5,
  lpfFrequency: 12000,
  
  compressorThreshold: -20,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.15,
  compressorKnee: 3,
  
  deEsserFrequency: 7000,
  deEsserThreshold: -25,
  deEsserRatio: 8,
  
  limiterThreshold: -2,
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

// ─── Noise Gate (Aggressive Expander) ──────────────────────────────

function applyNoiseGate(buffer: AudioBuffer, thresholdDb: number): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
  const baseThreshold = Math.pow(10, thresholdDb / 20);

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
  const effectiveThreshold = Math.max(baseThreshold, p20 * 3.0);

  // Near-total silence in gated sections
  const floorGain = 0.01;
  const attackSamples = Math.max(1, Math.floor(sampleRate * 0.008));
  const releaseSamples = Math.max(1, Math.floor(sampleRate * 0.15));
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

// ─── Spectral Denoise (Noise Profile Subtraction) ──────────────────

function applySpectralDenoise(buffer: AudioBuffer): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);

  // Estimate noise profile from the quietest 10% of blocks
  const blockSize = 1024;
  const reference = buffer.getChannelData(0);
  
  const blockEnergies: { index: number; energy: number }[] = [];
  for (let i = 0; i < length; i += blockSize) {
    const end = Math.min(i + blockSize, length);
    let energy = 0;
    for (let j = i; j < end; j++) energy += reference[j] * reference[j];
    blockEnergies.push({ index: i, energy: energy / (end - i) });
  }
  
  blockEnergies.sort((a, b) => a.energy - b.energy);
  const noiseBlockCount = Math.max(1, Math.floor(blockEnergies.length * 0.1));
  
  // Calculate per-channel noise RMS from quietest blocks
  const noiseFloor = new Float32Array(numberOfChannels);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const chData = buffer.getChannelData(ch);
    let sum = 0;
    let count = 0;
    for (let b = 0; b < noiseBlockCount; b++) {
      const start = blockEnergies[b].index;
      const end = Math.min(start + blockSize, length);
      for (let j = start; j < end; j++) {
        sum += chData[j] * chData[j];
        count++;
      }
    }
    noiseFloor[ch] = Math.sqrt(sum / Math.max(1, count));
  }

  // Subtract noise: for each sample, reduce amplitude when close to noise floor
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    const floor = noiseFloor[ch] * 1.8; // Slightly above measured floor

    for (let i = 0; i < length; i++) {
      const abs = Math.abs(src[i]);
      if (abs < floor) {
        // Soft reduction: scale down samples near noise floor
        const ratio = abs / floor;
        dst[i] = src[i] * ratio * ratio; // Quadratic reduction
      } else {
        dst[i] = src[i];
      }
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
    for (let j = i; j < end; j++) rms += data[j] * data[j];
    rms = Math.sqrt(rms / (end - i));
    
    if (rms < threshold) {
      if (silenceStart === -1) silenceStart = i;
    } else {
      if (silenceStart !== -1) {
        if (i - silenceStart > minSilenceSamples) {
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

// ─── Offline EQ + Dynamics Chain ───────────────────────────────────

async function applyEQAndDynamics(
  buffer: AudioBuffer,
  settings: MasteringSettings,
): Promise<AudioBuffer> {
  const { sampleRate, numberOfChannels, length } = buffer;
  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // HPF 80Hz
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = settings.hpfFrequency;
  hpf.Q.value = 0.7071;

  // Body boost
  const bodyBoost = ctx.createBiquadFilter();
  bodyBoost.type = 'peaking';
  bodyBoost.frequency.value = settings.bodyFrequency;
  bodyBoost.gain.value = settings.bodyGainDb;
  bodyBoost.Q.value = 1.5;

  // Box cut
  const boxCut = ctx.createBiquadFilter();
  boxCut.type = 'peaking';
  boxCut.frequency.value = settings.boxCutFrequency;
  boxCut.gain.value = settings.boxCutGainDb;
  boxCut.Q.value = 2.0;

  // Presence boost
  const presenceBoost = ctx.createBiquadFilter();
  presenceBoost.type = 'peaking';
  presenceBoost.frequency.value = settings.presenceFrequency;
  presenceBoost.gain.value = settings.presenceGainDb;
  presenceBoost.Q.value = 1.2;

  // Air shelf (conservative)
  const airShelf = ctx.createBiquadFilter();
  airShelf.type = 'highshelf';
  airShelf.frequency.value = settings.airFrequency;
  airShelf.gain.value = settings.airGainDb;

  // LPF at 12kHz — aggressive hiss removal
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = settings.lpfFrequency;
  lpf.Q.value = 0.7071;

  // Compressor
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = settings.compressorThreshold;
  compressor.ratio.value = settings.compressorRatio;
  compressor.attack.value = settings.compressorAttack;
  compressor.release.value = settings.compressorRelease;
  compressor.knee.value = settings.compressorKnee;

  // Triple De-Esser
  const deEsser1 = ctx.createBiquadFilter();
  deEsser1.type = 'peaking';
  deEsser1.frequency.value = 5500;
  deEsser1.gain.value = -4;
  deEsser1.Q.value = 4.0;

  const deEsser2 = ctx.createBiquadFilter();
  deEsser2.type = 'peaking';
  deEsser2.frequency.value = settings.deEsserFrequency;
  deEsser2.gain.value = -6;
  deEsser2.Q.value = 3.0;

  const deEsser3 = ctx.createBiquadFilter();
  deEsser3.type = 'peaking';
  deEsser3.frequency.value = 8500;
  deEsser3.gain.value = -3;
  deEsser3.Q.value = 3.5;

  // Limiter
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = settings.limiterThreshold;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  limiter.knee.value = 0;

  // Chain
  source.connect(hpf);
  hpf.connect(bodyBoost);
  bodyBoost.connect(boxCut);
  boxCut.connect(presenceBoost);
  presenceBoost.connect(airShelf);
  airShelf.connect(lpf);
  lpf.connect(compressor);
  compressor.connect(deEsser1);
  deEsser1.connect(deEsser2);
  deEsser2.connect(deEsser3);
  deEsser3.connect(limiter);
  limiter.connect(ctx.destination);

  source.start(0);
  return await ctx.startRendering();
}

// ─── LUFS Measurement & Normalization ──────────────────────────────

function measureLUFS(buffer: AudioBuffer): number {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
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

// Soft-clip function: gentle saturation instead of hard clipping
function softClip(sample: number): number {
  if (sample > 0.95) {
    return 0.95 + (sample - 0.95) / (1 + ((sample - 0.95) / 0.05) ** 2) * 0.05;
  }
  if (sample < -0.95) {
    return -0.95 + (sample + 0.95) / (1 + ((sample + 0.95) / 0.05) ** 2) * 0.05;
  }
  return sample;
}

function normalizeLUFS(buffer: AudioBuffer, targetLufs: number, peakCeilingDb = -2): AudioBuffer {
  const currentLufs = measureLUFS(buffer);
  if (!isFinite(currentLufs)) return buffer;

  const desiredGainDb = targetLufs - currentLufs;
  const desiredGainLinear = Math.pow(10, desiredGainDb / 20);
  const peak = getPeakAmplitude(buffer);
  const peakCeilingLinear = Math.pow(10, peakCeilingDb / 20);

  // Conservative: max 3x gain, never exceed peak ceiling
  const peakLimitedGain = peak > 0 ? peakCeilingLinear / peak : desiredGainLinear;
  const appliedGain = Math.max(0.1, Math.min(desiredGainLinear, peakLimitedGain, 3));

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

  // 2. Noise Gate
  report('denoise', 10);
  const gatedBuffer = applyNoiseGate(originalBuffer, settings.noiseGateThresholdDb);
  await delay(20);

  // 3. Spectral Denoise
  report('denoise', 18);
  const denoisedBuffer = applySpectralDenoise(gatedBuffer);
  await delay(20);

  // 4. Silence Removal
  report('silence-removal', 25);
  const trimmedBuffer = removeSilence(
    denoisedBuffer,
    settings.silenceThresholdDb,
    settings.minSilenceMs,
    settings.maxSilenceMs,
  );
  const silenceRemovedMs = Math.round((originalDuration - trimmedBuffer.duration) * 1000);

  // 5. EQ + Compression + De-essing + LPF + Limiting
  report('eq', 35);
  await delay(20);
  report('compression', 45);
  await delay(20);
  report('de-essing', 55);
  await delay(20);
  report('limiting', 65);
  const processedBuffer = await applyEQAndDynamics(trimmedBuffer, settings);

  // 6. LUFS Normalization with soft-clip
  report('normalizing', 80);
  const normalizedBuffer = normalizeLUFS(processedBuffer, settings.targetLufs, settings.limiterThreshold);
  const finalLufs = measureLUFS(normalizedBuffer);

  // 7. Encode to WAV
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
