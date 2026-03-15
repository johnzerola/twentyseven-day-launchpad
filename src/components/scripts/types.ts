export interface CharacterAppearance {
  skin_color: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  body_type: string;
  height: string;
}

export interface CharacterFacialFeatures {
  eyebrows: string;
  nose: string;
  mouth: string;
  ears: string;
  face_shape: string;
}

export interface CharacterClothing {
  shirt: string;
  pants: string;
  shoes: string;
  accessories: string;
}

export interface Character {
  name: string;
  gender: string;
  age: number;
  role: string;
  appearance: CharacterAppearance;
  facial_features: CharacterFacialFeatures;
  clothing: CharacterClothing;
  personality: string[];
}

export interface SyncedScene {
  sceneIndex: number;
  sceneDurationSeconds?: number;
  startTime: number;
  endTime: number;
  visualPrompt: string;
  cameraAngle: string;
  cameraMove?: string;
  mood: string;
  narrativeText?: string;
  narrativeSummary?: string;
  emotionalBeat?: string;
  lensSpec?: string;
  lighting?: string;
  lightingSetup?: string;
  audioDirection?: string;
  negativePrompt?: string;
  charactersInScene?: string[];
  transitionNote?: string;
  dopamineTrigger?: string;
}

export interface TranscriptionBlock {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TranscriptionData {
  fullText: string;
  wordCount: number;
  audioDuration: number;
  blocks: TranscriptionBlock[];
}

export interface VideoStyleOption {
  value: string;
  label: string;
  desc: string;
}
