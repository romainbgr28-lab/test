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

function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation, keeping non-empty chunks
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
}

function chunkArray<T>(arr: T[], n: number): T[][] {
  if (n <= 1 || arr.length === 0) return [arr];
  const size = Math.ceil(arr.length / n);
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  // If we have fewer chunks than n (e.g., only 1 sentence for 3 images),
  // duplicate last chunk to pad
  while (chunks.length < n) chunks.push(chunks[chunks.length - 1]);
  return chunks.slice(0, n);
}

/**
 * For a segment that needs `count` images, returns `count` distinct image prompts
 * each grounded in the corresponding portion of the narration text.
 */
export function buildSubSegmentPrompts(
  segment: VideoSegment,
  count: number,
  stylePrompt?: string
): string[] {
  if (count <= 1) {
    const base = segment.imagePrompt?.trim() || segment.visualDescription;
    return [stylePrompt ? `${base}, ${stylePrompt}` : base];
  }

  const sentences = splitIntoSentences(segment.narration);
  const chunks = chunkArray(sentences, count);
  const styleTag = stylePrompt ? `, ${stylePrompt}` : "";

  return chunks.map((chunk) => {
    const narrationPart = chunk.join(" ");
    // Build a visual prompt: "Cinematic scene showing [narration part]. [visual context]."
    return `Cinematic scene visually illustrating: "${narrationPart}". Context: ${segment.visualDescription}${styleTag}`;
  });
}

export const TTS_ENDPOINT = "https://text.pollinations.ai/";
