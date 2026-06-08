import type { Platform, VoiceId } from "@/types";

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

export const IMAGE_ENDPOINT = "https://gen.pollinations.ai/image";
export const IMAGE_MODELS_ENDPOINT = "https://gen.pollinations.ai/image/models";

export function buildImageUrl(params: {
  prompt: string;
  model: string;
  width: number;
  height: number;
}): string {
  const encoded = encodeURIComponent(params.prompt);
  const query = new URLSearchParams({
    model: params.model,
    width: String(params.width),
    height: String(params.height),
    nologo: "true",
  });
  return `${IMAGE_ENDPOINT}/${encoded}?${query.toString()}`;
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Échec de la génération de l'image (${response.status}).`);
  }
  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const TTS_ENDPOINT = "https://text.pollinations.ai/";
