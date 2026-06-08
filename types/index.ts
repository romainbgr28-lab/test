export type Platform = "tiktok" | "youtube_shorts" | "youtube" | "reels";

export type Language = "fr" | "en";

export interface NicheProfile {
  id: string;
  name: string;
  instructions: string;
  platform: Platform;
  language: Language;
  createdAt: string;
}

export interface VideoSegment {
  id: string;
  order: number;
  narration: string;
  visualDescription: string;
  duration: number;
  imageUrl?: string;
  imageBlob?: string;
  isSceneVariation?: boolean;
  imagePrompt?: string;
}

export interface ViralityScore {
  score: number;
  hookStrength: string;
  retentionRisk: string;
  ctaClarity: string;
  suggestions: string[];
}

export interface VideoProject {
  id: string;
  subject: string;
  profile: NicheProfile;
  targetDuration: number;
  segments: VideoSegment[];
  voiceoverUrl?: string;
  voiceId: string;
  mistralModel: string;
  imageModel: string;
  viralityScore?: ViralityScore;
  createdAt: string;
}

export type MistralModel = "mistral-small-latest" | "mistral-large-latest";

export type ImageModel = string;

export type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface PlatformOption {
  value: Platform;
  label: string;
}

export interface DurationOption {
  value: number;
  label: string;
}
