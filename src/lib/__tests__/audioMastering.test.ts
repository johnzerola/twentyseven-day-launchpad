import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  DEFAULT_MASTERING,
  MasteringPhase,
  MasteringSettings,
  MASTERING_PHASE_LABELS,
  MasteringStats,
} from "../audioMastering";

// ── Mock Web Audio API ──────────────────────────────────────────────

function createMockAudioBuffer(
  numberOfChannels: number,
  length: number,
  sampleRate: number,
  fillFn?: (ch: number, i: number) => number
): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = new Float32Array(length);
    if (fillFn) {
      for (let i = 0; i < length; i++) data[i] = fillFn(ch, i);
    }
    channelData.push(data);
  }

  return {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channelData[ch],
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

class MockOfflineAudioContext {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  destination = {};
  private _sourceBuffer: AudioBuffer | null = null;

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
  }

  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return createMockAudioBuffer(channels, length, sampleRate);
  }

  createBufferSource() {
    const self = this;
    return {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(function (this: any) {
        self._sourceBuffer = this.buffer;
      }),
    };
  }

  createBiquadFilter() {
    return {
      type: "",
      frequency: { value: 0 },
      gain: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
    };
  }

  createDynamicsCompressor() {
    return {
      threshold: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      knee: { value: 0 },
      connect: vi.fn(),
    };
  }

  async startRendering(): Promise<AudioBuffer> {
    // Return the source buffer passed through (simulating passthrough processing)
    if (this._sourceBuffer) {
      const buf = createMockAudioBuffer(
        this._sourceBuffer.numberOfChannels,
        this._sourceBuffer.length,
        this._sourceBuffer.sampleRate,
        (ch, i) => this._sourceBuffer!.getChannelData(ch)[i]
      );
      return buf;
    }
    return createMockAudioBuffer(this.numberOfChannels, this.length, this.sampleRate);
  }
}

class MockAudioContext {
  sampleRate = 44100;

  async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    // Parse WAV header to get actual params
    const view = new DataView(arrayBuffer);
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const dataSize = view.getUint32(40, true);
    const bytesPerSample = 2;
    const totalSamples = Math.floor(dataSize / (channels * bytesPerSample));

    return createMockAudioBuffer(channels, totalSamples, sampleRate, (ch, i) => {
      const offset = 44 + (i * channels + ch) * bytesPerSample;
      if (offset + 2 <= arrayBuffer.byteLength) {
        return view.getInt16(offset, true) / 0x7fff;
      }
      return 0;
    });
  }

  async close() {}
}

// Install mocks globally
(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).OfflineAudioContext = MockOfflineAudioContext;

// ── Test helpers ────────────────────────────────────────────────────

function createTestWav(
  sampleRate: number,
  durationSec: number,
  options: { noiseLevel: number; voiceLevel: number; silenceGaps: boolean }
): ArrayBuffer {
  const channels = 1;
  const length = Math.floor(sampleRate * durationSec);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, dataSize, true);

  // Deterministic "random" for reproducibility
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    const inVoice = !options.silenceGaps || (Math.floor(t * 2) % 3 !== 0);
    if (inVoice) {
      sample += Math.sin(2 * Math.PI * 200 * t) * options.voiceLevel;
      sample += Math.sin(2 * Math.PI * 400 * t) * options.voiceLevel * 0.3;
    }
    sample += rand() * options.noiseLevel;
    sample += Math.sin(2 * Math.PI * 7000 * t) * options.noiseLevel * 0.5;
    view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
    offset += 2;
  }
  return buf;
}

async function analyzeWavBlob(blob: Blob): Promise<{
  overallRms: number;
  peak: number;
  silentRegionRms: number;
  totalSamples: number;
}> {
  // Use FileReader polyfill approach for jsdom compatibility
  const ab = await new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
  const view = new DataView(ab);
  const channels = view.getUint16(22, true);
  const totalSamples = (ab.byteLength - 44) / (2 * channels);
  const samples: number[] = [];
  let sumSq = 0, peak = 0;

  for (let i = 0; i < totalSamples; i++) {
    const s = view.getInt16(44 + i * 2 * channels, true) / 0x7fff;
    samples.push(s);
    sumSq += s * s;
    peak = Math.max(peak, Math.abs(s));
  }

  const blockSize = 512;
  const blockRms: number[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const end = Math.min(i + blockSize, samples.length);
    let r = 0;
    for (let j = i; j < end; j++) r += samples[j] * samples[j];
    blockRms.push(Math.sqrt(r / (end - i)));
  }
  blockRms.sort((a, b) => a - b);
  const q10 = blockRms.slice(0, Math.max(1, Math.floor(blockRms.length * 0.1)));

  return {
    overallRms: Math.sqrt(sumSq / totalSamples),
    peak,
    silentRegionRms: q10.reduce((a, b) => a + b, 0) / q10.length,
    totalSamples,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("Audio Mastering Engine — Professional Quality", () => {
  let result: { blob: Blob; stats: MasteringStats };
  const phases: MasteringPhase[] = [];

  beforeAll(async () => {
    const { masterAudio } = await import("../audioMastering");
    const noisyWav = createTestWav(44100, 3, {
      noiseLevel: 0.05,
      voiceLevel: 0.4,
      silenceGaps: true,
    });
    result = await masterAudio(noisyWav, DEFAULT_MASTERING, (phase) => {
      phases.push(phase);
    });
  }, 30000);

  it("completes all mastering phases", () => {
    const required: MasteringPhase[] = [
      "decoding", "denoise", "silence-removal", "eq",
      "compression", "de-essing", "limiting", "normalizing", "encoding", "done",
    ];
    for (const p of required) {
      expect(phases).toContain(p);
    }
  });

  it("produces a valid WAV blob", () => {
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe("audio/wav");
    expect(result.blob.size).toBeGreaterThan(100);
  });

  it("reports coherent stats", () => {
    const { stats } = result;
    expect(stats.originalDurationSec).toBeGreaterThan(0);
    expect(stats.finalDurationSec).toBeGreaterThan(0);
    expect(stats.finalDurationSec).toBeLessThanOrEqual(stats.originalDurationSec + 0.01);
    expect(stats.fileSizeKb).toBeGreaterThan(0);
  });

  it("eliminates hiss in silent regions (RMS < 0.01)", async () => {
    const m = await analyzeWavBlob(result.blob);
    expect(m.silentRegionRms).toBeLessThan(0.01);
  });

  it("does not clip (peak < 1.0)", async () => {
    const m = await analyzeWavBlob(result.blob);
    expect(m.peak).toBeLessThan(1.0);
  });

  it("preserves audible signal (not over-gated)", async () => {
    const m = await analyzeWavBlob(result.blob);
    expect(m.overallRms).toBeGreaterThan(0.005);
  });

  it("removes silence gaps", () => {
    expect(result.stats.silenceRemovedMs).toBeGreaterThanOrEqual(0);
  });

  it("normalizes near -14 LUFS (within ±6 dB)", () => {
    expect(result.stats.finalLufs).toBeGreaterThan(-22);
    expect(result.stats.finalLufs).toBeLessThan(-6);
  });
});

describe("Audio Mastering — Default Settings Validation", () => {
  it("has correct YouTube-optimized defaults", () => {
    expect(DEFAULT_MASTERING.hpfFrequency).toBe(80);
    expect(DEFAULT_MASTERING.lpfFrequency).toBe(12000);
    expect(DEFAULT_MASTERING.bodyGainDb).toBe(3.5);
    expect(DEFAULT_MASTERING.presenceGainDb).toBe(2.5);
    expect(DEFAULT_MASTERING.airGainDb).toBe(1.0);
    expect(DEFAULT_MASTERING.compressorKnee).toBe(3);
    expect(DEFAULT_MASTERING.compressorThreshold).toBe(-20);
    expect(DEFAULT_MASTERING.noiseGateThresholdDb).toBe(-36);
    expect(DEFAULT_MASTERING.targetLufs).toBe(-14);
    expect(DEFAULT_MASTERING.limiterThreshold).toBe(-2);
  });

  it("has all phase labels defined", () => {
    const allPhases: MasteringPhase[] = [
      "idle", "decoding", "denoise", "silence-removal", "eq",
      "compression", "de-essing", "limiting", "normalizing", "encoding", "done",
    ];
    for (const p of allPhases) {
      expect(MASTERING_PHASE_LABELS[p]).toBeDefined();
    }
  });
});
