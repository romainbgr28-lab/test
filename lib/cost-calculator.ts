import type { ImageModel, MistralModel } from "@/types";

export const MISTRAL_COSTS: Record<MistralModel, { label: string; eurPerScript: number }> = {
  "mistral-small-latest": { label: "Rapide - ~0.002€/script", eurPerScript: 0.002 },
  "mistral-large-latest": { label: "Puissant - ~0.02€/script", eurPerScript: 0.02 },
};

export const IMAGE_COSTS: Partial<Record<ImageModel, { label: string; pollenPerImage: number }>> = {
  flux: { label: "Gratuit", pollenPerImage: 0 },
  turbo: { label: "0.003 Pollen/image", pollenPerImage: 0.003 },
  kontext: { label: "0.04 Pollen/image", pollenPerImage: 0.04 },
};

const POLLEN_TO_EUR = 0.01; // taux indicatif d'estimation

export interface CostEstimate {
  scriptEur: number;
  imagesPollen: number;
  imagesEur: number;
  totalPollen: number;
  totalEur: number;
}

export function estimateCost(params: {
  mistralModel: MistralModel;
  imageModel: ImageModel;
  segmentCount: number;
}): CostEstimate {
  const scriptEur = MISTRAL_COSTS[params.mistralModel]?.eurPerScript ?? 0;
  const pollenPerImage = IMAGE_COSTS[params.imageModel]?.pollenPerImage ?? 0;
  const imagesPollen = pollenPerImage * params.segmentCount;
  const imagesEur = imagesPollen * POLLEN_TO_EUR;

  return {
    scriptEur,
    imagesPollen,
    imagesEur,
    totalPollen: imagesPollen,
    totalEur: scriptEur + imagesEur,
  };
}

export function formatEur(value: number): string {
  return `${value.toFixed(3)}€`;
}

export function formatPollen(value: number): string {
  return `${value.toFixed(3)} Pollen`;
}
