export type Platform = "tiktok" | "youtube_shorts" | "youtube" | "reels";

export type Language = "fr" | "en";

export interface NicheProfile {
  id: string;
  name: string;
  scriptInstructions: string;
  viralityInstructions: string;
  platform: Platform;
  language: Language;
  createdAt: string;
}

export interface VisualStyle {
  id: string;
  name: string;
  stylePrompt: string;
  referenceImages: string[];
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
  imageUrls?: string[];
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

export interface PublishMetadata {
  caption: string;
  hashtags: string[];
}

export type SubtitleStyle = "karaoke" | "block" | "bottom" | "none";

export interface VideoRenderOptions {
  kenBurns: boolean;
  transitions: boolean;
  subtitleStyle: SubtitleStyle;
  musicUrl?: string;
  musicVolume: number;
  beatDuration: number;
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
  publishMetadata?: PublishMetadata;
  createdAt: string;
}

export type MistralModel = "mistral-small-latest" | "mistral-large-latest";

export type ImageModel = string;

export type VoiceId =
  | "Achird"
  | "Algenib"
  | "Alnilam"
  | "Charon"
  | "Enceladus"
  | "Fenrir"
  | "Iapetus"
  | "Orus"
  | "Puck"
  | "Rasalgethi"
  | "Sadachbia"
  | "Sadaltager"
  | "Schedar"
  | "Umbriel"
  | "Zubenelgenubi"
  | "Achernar"
  | "Aoede"
  | "Autonoe"
  | "Callirrhoe"
  | "Despina"
  | "Erinome"
  | "Gacrux"
  | "Kore"
  | "Laomedeia"
  | "Leda"
  | "Pulcherrima"
  | "Sulafat"
  | "Vindemiatrix"
  | "Zephyr";

export interface VoiceOption {
  id: VoiceId;
  name: string;
  gender: "homme" | "femme";
  description: string;
  recommended?: boolean;
}

export interface PlatformOption {
  value: Platform;
  label: string;
}

export interface DurationOption {
  value: number;
  label: string;
}

export interface SubtitleEntry {
  start: number;
  end: number;
  text: string;
}
