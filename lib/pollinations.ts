import type { Platform, VideoSegment, VoiceId } from "@/types";

export const VOICE_DESCRIPTIONS: Record<VoiceId, string> = {
  alloy: "Alloy - Neutre, polyvalente",
  echo: "Echo - Masculine, posée",
  fable: "Fable - Britannique, narrative",
  onyx: "Onyx - Masculine, grave et posée",
  nova: "Nova - Féminine, chaleureuse",
  shimmer: "Shimmer - Féminine, douce et énergique",
};

export interface ImageDimensions {
  width: number;
  height: number;
}

export function getDimensionsForPlatform(platform: Platform): ImageDimensions {
  if (platform === "youtube") {
    return { width: 1920, height: 1080 };
  }
  return { width: 1080, height: 1920 };
}

export function buildSceneContinuityPrompt(
  segments: VideoSegment[],
  index: number
): { prompt: string; isVariation: boolean } {
  const segment = segments[index];
  const previous = segments[index - 1];
  const isVariation = !!previous && previous.duration + segment.duration < 10;
  if (isVariation) {
    return {
      prompt: `${segment.visualDescription}, same scene as previous, slight camera movement, subtle shift in framing and lighting`,
      isVariation: true,
    };
  }
  return { prompt: segment.visualDescription, isVariation: false };
}

export const TTS_ENDPOINT = "https://text.pollinations.ai/";
