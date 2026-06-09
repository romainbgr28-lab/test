import type { MistralModel } from "@/types";

export const MISTRAL_COSTS: Record<MistralModel, { label: string; eurPerScript: number }> = {
  "mistral-small-latest": { label: "Rapide - ~0.002€/script", eurPerScript: 0.002 },
  "mistral-large-latest": { label: "Puissant - ~0.02€/script", eurPerScript: 0.02 },
};

// Pollinations est gratuit, Leonardo coûte ~1 crédit/image
const POLLEN_PER_IMAGE = 1;

export interface CostEstimate {
  scriptEur: number;
  totalEur: number;
  totalPollen: number;
}

export function estimateCost(params: {
  mistralModel: MistralModel;
  imageModel?: string;
  segmentCount?: number;
}): CostEstimate {
  const scriptEur = MISTRAL_COSTS[params.mistralModel]?.eurPerScript ?? 0;
  const segmentCount = params.segmentCount ?? 0;
  const usesLeonardo = params.imageModel && params.imageModel !== "pollinations";
  const totalPollen = usesLeonardo ? segmentCount * POLLEN_PER_IMAGE : 0;
  const totalEur = scriptEur;
  return { scriptEur, totalEur, totalPollen };
}

export function formatEur(value: number): string {
  return `${value.toFixed(3)}€`;
}

export function formatPollen(value: number): string {
  return `${value} crédits`;
}

export function formatCredits(value: number): string {
  return `${value.toFixed(1)} crédits Leonardo`;
}
