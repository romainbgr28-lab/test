import type { Platform, VideoSegment, VoiceId } from "@/types";

export const VOICE_DESCRIPTIONS: Record<VoiceId, string> = {
  Achird: "Achird - Neutre",
  Algenib: "Algenib - Neutre",
  Alnilam: "Alnilam - Neutre",
  Charon: "Charon - Neutre",
  Enceladus: "Enceladus - Neutre",
  Fenrir: "Fenrir - Neutre",
  Iapetus: "Iapetus - Neutre",
  Orus: "Orus - Neutre",
  Puck: "Puck - Neutre",
  Rasalgethi: "Rasalgethi - Neutre",
  Sadachbia: "Sadachbia - Neutre",
  Sadaltager: "Sadaltager - Neutre",
  Schedar: "Schedar - Neutre",
  Umbriel: "Umbriel - Neutre",
  Zubenelgenubi: "Zubenelgenubi - Neutre",
  Achernar: "Achernar - Neutre",
  Aoede: "Aoede - Neutre",
  Autonoe: "Autonoe - Neutre",
  Callirrhoe: "Callirrhoe - Neutre",
  Despina: "Despina - Neutre",
  Erinome: "Erinome - Neutre",
  Gacrux: "Gacrux - Neutre",
  Kore: "Kore - Neutre",
  Laomedeia: "Laomedeia - Neutre",
  Leda: "Leda - Neutre",
  Pulcherrima: "Pulcherrima - Neutre",
  Sulafat: "Sulafat - Neutre",
  Vindemiatrix: "Vindemiatrix - Neutre",
  Zephyr: "Zephyr - Neutre",
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
