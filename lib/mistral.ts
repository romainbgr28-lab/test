import type { Language, Platform } from "@/types";

export const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
export const MISTRAL_CONVERSATIONS_ENDPOINT = "https://api.mistral.ai/v1/conversations";

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

  return `Tu es un expert en copywriting viral TikTok avec 10 ans d'expérience.
Tu maîtrises la psychologie de l'attention humaine et les mécanismes neurobiologiques qui poussent à continuer à regarder une vidéo.

PRINCIPES PSYCHOLOGIQUES QUE TU APPLIQUES SYSTÉMATIQUEMENT :
- Loop ouvert : chaque segment crée une question dans l'esprit du spectateur que seul le segment suivant peut résoudre
- Pattern interrupt : varier le rythme, les chiffres chocs, les questions rhétoriques pour réactiver l'attention toutes les 5 à 7 secondes
- Curiosity gap : ne jamais tout révéler d'un coup, toujours laisser une promesse non tenue jusqu'au segment suivant
- Social proof + fear of missing out : ancrer dans le réel avec des chiffres, des situations reconnaissables
- Micro-engagements : poser des questions auxquelles le spectateur répond mentalement "oui" pour créer une validation continue

STRUCTURE OBLIGATOIRE POUR ${params.duration} SECONDES :
- Segment 1 (3s max) : Hook. Une phrase choc. Chiffre, question provocante ou affirmation contre-intuitive. Jamais plus de 15 mots.
- Segments 2 à N-1 : Corps. Chaque segment = une idée, une preuve, une révélation. Durée : 6 à 8 secondes chacun. Créer un micro-cliffhanger à la fin de chaque segment.
- Dernier segment (5s) : CTA. Direct, simple, une seule action demandée.

CALCUL OBLIGATOIRE : Pour ${params.duration} secondes tu DOIS générer exactement le nombre de segments nécessaires pour atteindre cette durée.
Exemple : 60 secondes = hook 3s + 7 segments de 7s + CTA 5s = 9 segments minimum.
Exemple : 90 secondes = hook 3s + 11 segments de 7s + CTA 5s = 13 segments minimum.
Ne génère JAMAIS moins de segments que nécessaire. Compte les secondes avant de répondre.

RÈGLES DE NARRATION :
- Phrases courtes. Maximum 20 mots par phrase.
- Rythme TikTok : une idée = une phrase = une respiration
- Utiliser "tu" pas "vous"
- Jamais de transition molle ("ensuite", "puis", "donc"). Transitions chocs : "Mais voilà le truc.", "Et c'est là que ça devient fou.", "La plupart des gens ignorent ça."
- Chaque narration doit pouvoir se lire en exactement {segment_duration} secondes à voix haute (environ 2,5 mots par seconde)

RÈGLES VISUELLES :
- La description visuelle doit être en anglais, très précise, style prompt Midjourney
- Spécifier : sujet principal, éclairage, couleurs dominantes, style (cinématique, minimaliste, etc.), émotion recherchée
- Les visuels doivent RENFORCER la narration, pas juste l'illustrer
- Varier les types de plans : close-up, wide shot, abstract, data visualization, metaphor visuelle

RECHERCHE WEB OBLIGATOIRE :
Tu as accès à un outil de recherche internet en temps réel. Utilise-le systématiquement avant de rédiger pour :
- trouver les tendances, sujets chauds et formulations qui cartonnent en ce moment sur ce thème et sur cette plateforme
- collecter des chiffres, statistiques et faits récents et vérifiables à intégrer dans la narration pour renforcer la crédibilité et l'effet "wahou"
- repérer les angles et accroches qui fonctionnent déjà sur des contenus similaires, pour t'en inspirer sans copier
N'invente jamais une statistique : si tu avances un chiffre, il doit provenir d'une recherche réelle.

Niche et instructions : ${params.nicheInstructions}
Plateforme : ${platformLabel}
Langue : ${languageLabel}

Sujet : ${params.subject}

FORMAT DE RÉPONSE : JSON strict uniquement, aucun texte avant ou après.
{
  "viralityScore": {
    "score": [0-100],
    "hookStrength": "[analyse en 1 phrase]",
    "retentionRisk": "[analyse en 1 phrase]",
    "ctaClarity": "[analyse en 1 phrase]",
    "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
  },
  "segments": [
    {
      "order": 1,
      "narration": "[texte exact à lire]",
      "visualDescription": "[prompt visuel en anglais]",
      "duration": [durée en secondes, entier]
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

export interface MistralWebSearchParams {
  apiKey: string;
  model: string;
  instructions: string;
  userMessage: string;
}

export interface MistralWebSearchResult {
  text: string;
  searchQueries: string[];
  sources: string[];
}

/**
 * Calls Mistral's Conversations API with the built-in `web_search` connector,
 * letting the model autonomously search the web before answering.
 */
export async function callMistralWithWebSearch(params: MistralWebSearchParams): Promise<MistralWebSearchResult> {
  const response = await fetch(MISTRAL_CONVERSATIONS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      instructions: params.instructions,
      inputs: [{ role: "user", content: params.userMessage }],
      tools: [{ type: "web_search" }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral Conversations API a répondu avec une erreur (${response.status}) : ${errorText}`);
  }

  const data = await response.json();
  const outputs: unknown[] = Array.isArray(data?.outputs) ? data.outputs : [];

  const searchQueries: string[] = [];
  const sources: string[] = [];
  let text = "";

  for (const entry of outputs) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;

    if (item.type === "tool.execution") {
      const args = item.arguments as Record<string, unknown> | undefined;
      const info = item.info as Record<string, unknown> | undefined;
      const query = (args?.query ?? info?.query) as unknown;
      if (typeof query === "string" && query.trim()) {
        searchQueries.push(query.trim());
      }
    }

    if (item.type === "message.output") {
      const content = item.content;
      if (typeof content === "string") {
        text += content;
      } else if (Array.isArray(content)) {
        for (const chunk of content) {
          if (!chunk || typeof chunk !== "object") continue;
          const c = chunk as Record<string, unknown>;
          if (c.type === "text" && typeof c.text === "string") {
            text += c.text;
          } else if (c.type === "tool_reference") {
            const url = (c.url ?? c.source) as unknown;
            if (typeof url === "string" && url.trim()) sources.push(url.trim());
          }
        }
      }
    }
  }

  if (!text.trim()) {
    throw new Error("Réponse Mistral (recherche web) invalide : aucun contenu trouvé.");
  }

  return { text, searchQueries: [...new Set(searchQueries)], sources: [...new Set(sources)] };
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
