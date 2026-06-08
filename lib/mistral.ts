import type { Language, Platform } from "@/types";

export const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  reels: "Instagram Reels",
};

const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "français",
  en: "anglais",
};

export function buildScriptSystemPrompt(params: {
  platform: Platform;
  language: Language;
  nicheInstructions: string;
  duration: number;
  subject: string;
}): string {
  const platformLabel = PLATFORM_LABELS[params.platform];
  const languageLabel = LANGUAGE_LABELS[params.language];

  return `Tu es un expert en création de contenu viral sur ${platformLabel}.
Tu crées des scripts pour des vidéos faceless en ${languageLabel}.
Niche et instructions : ${params.nicheInstructions}

Recherche mentalement les formats qui performent actuellement sur ${platformLabel}, notamment aux États-Unis, et applique ces patterns au sujet donné.

Génère un script pour une vidéo de ${params.duration} secondes sur : ${params.subject}

RÈGLES DU SCRIPT :
- Le hook doit capturer l'attention en moins de 3 secondes
- Chaque segment doit créer une micro-tension pour pousser à continuer
- Utilise le pattern : Promesse → Preuve → Méthode → CTA
- Adapte le rythme à la plateforme : TikTok = rapide et punchy, YouTube = plus développé

FORMAT DE RÉPONSE OBLIGATOIRE (JSON strict, aucun texte avant ou après) :
{
  "viralityScore": {
    "score": [0-100],
    "hookStrength": "[analyse du hook en 1 phrase]",
    "retentionRisk": "[risque de décrochage en 1 phrase]",
    "ctaClarity": "[clarté du CTA en 1 phrase]",
    "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
  },
  "segments": [
    {
      "order": 1,
      "narration": "[texte exact à lire à voix haute]",
      "visualDescription": "[description précise et détaillée en anglais de l'image à générer, style cinématographique]",
      "duration": [durée en secondes]
    }
  ]
}`;
}

export interface MistralChatParams {
  apiKey: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
}

export async function callMistralChat(params: MistralChatParams): Promise<string> {
  const response = await fetch(MISTRAL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API a répondu avec une erreur (${response.status}) : ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Réponse Mistral invalide : aucun contenu trouvé.");
  }
  return content;
}

export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Impossible d'extraire un JSON de la réponse de l'IA.");
  }
  const jsonSlice = trimmed.slice(start, end + 1);
  return JSON.parse(jsonSlice) as T;
}
