import { describe, it, expect } from "vitest";
import {
  DEFAULT_MASTERING,
  MASTERING_PHASE_LABELS,
  PRESETS,
  PRESET_LABELS,
  type MasteringPhase,
  type MasteringSettings,
  type MasteringPreset,
} from "../audioMastering";

describe("Audio Mastering v5 — Settings & Presets", () => {
  describe("DEFAULT_MASTERING", () => {
    it("should have valid noise settings", () => {
      expect(DEFAULT_MASTERING.noiseReduction).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MASTERING.noiseReduction).toBeLessThanOrEqual(100);
      expect(DEFAULT_MASTERING.noiseGateThresholdDb).toBeLessThan(0);
    });

    it("should have valid EQ frequencies", () => {
      expect(DEFAULT_MASTERING.hpfFrequency).toBeGreaterThanOrEqual(20);
      expect(DEFAULT_MASTERING.hpfFrequency).toBeLessThanOrEqual(200);
      expect(DEFAULT_MASTERING.bodyFrequency).toBeGreaterThan(80);
      expect(DEFAULT_MASTERING.presenceFrequency).toBeGreaterThan(2000);
      expect(DEFAULT_MASTERING.lpfFrequency).toBeGreaterThan(10000);
    });

    it("should have multi-band compressor settings", () => {
      expect(DEFAULT_MASTERING.compLowThreshold).toBeLessThan(0);
      expect(DEFAULT_MASTERING.compMidThreshold).toBeLessThan(0);
      expect(DEFAULT_MASTERING.compHighThreshold).toBeLessThan(0);
      expect(DEFAULT_MASTERING.compLowRatio).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_MASTERING.compMidRatio).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_MASTERING.compHighRatio).toBeGreaterThanOrEqual(1);
    });

    it("should have valid output settings", () => {
      expect(DEFAULT_MASTERING.limiterThreshold).toBeLessThan(0);
      expect(DEFAULT_MASTERING.targetLufs).toBe(-14);
    });

    it("should have breath reduction enabled", () => {
      expect(DEFAULT_MASTERING.breathReduction).toBe(true);
      expect(DEFAULT_MASTERING.breathReductionDb).toBeLessThan(0);
    });

    it("should have saturation controls", () => {
      expect(DEFAULT_MASTERING.saturationAmount).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MASTERING.saturationWarmth).toBeGreaterThanOrEqual(0);
    });

    it("should match youtube preset", () => {
      expect(DEFAULT_MASTERING).toEqual(PRESETS.youtube);
    });
  });

  describe("PRESETS", () => {
    it("should have all required presets", () => {
      const expected: (Exclude<MasteringPreset, "custom">)[] = [
        "youtube", "podcast", "broadcast", "audiobook", "music", "raw",
      ];
      for (const p of expected) {
        expect(PRESETS).toHaveProperty(p);
        expect(PRESET_LABELS).toHaveProperty(p);
      }
    });

    it("all presets should have valid settings", () => {
      for (const [name, settings] of Object.entries(PRESETS)) {
        expect(settings.noiseReduction, `${name}.noiseReduction`).toBeGreaterThanOrEqual(0);
        expect(settings.targetLufs, `${name}.targetLufs`).toBeLessThan(0);
        expect(settings.limiterThreshold, `${name}.limiterThreshold`).toBeLessThan(0);
      }
    });

    it("broadcast should target -23 LUFS (EBU R128)", () => {
      expect(PRESETS.broadcast.targetLufs).toBe(-23);
    });

    it("podcast should have higher noise reduction than music", () => {
      expect(PRESETS.podcast.noiseReduction).toBeGreaterThan(PRESETS.music.noiseReduction);
    });

    it("raw preset should have minimal processing", () => {
      expect(PRESETS.raw.saturationAmount).toBe(0);
      expect(PRESETS.raw.breathReduction).toBe(false);
      expect(PRESETS.raw.bodyGainDb).toBe(0);
    });

    it("audiobook should have higher silence threshold for natural pauses", () => {
      expect(PRESETS.audiobook.minSilenceMs).toBeGreaterThan(PRESETS.youtube.minSilenceMs);
    });
  });

  describe("MASTERING_PHASE_LABELS", () => {
    it("should have labels for all 16 phases", () => {
      const allPhases: MasteringPhase[] = [
        "idle", "decoding", "analyzing", "denoise", "breath-reduction",
        "silence-removal", "eq", "multiband-comp", "de-essing",
        "saturation", "stereo", "limiting", "normalizing", "dithering",
        "encoding", "done",
      ];
      for (const p of allPhases) {
        expect(MASTERING_PHASE_LABELS).toHaveProperty(p);
      }
    });

    it("idle phase should have empty label", () => {
      expect(MASTERING_PHASE_LABELS.idle).toBe("");
    });

    it("done phase should indicate completion", () => {
      expect(MASTERING_PHASE_LABELS.done).toContain("✅");
    });

    it("new v5 phases should exist", () => {
      expect(MASTERING_PHASE_LABELS["analyzing"]).toBeDefined();
      expect(MASTERING_PHASE_LABELS["breath-reduction"]).toBeDefined();
      expect(MASTERING_PHASE_LABELS["multiband-comp"]).toBeDefined();
      expect(MASTERING_PHASE_LABELS["saturation"]).toBeDefined();
      expect(MASTERING_PHASE_LABELS["stereo"]).toBeDefined();
      expect(MASTERING_PHASE_LABELS["dithering"]).toBeDefined();
    });
  });
});
