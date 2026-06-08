import type { MistralModel } from "@/types";

export const MISTRAL_COSTS: Record<MistralModel, { label: string; eurPerScript: number }> = {
  "mistral-small-latest": { label: "Rapide - ~0.002€/script", eurPerScript: 0.002 },
  "mistral-large-latest": { label: "Puissant - ~0.02€/script", eurPerScript: 0.02 },
};

export interface CostEstimate {
  scriptEur: number;
}

export function estimateCost(params: { mistralModel: MistralModel }): CostEstimate {
  return { scriptEur: MISTRAL_COSTS[params.mistralModel]?.eurPerScript ?? 0 };
}

export function formatEur(value: number): string {
  return `${value.toFixed(3)}€`;
}

export function formatCredits(value: number): string {
  return `${value.toFixed(1)} crédits Leonardo`;
}
