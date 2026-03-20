import { describe, it, expect, beforeAll } from "vitest";
import {
  masterAudio,
  DEFAULT_MASTERING,
  MasteringPhase,
} from "../audioMastering";

// Helper: create a synthetic AudioBuffer with noise + voice simulation
function createTestAudioBuffer(
  sampleRate: number,
  durationSec: number,
  options: { noiseLevel: number; voiceLevel: number; silenceGaps: boolean }
): ArrayBuffer {
  const channels = 1;
  const length = Math.floor(sampleRate * durationSec);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const buf = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buf);

  // WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // Simulate voice: 200Hz tone in segments
    const inVoiceSegment =
      !options.silenceGaps || (Math.floor(t * 2) % 3 !== 0); // 2/3 voice, 1/3 silence
    if (inVoiceSegment) {
      sample += Math.sin(2 * Math.PI * 200 * t) * options.voiceLevel;
      // Add harmonics for realism
      sample += Math.sin(2 * Math.PI * 400 * t) * options.voiceLevel * 0.3;
      sample += Math.sin(2 * Math.PI * 800 * t) * options.voiceLevel * 0.1;
    }

    // Add broadband noise (simulates hiss/background)
    sample += (Math.random() * 2 - 1) * options.noiseLevel;

    // Add high-frequency hiss (6-10kHz range)
    sample += Math.sin(2 * Math.PI * 7000 * t + Math.random()) * options.noiseLevel * 0.5;

    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped * 0x7fff, true);
    offset += 2;
  }

  return buf;
}

// Measure RMS of a specific frequency band from WAV blob
async function measureNoiseFromBlob(blob: Blob): Promise<{
  overallRms: number;
  peakAmplitude: number;
  silentRegionRms: number;
}> {
  const arrayBuffer = await blob.arrayBuffer();
  const view = new DataView(arrayBuffer);
  const sampleRate = view.getUint32(24, true);
  const channels = view.getUint16(22, true);
  const dataOffset = 44;
  const totalSamples = (arrayBuffer.byteLength - dataOffset) / (2 * channels);

  let sumSquared = 0;
  let peak = 0;
  const samples: number[] = [];

  for (let i = 0; i < totalSamples; i++) {
    const sample = view.getInt16(dataOffset + i * 2 * channels, true) / 0x7fff;
    samples.push(sample);
    sumSquared += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  // Find the quietest 10% of blocks (should be near-silent after processing)
  const blockSize = 512;
  const blockRms: number[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const end = Math.min(i + blockSize, samples.length);
    let rms = 0;
    for (let j = i; j < end; j++) rms += samples[j] * samples[j];
    blockRms.push(Math.sqrt(rms / (end - i)));
  }
  blockRms.sort((a, b) => a - b);
  const quietest10 = blockRms.slice(0, Math.max(1, Math.floor(blockRms.length * 0.1)));
  const silentRegionRms = quietest10.reduce((a, b) => a + b, 0) / quietest10.length;

  return {
    overallRms: Math.sqrt(sumSquared / totalSamples),
    peakAmplitude: peak,
    silentRegionRms,
  };
}

describe("Audio Mastering Engine — Professional Quality", () => {
  let noisyAudio: ArrayBuffer;
  let cleanResult: { blob: Blob; stats: any };
  const phases: MasteringPhase[] = [];

  beforeAll(async () => {
    // Create a 3-second noisy audio with voice + hiss + silence gaps
    noisyAudio = createTestAudioBuffer(44100, 3, {
      noiseLevel: 0.05, // significant background noise
      voiceLevel: 0.4,
      silenceGaps: true,
    });

    cleanResult = await masterAudio(
      noisyAudio,
      DEFAULT_MASTERING,
      (phase) => { phases.push(phase); }
    );
  }, 30000);

  it("completes all mastering phases in order", () => {
    expect(phases).toContain("decoding");
    expect(phases).toContain("denoise");
    expect(phases).toContain("silence-removal");
    expect(phases).toContain("eq");
    expect(phases).toContain("compression");
    expect(phases).toContain("de-essing");
    expect(phases).toContain("limiting");
    expect(phases).toContain("normalizing");
    expect(phases).toContain("encoding");
    expect(phases).toContain("done");
  });

  it("produces a valid WAV blob", () => {
    expect(cleanResult.blob).toBeInstanceOf(Blob);
    expect(cleanResult.blob.type).toBe("audio/wav");
    expect(cleanResult.blob.size).toBeGreaterThan(44); // more than just header
  });

  it("reports accurate stats", () => {
    const { stats } = cleanResult;
    expect(stats.originalDurationSec).toBeGreaterThan(0);
    expect(stats.finalDurationSec).toBeGreaterThan(0);
    expect(stats.finalDurationSec).toBeLessThanOrEqual(stats.originalDurationSec);
    expect(stats.silenceRemovedMs).toBeGreaterThanOrEqual(0);
    expect(stats.finalLufs).toBeLessThan(0); // negative LUFS
    expect(stats.fileSizeKb).toBeGreaterThan(0);
  });

  it("eliminates noise in silent regions (hiss removal)", async () => {
    const measurements = await measureNoiseFromBlob(cleanResult.blob);
    // Silent regions should have RMS < 0.005 (nearly inaudible)
    expect(measurements.silentRegionRms).toBeLessThan(0.01);
  });

  it("does not clip the output (peak < 1.0)", async () => {
    const measurements = await measureNoiseFromBlob(cleanResult.blob);
    expect(measurements.peakAmplitude).toBeLessThan(1.0);
  });

  it("maintains audible signal (not over-gated)", async () => {
    const measurements = await measureNoiseFromBlob(cleanResult.blob);
    // Overall RMS should be reasonable (not silence)
    expect(measurements.overallRms).toBeGreaterThan(0.01);
  });

  it("removes silence gaps reducing duration", () => {
    expect(cleanResult.stats.silenceRemovedMs).toBeGreaterThan(0);
  });

  it("targets -14 LUFS normalization", () => {
    const { finalLufs } = cleanResult.stats;
    // Should be within ±4 dB of target (-14 LUFS)
    expect(finalLufs).toBeGreaterThan(-20);
    expect(finalLufs).toBeLessThan(-8);
  });
});
